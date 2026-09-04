import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
 * The fix is not a lock. The `files` map is additive and per-file — each run
 * only records entries for files it actually wrote — so merging against
 * whatever is on disk AT WRITE TIME is both correct and free of the stale-lock
 * recovery a mutex would need after a crash.
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
    // Ten writers running AT THE SAME TIME, five writes each, every one
    // recording a distinct file. All ten entries must survive — this is exactly
    // what last-writer-wins loses, and it is the only assertion here that
    // exercises real concurrency rather than a simulated interleaving.
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
        `for (let n = 0; n < 5; n++) {\n` +
        `  writeManifest(${JSON.stringify(root)}, { version: '0.4.0', agent: 'claude',\n` +
        `    scope: 'project', installedAt: new Date().toISOString(),\n` +
        `    files: { ['f' + i + '.md']: 'sha256:' + i } }, ${JSON.stringify(dir)});\n` +
        `}\n`,
    );

    await Promise.all(
      Array.from(
        { length: 10 },
        (_, i) =>
          new Promise<void>((resolve, reject) => {
            const child = spawn('npx', ['tsx', script, String(i)], { stdio: 'ignore' });
            child.on('error', reject);
            child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
          }),
      ),
    );

    const files = Object.keys(readManifest(root, dir)!.files).sort();
    expect(files, `lost entries — got ${files.join(', ')}`).toHaveLength(10);
  }, 60_000);
});
