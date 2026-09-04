import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from '../src/install/atomic.js';

/**
 * M7, narrowed. Concurrent runs are still not serialised — two runs that both
 * read a manifest and both write it still lose one set of updates. What this
 * removes is the worse half: a reader seeing a half-written manifest, which
 * makes `readManifest` throw, which is treated as "no manifest", which makes a
 * re-install lose every "I own this file" record it should have honoured.
 */
describe('writeFileAtomic', () => {
  it('writes the content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jig-atomic-'));
    writeFileAtomic(join(dir, 'a.json'), '{"a":1}\n');
    expect(readFileSync(join(dir, 'a.json'), 'utf8')).toBe('{"a":1}\n');
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates missing parent directories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jig-atomic-'));
    writeFileAtomic(join(dir, 'deep', 'nested', 'a.json'), 'x');
    expect(existsSync(join(dir, 'deep', 'nested', 'a.json'))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('leaves no temp file behind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jig-atomic-'));
    writeFileAtomic(join(dir, 'a.json'), 'x');
    expect(readdirSync(dir)).toEqual(['a.json']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('replaces an existing file rather than appending to it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jig-atomic-'));
    writeFileAtomic(join(dir, 'a.json'), 'first');
    writeFileAtomic(join(dir, 'a.json'), 'second');
    expect(readFileSync(join(dir, 'a.json'), 'utf8')).toBe('second');
    rmSync(dir, { recursive: true, force: true });
  });

  it('cleans up its temp file when the write fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jig-atomic-'));
    // A directory where the target file should be: the rename fails.
    mkdirSync(join(dir, 'a.json'));
    expect(() => writeFileAtomic(join(dir, 'a.json'), 'x')).toThrow();
    expect(readdirSync(dir), 'a temp file was orphaned').toEqual(['a.json']);
    rmSync(dir, { recursive: true, force: true });
  });
});
