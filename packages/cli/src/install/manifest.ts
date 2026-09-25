import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeFileAtomic } from './atomic.js';

export type Scope = 'project' | 'global';

export interface Manifest {
  version: string;
  agent: string;
  scope: Scope;
  installedAt: string;
  files: Record<string, string>;
}

const REGENERATE_HINT = "Re-run 'jig install --agent <name>' to fix it.";

/**
 * Where `manifest.json` itself lives, relative to `root`. Defaults to
 * `.jig` for backward compatibility with the pre-0.4.0 install layout;
 * every current call site passes the adapter's own `referenceDir(scope)`
 * explicitly (see `adapters/types.ts`), since `install` no longer writes
 * anything into a project's `.jig/`.
 */
function manifestPath(root: string, manifestDir: string): string {
  return join(root, ...manifestDir.split('/'), 'manifest.json');
}

export function checksum(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  return `sha256:${createHash('sha256').update(normalized, 'utf8').digest('hex')}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A manifest key must be a safe relative path: no leading `/` (POSIX
 * absolute), no drive prefix (`C:\...`), and no `..` segment anywhere in it.
 * `manifest.json` lives in a repo that may be shared and version-controlled
 * (see finding C3), so it must never be trusted to point writes outside the
 * install root it belongs to.
 */
function isSafeManifestKey(key: string): boolean {
  if (key.startsWith('/') || /^[A-Za-z]:/.test(key)) return false;
  return !key.split(/[\\/]/).includes('..');
}

/**
 * Validates the shape of a manifest parsed from disk. `manifest.json` is
 * read from a location that may be a shared, version-controlled repository
 * (see finding C3) — it must never be trusted at face value. Throws a clear,
 * actionable error on any structural problem rather than letting a malformed
 * manifest surface as a raw `JSON.parse` error or a downstream
 * "Cannot read properties of undefined".
 */
function validateManifest(raw: unknown, path: string): Manifest {
  const fail = (): never => {
    throw new Error(`Jig's manifest at ${path} is invalid or corrupted. ${REGENERATE_HINT}`);
  };
  if (!isPlainObject(raw)) fail();
  const { version, agent, scope, installedAt, files } = raw as Record<string, unknown>;
  if (typeof version !== 'string') fail();
  if (typeof agent !== 'string') fail();
  if (typeof installedAt !== 'string') fail();
  if (scope !== 'project' && scope !== 'global') fail();
  if (!isPlainObject(files)) fail();
  for (const [key, value] of Object.entries(files as Record<string, unknown>)) {
    if (typeof value !== 'string') fail();
    if (!isSafeManifestKey(key)) fail();
  }
  return {
    version: version as string,
    agent: agent as string,
    scope: scope as Scope,
    installedAt: installedAt as string,
    files: files as Record<string, string>,
  };
}

export function readManifest(root: string, manifestDir = '.jig'): Manifest | null {
  const path = manifestPath(root, manifestDir);
  if (!existsSync(path)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`Jig's manifest at ${path} is not valid JSON. ${REGENERATE_HINT}`);
  }
  return validateManifest(raw, path);
}

/**
 * Writes the manifest, merging `files` over whatever is on disk at THIS moment
 * rather than over the copy the caller read when it started, under a lock.
 *
 * Two runs against one install (two agents, or a script running `jig init`
 * across a monorepo against a shared global install) both read the manifest
 * and both write it. Last-writer-wins dropped the other's entries, and those
 * entries are records of "Jig owns this file": losing one makes a later
 * `update` treat that file as the user's and leave it alone.
 *
 * The merge alone did not close it. It used to re-read after writing and
 * retry if its own keys were gone, but a writer only ever checked its own
 * keys: run B could read, run A write and verify and finish, and B then
 * rename a file without A's entry over it, verify its own, and finish too.
 * Both succeeded and A's entry was gone; it surfaced as a lost entry in the
 * parallel-process test under load. So the read, merge and write happen
 * inside a lock, and the merge stays because the caller's own copy is still
 * stale by the time it gets here.
 *
 * The lock is a file created exclusively. A lock whose process has died, or
 * that is older than any write takes, is taken over, so a run killed mid-write
 * cannot wedge an install; the wait is bounded for the same reason.
 */
const LOCK_STALE_MS = 10_000;
const LOCK_WAIT_MS = 15_000;

export function writeManifest(root: string, m: Manifest, manifestDir = '.jig'): void {
  const path = manifestPath(root, manifestDir);
  mkdirSync(dirname(path), { recursive: true });
  withLock(`${path}.lock`, () => {
    const onDisk = readManifestQuietly(path);
    const merged: Manifest = { ...m, files: { ...(onDisk?.files ?? {}), ...m.files } };
    writeFileAtomic(path, `${JSON.stringify(merged, null, 2)}\n`);
  });
}

function withLock(lock: string, fn: () => void): void {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      const fd = openSync(lock, 'wx');
      try { writeSync(fd, `${process.pid} ${Date.now()}`); } finally { closeSync(fd); }
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      if (lockIsStale(lock) || Date.now() > deadline) {
        try { unlinkSync(lock); } catch { /* another waiter took it over first */ }
        continue;
      }
      sleep(10 + Math.random() * 20);
    }
  }
  try {
    fn();
  } finally {
    try { unlinkSync(lock); } catch { /* already removed */ }
  }
}

/** A lock held by a process that no longer exists, or held longer than a write takes. */
function lockIsStale(lock: string): boolean {
  try {
    const [pid, at] = readFileSync(lock, 'utf8').trim().split(/\s+/).map(Number);
    if (at && Date.now() - at > LOCK_STALE_MS) return true;
    if (pid && pid !== process.pid) {
      try { process.kill(pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') return true; }
    }
    if (!pid || !at) return Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS;
    return false;
  } catch {
    return false; // gone, or being written: try again
  }
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * The manifest at `path`, or null if it is absent, unreadable, or malformed.
 *
 * Unlike `readManifest` this never throws: a corrupt manifest must not stop a
 * write that is about to replace it, and a torn read from a concurrent writer
 * is a retry rather than an error.
 */
function readManifestQuietly(path: string): Manifest | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!isPlainObject(parsed) || !isPlainObject(parsed.files)) return null;
    return parsed as unknown as Manifest;
  } catch {
    return null;
  }
}

export function isModified(projectRoot: string, relPath: string, m: Manifest): boolean {
  const recorded = m.files[relPath];
  if (!recorded) return false;
  const abs = join(projectRoot, relPath);
  if (!existsSync(abs)) return false;
  return checksum(readFileSync(abs, 'utf8')) !== recorded;
}
