import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checksum, readManifest, writeManifest, isModified, type Manifest } from '../src/install/manifest.js';
import { Buffer } from 'node:buffer';

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
  it('normalizes CRLF to LF', () => {
    expect(checksum('a\r\nb')).toBe(checksum('a\nb'));
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
  it('normalizes line endings when comparing checksums', () => {
    // Write file with CRLF bytes to disk
    const crlfContent = Buffer.from('line1\r\nline2\r\n');
    writeFileSync(join(dir, '.jig', 'crlf.txt'), crlfContent);
    // Manifest recorded the LF version
    const m = { ...base, files: { '.jig/crlf.txt': checksum('line1\nline2\n') } };
    // Should not be considered modified even though bytes differ
    expect(isModified(dir, '.jig/crlf.txt', m)).toBe(false);
  });
});

// --- C3, part 2: manifest.json can live inside a shared, version-controlled
// repository, so it must be validated on read rather than trusted at face
// value — a syntax error or a structurally wrong file must fail loudly and
// actionably, not surface a raw JSON.parse error or a downstream "Cannot
// read properties of undefined". ---
describe('readManifest validation (C3)', () => {
  const manifestPath = () => join(dir, '.jig', 'manifest.json');

  it('accepts a well-formed manifest', () => {
    writeManifest(dir, base);
    expect(readManifest(dir)?.agent).toBe('claude');
  });

  it('throws a clear, actionable error on malformed JSON', () => {
    writeFileSync(manifestPath(), 'not json');
    expect(() => readManifest(dir)).toThrow(/not valid JSON/i);
    expect(() => readManifest(dir)).toThrow(/jig install/i);
  });

  it('throws a clear, actionable error on an empty object', () => {
    writeFileSync(manifestPath(), '{}');
    expect(() => readManifest(dir)).toThrow(/invalid|corrupted/i);
    expect(() => readManifest(dir)).toThrow(/jig install/i);
  });

  it('rejects a scope that is neither project nor global', () => {
    writeFileSync(manifestPath(), JSON.stringify({ ...base, scope: 'bogus' }));
    expect(() => readManifest(dir)).toThrow(/jig install/i);
  });

  it('rejects a non-string version/agent/installedAt field', () => {
    writeFileSync(manifestPath(), JSON.stringify({ ...base, version: 1 }));
    expect(() => readManifest(dir)).toThrow(/jig install/i);
  });

  it('rejects a manifest whose files value is not a string', () => {
    writeFileSync(manifestPath(), JSON.stringify({ ...base, files: { 'a.md': 123 } }));
    expect(() => readManifest(dir)).toThrow(/jig install/i);
  });

  it('rejects a manifest with a `..` segment in a file key', () => {
    writeFileSync(manifestPath(), JSON.stringify({ ...base, files: { '../../etc/passwd': checksum('x') } }));
    expect(() => readManifest(dir)).toThrow(/jig install/i);
  });

  it('rejects a manifest with an absolute (POSIX) file key', () => {
    writeFileSync(manifestPath(), JSON.stringify({ ...base, files: { '/etc/passwd': checksum('x') } }));
    expect(() => readManifest(dir)).toThrow(/jig install/i);
  });

  it('rejects a manifest with a drive-prefixed file key', () => {
    writeFileSync(manifestPath(), JSON.stringify({ ...base, files: { 'C:\\evil.md': checksum('x') } }));
    expect(() => readManifest(dir)).toThrow(/jig install/i);
  });
});
