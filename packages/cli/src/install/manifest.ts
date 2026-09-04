import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
 * rather than over the copy the caller read when it started.
 *
 * Two runs against one install — two agents, or a script running `jig init`
 * across a monorepo against a shared global install — both read the manifest
 * and both write it. Last-writer-wins dropped the other's entries, and those
 * entries are records of "Jig owns this file": losing one makes a later
 * `update` treat that file as the user's and leave it alone. The safe
 * direction, but silent data loss.
 *
 * A merge is correct here rather than merely convenient, because the `files`
 * map is additive and per-file: a run only records entries for files it
 * actually wrote, so its own entries are authoritative for those keys and it
 * has no opinion about any other. That is also why this needs no lock — and a
 * lock is what it would otherwise take, along with stale-lock recovery for a
 * process killed mid-run, which is a new way to leave an install wedged.
 *
 * The remaining window is between this read and the rename below. It is closed
 * by verifying afterwards and retrying: if another writer landed in between,
 * its entries are visible on the re-read and the merge is redone.
 */
const MERGE_ATTEMPTS = 5;

export function writeManifest(root: string, m: Manifest, manifestDir = '.jig'): void {
  const path = manifestPath(root, manifestDir);
  mkdirSync(dirname(path), { recursive: true });

  for (let attempt = 0; attempt < MERGE_ATTEMPTS; attempt++) {
    const onDisk = readManifestQuietly(path);
    const merged: Manifest = { ...m, files: { ...(onDisk?.files ?? {}), ...m.files } };
    writeFileAtomic(path, `${JSON.stringify(merged, null, 2)}\n`);

    // Did anything land between the read and the rename? If every key we
    // merged is still present, no.
    const after = readManifestQuietly(path);
    if (after && Object.keys(merged.files).every((k) => k in after.files)) return;
  }
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
