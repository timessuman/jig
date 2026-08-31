import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checksum, readManifest, writeManifest, isModified, type Manifest } from '../src/install/manifest.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'jig-')); mkdirSync(join(dir, '.jig'), { recursive: true }); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const base: Manifest = {
  version: '0.1.0', agent: 'claude', scope: 'project',
  installedAt: '2026-08-31T00:00:00.000Z', files: {},
};

describe('checksum', () => {
  it('is stable for identical content', () => {
    expect(checksum('hello')).toBe(checksum('hello'));
  });
  it('differs for different content', () => {
    expect(checksum('hello')).not.toBe(checksum('world'));
  });
  it('is prefixed with the algorithm', () => {
    expect(checksum('hello')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('readManifest / writeManifest', () => {
  it('returns null when no manifest exists', () => {
    expect(readManifest(dir)).toBeNull();
  });
  it('round-trips a manifest', () => {
    writeManifest(dir, base);
    expect(existsSync(join(dir, '.jig', 'manifest.json'))).toBe(true);
    expect(readManifest(dir)?.agent).toBe('claude');
  });
});

describe('isModified', () => {
  it('is false when the file matches its checksum', () => {
    writeFileSync(join(dir, '.jig', 'a.md'), 'original');
    const m = { ...base, files: { '.jig/a.md': checksum('original') } };
    expect(isModified(dir, '.jig/a.md', m)).toBe(false);
  });
  it('is true when the file has been edited', () => {
    writeFileSync(join(dir, '.jig', 'a.md'), 'edited by the user');
    const m = { ...base, files: { '.jig/a.md': checksum('original') } };
    expect(isModified(dir, '.jig/a.md', m)).toBe(true);
  });
  it('is false when the file is not in the manifest', () => {
    writeFileSync(join(dir, '.jig', 'b.md'), 'new');
    expect(isModified(dir, '.jig/b.md', base)).toBe(false);
  });
  it('is false when the file is missing from disk', () => {
    const m = { ...base, files: { '.jig/gone.md': checksum('x') } };
    expect(isModified(dir, '.jig/gone.md', m)).toBe(false);
  });
});
