import { describe, it, expect } from 'vitest';
import { participatesInTokenLayer } from '../src/check/token-layer.js';
import { formatReport } from '../src/check/report.js';
import type { Finding } from '../src/check/types.js';

const TOKENS = { 'color-brand': '#000', 'spacing-m': '24px' };

describe('participatesInTokenLayer', () => {
  it('is false for a file that references no Jig token', () => {
    expect(participatesInTokenLayer('.a { padding: 12px; color: #fff; }', TOKENS)).toBe(false);
  });

  it('is true when the file uses a known token', () => {
    expect(participatesInTokenLayer('.a { padding: var(--spacing-m); }', TOKENS)).toBe(true);
  });

  it('is false for a var() that is not a Jig token', () => {
    expect(participatesInTokenLayer('.a { padding: var(--their-own-thing); }', TOKENS)).toBe(false);
  });

  it('is true when the file imports a vendored token file', () => {
    expect(participatesInTokenLayer('@import ".jig/tokens/brand.default.css";', TOKENS)).toBe(true);
  });
});

function finding(n: number, file = 'a.css'): Finding {
  return {
    ruleId: 'H-47', detector: 'hardcoded-value', bucket: 'mechanical',
    severity: 'error', file, line: n, message: `hard-coded ${n}px`,
  };
}

describe('formatReport grouping', () => {
  it('collapses a run of one rule in one file after three rows', () => {
    const out = formatReport([1, 2, 3, 4, 5].map((n) => finding(n)), { totalRules: 104, version: '0.0.0' });
    expect(out).toContain('… 2 more H-47 in a.css');
    expect(out).toContain('hard-coded 3px');
    expect(out).not.toContain('hard-coded 4px');
  });

  it('does not collapse when the same rule spans different files', () => {
    const out = formatReport(
      [finding(1, 'a.css'), finding(2, 'b.css'), finding(3, 'c.css'), finding(4, 'd.css')],
      { totalRules: 104, version: '0.0.0' },
    );
    expect(out).not.toContain('more H-47');
  });

  it('explains why H-47 did not run when no file adopted the token layer', () => {
    const out = formatReport([], { totalRules: 104, version: '0.0.0', noTokenLayer: true });
    expect(out).toContain('No file references a Jig token');
    expect(out).toContain("jig init");
  });

  it('stays quiet about the token layer when files have adopted it', () => {
    const out = formatReport([], { totalRules: 104, version: '0.0.0', noTokenLayer: false });
    expect(out).toContain('No findings.');
    expect(out).not.toContain('No file references a Jig token');
  });
});

describe('loadTokenMap survives a leading comment', () => {
  it('finds :root tokens in a file that opens with an attribution comment', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { loadTokenMap } = await import('../src/check/tokens.js');

    const root = mkdtempSync(join(tmpdir(), 'jig-tok-'));
    mkdirSync(join(root, '.jig', 'tokens'), { recursive: true });
    // Every vendored token file opens with exactly this shape. Before
    // maskComments the brace scanner folded the comment into the selector,
    // so ':root' never matched and the map came back empty — silently
    // disabling contrast-floor and the var() participation check.
    writeFileSync(
      join(root, '.jig', 'tokens', 'brand.default.css'),
      '/* brand.default.css — vendored from Jig v0.0.0.\n   Licensed Apache-2.0. */\n\n:root {\n  --color-brand: #123456;\n}\n',
    );

    const tokens = loadTokenMap(root);
    expect(tokens['color-brand']).toBe('#123456');
  });
});
