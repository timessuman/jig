import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { getPackageRoot } from '../src/paths.js';
import { readManifest, writeManifest, type Manifest } from '../src/install/manifest.js';

/**
 * M7. Two runs that both read a manifest and both write it used to lose one
 * set of updates — last writer wins, and the entries it dropped were records of
 * "Jig owns this file". Losing those makes a later `update` treat those files
 * as the user's and leave them alone, which is the safe direction, but it is
 * still silent data loss.
 *
 * The first fix was a merge against whatever is on disk at write time, with no
 * lock. It lost an entry anyway: a writer only verified its own keys, so one
 * that read before another's write could rename over it afterwards and both
 * reported success. The parallel-process test below caught it under load in a
 * release run. The read, merge and write now happen under a lock file, with
 * stale-lock recovery so a crashed run cannot wedge an install.
 */
let root: string;
const dir = '.agents/skills/jig';

const manifest = (files: Record<string, string>, version = '0.4.0'): Manifest => ({
  version,
  agent: 'claude',
  scope: 'project',
  installedAt: new Date().toISOString(),
  files,
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-concurrent-'));
  mkdirSync(join(root, ...dir.split('/')), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('a manifest write does not drop another run’s entries', () => {
  it('keeps entries written by someone else since we read', () => {
    // Run A records its file.
    writeManifest(root, manifest({ 'a.md': 'sha256:a' }), dir);
    // Run B started before that, so its own view has only b.md.
    writeManifest(root, manifest({ 'b.md': 'sha256:b' }), dir);

    const after = readManifest(root, dir)!;
    expect(Object.keys(after.files).sort(), 'a.md was lost').toEqual(['a.md', 'b.md']);
  });

  it('lets the writing run win for a key both touched', () => {
    writeManifest(root, manifest({ 'a.md': 'sha256:old' }), dir);
    writeManifest(root, manifest({ 'a.md': 'sha256:new' }), dir);
    expect(readManifest(root, dir)!.files['a.md']).toBe('sha256:new');
  });

  it('carries the writing run’s own metadata', () => {
    writeManifest(root, manifest({ 'a.md': 'sha256:a' }, '0.3.0'), dir);
    writeManifest(root, manifest({ 'b.md': 'sha256:b' }, '0.4.0'), dir);
    expect(readManifest(root, dir)!.version).toBe('0.4.0');
  });

  it('ignores an unreadable existing manifest rather than failing the write', () => {
    writeFileSync(join(root, ...dir.split('/'), 'manifest.json'), '{ not json');
    expect(() => writeManifest(root, manifest({ 'a.md': 'sha256:a' }), dir)).not.toThrow();
    expect(readManifest(root, dir)!.files).toEqual({ 'a.md': 'sha256:a' });
  });

  it('survives genuinely parallel processes', async () => {
    // Real processes writing AT THE SAME TIME, each recording a distinct file.
    // Every entry must survive — this is exactly what last-writer-wins loses,
    // and it is the only assertion here that exercises real concurrency rather
    // than a simulated interleaving.
    //
    // FOUR writers, ten writes each, not ten writers. The property fails with
    // two, so ten processes bought no extra coverage — and each child pays for
    // an `npx tsx` resolution, so ten of them at once competed with vitest's
    // own worker pool and made the test fail under load while passing in
    // isolation. A test that goes red when the machine is busy teaches people
    // to ignore red. The writes per child went up to keep the interleaving
    // dense.
    //
    // The module path comes from `getPackageRoot()`, not `process.cwd()`: with
    // cwd the test passed or failed depending on which directory vitest was
    // invoked from, which is worse than no test.
    const manifestModule = join(getPackageRoot(), 'src/install/manifest.ts');
    const script = join(root, 'w.mjs');
    writeFileSync(
      script,
      `import { writeManifest } from ${JSON.stringify(manifestModule)};\n` +
        `const i = process.argv[2];\n` +
        `for (let n = 0; n < 10; n++) {\n` +
        `  writeManifest(${JSON.stringify(root)}, { version: '0.4.0', agent: 'claude',\n` +
        `    scope: 'project', installedAt: new Date().toISOString(),\n` +
        `    files: { ['f' + i + '.md']: 'sha256:' + i } }, ${JSON.stringify(dir)});\n` +
        `}\n`,
    );

    await Promise.all(
      Array.from(
        { length: 4 },
        (_, i) =>
          new Promise<void>((resolve, reject) => {
            const child = spawn('npx', ['tsx', script, String(i)], { stdio: 'ignore' });
            child.on('error', reject);
            child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
          }),
      ),
    );

    const files = Object.keys(readManifest(root, dir)!.files).sort();
    expect(files, `lost entries — got ${files.join(', ')}`).toHaveLength(4);
  }, 60_000);
});

describe('the manifest lock', () => {
  const lockPath = () => join(root, ...dir.split('/'), 'manifest.json.lock');

  it('takes over a lock whose process is gone', () => {
    writeFileSync(lockPath(), `999999 ${Date.now()}`);
    writeManifest(root, manifest({ 'a.md': 'sha256:a' }), dir);
    expect(readManifest(root, dir)!.files).toEqual({ 'a.md': 'sha256:a' });
    expect(existsSync(lockPath())).toBe(false);
  });

  it('takes over a lock older than any write takes', () => {
    writeFileSync(lockPath(), `${process.pid} ${Date.now() - 60_000}`);
    writeManifest(root, manifest({ 'a.md': 'sha256:a' }), dir);
    expect(readManifest(root, dir)!.files).toEqual({ 'a.md': 'sha256:a' });
  });

  it('makes another process wait while it is held, then lets it write', async () => {
    const manifestModule = join(getPackageRoot(), 'src/install/manifest.ts');
    const script = join(root, 'w.mjs');
    writeFileSync(
      script,
      `import { writeManifest } from ${JSON.stringify(manifestModule)};\n` +
        `writeManifest(${JSON.stringify(root)}, { version: '0.4.0', agent: 'claude', scope: 'project',\n` +
        `  installedAt: new Date().toISOString(), files: { 'b.md': 'sha256:b' } }, ${JSON.stringify(dir)});\n` +
        `process.stdout.write(String(Date.now()));\n`,
    );
    // Held by this (live) process, freshly.
    writeFileSync(lockPath(), `${process.pid} ${Date.now()}`);
    let out = '';
    const done = new Promise<void>((resolve, reject) => {
      const child = spawn('npx', ['tsx', script], { stdio: ['ignore', 'pipe', 'ignore'] });
      child.stdout.on('data', (d) => (out += d));
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    });
    await new Promise((r) => setTimeout(r, 3_000));
    const releasedAt = Date.now();
    unlinkSync(lockPath());
    await done;
    expect(Number(out)).toBeGreaterThanOrEqual(releasedAt);
    expect(readManifest(root, dir)!.files).toEqual({ 'b.md': 'sha256:b' });
  }, 60_000);
});
