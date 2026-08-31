import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findProjectRoot, assetRoot } from '../src/paths.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'jig-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('findProjectRoot', () => {
  it('finds the directory containing package.json', () => {
    writeFileSync(join(dir, 'package.json'), '{}');
    const nested = join(dir, 'src', 'components');
    mkdirSync(nested, { recursive: true });
    expect(findProjectRoot(nested)).toBe(dir);
  });

  it('finds a directory containing jig.config.json', () => {
    writeFileSync(join(dir, 'jig.config.json'), '{}');
    expect(findProjectRoot(dir)).toBe(dir);
  });

  it('returns the start directory when no marker is found', () => {
    const nested = join(dir, 'empty');
    mkdirSync(nested);
    expect(findProjectRoot(nested)).toBe(nested);
  });
});

describe('assetRoot', () => {
  it('finds an ancestor containing rules.index.json', () => {
    writeFileSync(join(dir, 'rules.index.json'), '{}');
    const nested = join(dir, 'packages', 'cli');
    mkdirSync(nested, { recursive: true });
    expect(assetRoot(nested)).toBe(dir);
  });

  it('throws a helpful error when no ancestor has rules.index.json', () => {
    const nested = join(dir, 'packages', 'cli');
    mkdirSync(nested, { recursive: true });
    expect(() => assetRoot(nested)).toThrow(/rules\.index\.json/);
  });
});
