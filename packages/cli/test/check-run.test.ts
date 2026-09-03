import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runChecks } from '../src/check/run.js';
import type { IndexEntry } from '../src/rules/schema.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-check-run-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// C1: runChecks masks comments exactly once, before handing source to every
// detector — so a violation that only exists inside a comment must not
// fire, and a commented-out `:focus-visible` must not silence a real
// `outline: none` elsewhere in the same file.
describe('runChecks masks comments before handing source to detectors', () => {
  const index: IndexEntry[] = [
    { id: 'E-29', bucket: 'mechanical', severity: 'error', detector: 'focus-removed', since: '0.1.0' },
    { id: 'A-01', bucket: 'hybrid', severity: 'warning', detector: 'violet-band-hue', since: '0.1.0' },
  ];

  it('produces zero findings for a file whose only violations are inside a comment', () => {
    writeFileSync(
      join(root, 'a.css'),
      [
        '@import ".jig/tokens/brand.default.css";',
        '/* Legacy palette, superseded:',
        '   brand was #6366f1. We used to do `outline: none;` on inputs. */',
        '.real { color: var(--color-text-strong); }',
        '',
      ].join('\n'),
    );

    const findings = runChecks(root, ['a.css'], index, {});
    expect(findings).toHaveLength(0);
  });

  it('does not let a commented-out :focus-visible silence a real outline: none', () => {
    writeFileSync(
      join(root, 'a.css'),
      ['/* button:focus-visible { outline: 2px solid blue; } */', '.button {', '  outline: none;', '}', ''].join(
        '\n',
      ),
    );

    const findings = runChecks(root, ['a.css'], index, {});
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('E-29');
  });
});
