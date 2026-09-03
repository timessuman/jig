import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTokenMap } from '../src/check/tokens.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-check-tokens-'));
  mkdirSync(join(root, '.jig', 'tokens'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loadTokenMap', () => {
  it('reads custom properties from the top-level :root block only', () => {
    writeFileSync(
      join(root, '.jig', 'tokens', 'brand.default.css'),
      [
        ':root {',
        '  --brand-h: 264;',
        '  --color-brand: hsl(var(--brand-h) 0% 15%);',
        '}',
        '@media (prefers-color-scheme: dark) {',
        '  :root:not([data-theme="light"]) {',
        '    --color-brand: hsl(264 0% 88%);',
        '  }',
        '}',
      ].join('\n'),
    );
    const tokens = loadTokenMap(root);
    expect(tokens['brand-h']).toBe('264');
    // the dark-mode override must NOT win — only the light :root is read
    expect(tokens['color-brand']).toBe('hsl(var(--brand-h) 0% 15%)');
  });

  it('returns an empty map when there is no tokens directory', () => {
    rmSync(join(root, '.jig', 'tokens'), { recursive: true, force: true });
    expect(loadTokenMap(root)).toEqual({});
  });
});
