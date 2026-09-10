import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditTokenLayer } from '../src/check/token-audit.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * Nothing shipped validated the token layer's own declarations.
 *
 * `init` checks the brand colour once, at write time, and after that no
 * command looks again. `check` validates how tokens are USED in a project's
 * CSS; it never reads the tokens themselves — `.jig/tokens/` is not in the
 * scanned set. So a brand file edited afterwards, by a human or an agent, went
 * unexamined: `--color-text-weak` dropped to 22% opacity and `check` reported
 * "No findings".
 *
 * That is the hole. It is not really an argument about who writes the tokens —
 * it is that whoever writes them, nothing checks the result. The floors here
 * are the ones the token layer itself claims: 4.5:1 for text, 3:1 for
 * interface strokes, in BOTH themes, plus the two numeric floors that are
 * accessibility limits rather than density settings.
 */
let project: string;

const tokensDir = () => join(project, '.jig', 'tokens');
const writeBrand = (content: string) =>
  writeFileSync(join(tokensDir(), 'brand.test.css'), content);

/** The real shipped brand file, which must pass its own contract. */
const realBrand = () => readFileSync(join(repoRoot, 'tokens', 'brand.default.css'), 'utf8');

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-token-audit-'));
  mkdirSync(tokensDir(), { recursive: true });
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

describe('the shipped token layer passes its own contract', () => {
  it('reports nothing for the brand file Jig generates', () => {
    writeBrand(realBrand());
    cpSync(join(repoRoot, 'tokens', 'mode.product.css'), join(tokensDir(), 'mode.product.css'));
    expect(auditTokenLayer(project)).toEqual([]);
  });

  it('reports nothing when there is no token layer at all', () => {
    rmSync(join(project, '.jig'), { recursive: true, force: true });
    expect(auditTokenLayer(project)).toEqual([]);
  });
});

describe('a foreground below its floor is caught', () => {
  it('catches the exact edit that used to pass — text-weak at 22%', () => {
    writeBrand(realBrand().replace('--color-text-weak:     rgb(0 0 0 / 60%)',
                                   '--color-text-weak:     rgb(0 0 0 / 22%)'));
    const problems = auditTokenLayer(project);
    expect(problems.length, 'a failing foreground was not reported').toBeGreaterThan(0);
    expect(problems.some((p) => p.token === '--color-text-weak')).toBe(true);
    expect(problems[0].ratio).toBeLessThan(4.5);
    expect(problems[0].floor).toBe(4.5);
  });

  it('names the surface it fails against, not just the token', () => {
    writeBrand(realBrand().replace('--color-text-weak:     rgb(0 0 0 / 60%)',
                                   '--color-text-weak:     rgb(0 0 0 / 22%)'));
    expect(auditTokenLayer(project)[0].surface).toMatch(/--color-(bg|fill)/);
  });

  it('holds interface strokes to 3:1, not 4.5:1', () => {
    // A stroke at 3.5:1 is conformant and must NOT be reported; the same value
    // used as text would be a failure. Reporting a passing value is the way a
    // check like this loses its reader.
    writeBrand(realBrand().replace('--color-stroke-strong: rgb(0 0 0 / 60%)',
                                   '--color-stroke-strong: rgb(0 0 0 / 38%)'));
    const strokes = auditTokenLayer(project).filter((p) => p.token.includes('stroke'));
    for (const s of strokes) expect(s.floor).toBe(3);
  });
});

describe('dark mode is checked, not assumed', () => {
  it('catches a dark-mode foreground that fails on the dark surface', () => {
    // The half that is easiest to break and hardest to notice: it looks
    // correct until someone switches theme.
    writeBrand(realBrand().replace(/--color-text-weak:\s+rgb\(255 255 255 \/ 78%\)/g,
                                   '--color-text-weak:     rgb(255 255 255 / 14%)'));
    const dark = auditTokenLayer(project).filter((p) => p.theme === 'dark');
    expect(dark.length, 'no dark-mode failure reported').toBeGreaterThan(0);
  });

  it('labels which theme each problem is in', () => {
    writeBrand(realBrand().replace('--color-text-weak:     rgb(0 0 0 / 60%)',
                                   '--color-text-weak:     rgb(0 0 0 / 22%)'));
    expect(auditTokenLayer(project).every((p) => p.theme === 'light' || p.theme === 'dark')).toBe(true);
  });
});

describe('the numeric accessibility floors', () => {
  it('catches prose type below 18px', () => {
    writeBrand(realBrand());
    writeFileSync(join(tokensDir(), 'mode.custom.css'),
      ':root { --text-prose: 15px; }\n');
    const problems = auditTokenLayer(project);
    expect(problems.some((p) => p.token === '--text-prose')).toBe(true);
  });

  it('catches a touch target below 48px', () => {
    writeBrand(realBrand());
    writeFileSync(join(tokensDir(), 'mode.custom.css'),
      ':root { --size-touch-target: 32px; }\n');
    expect(auditTokenLayer(project).some((p) => p.token === '--size-touch-target')).toBe(true);
  });

  it('does not flag a density value, which is not a floor', () => {
    writeBrand(realBrand());
    writeFileSync(join(tokensDir(), 'mode.custom.css'),
      ':root { --size-control: 28px; --text-caption: 11px; }\n');
    const problems = auditTokenLayer(project);
    expect(problems.map((p) => p.token)).not.toContain('--size-control');
    expect(problems.map((p) => p.token)).not.toContain('--text-caption');
  });
});

describe('what it refuses to guess about', () => {
  it('says nothing about a value it cannot resolve', () => {
    writeBrand(':root {\n  --color-text-strong: var(--something-else);\n  --color-bg-base: #fff;\n}\n');
    expect(auditTokenLayer(project)).toEqual([]);
  });

  it('reports a line number in the file the token is declared in', () => {
    writeBrand(realBrand().replace('--color-text-weak:     rgb(0 0 0 / 60%)',
                                   '--color-text-weak:     rgb(0 0 0 / 22%)'));
    const p = auditTokenLayer(project)[0];
    expect(p.file).toContain('brand.test.css');
    expect(p.line).toBeGreaterThan(0);
  });
});
