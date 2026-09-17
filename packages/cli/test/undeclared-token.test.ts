import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { undeclaredToken } from '../src/check/detectors/undeclared-token.js';
import { collectDeclaredProperties, isTailwindDefault } from '../src/check/declared-properties.js';
import { modeWiringProblems } from '../src/check/mode-wiring.js';
import { formatReport } from '../src/check/report.js';
import type { DetectorContext } from '../src/check/types.js';

const ctx = (raw: string, names: string[], extra: { tailwind?: boolean; complete?: boolean } = {}): DetectorContext => ({
  ruleId: 'H-117', bucket: 'mechanical', severity: 'error', tokens: {}, projectParticipates: true, raw,
  declaredProperties: { names: new Set(names), tailwind: extra.tailwind ?? false, complete: extra.complete ?? true },
});
const run = (css: string, names: string[], extra = {}) => undeclaredToken.run(css, 'a.css', ctx(css, names, extra));

describe('undeclared-token (H-117)', () => {
  // The arm-test-3 page: rendered in Times New Roman with no spacing.
  it('reports a var() naming a property nothing declares, on its line', () => {
    const css = 'body {\n  font-family: var(--font-body);\n  color: var(--color-text-strong);\n}';
    const f = run(css, ['--color-text-strong']);
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(2);
    expect(f[0].message).toMatch(/--font-body is not declared/);
  });

  it('does not report a reference with a fallback, which resolves', () => {
    expect(run('a { padding: var(--space-lg, 1rem); }', [])).toHaveLength(0);
  });

  it('reads Tailwind v4 class references too', () => {
    const html = '<div class="p-(--space-lg) bg-[var(--color-bg)]"></div>';
    const f = undeclaredToken.run('', 'a.html', ctx(html, []));
    expect(f.map((x) => x.message.split(' ')[0]).sort()).toEqual(['--color-bg', '--space-lg']);
  });

  it("allows Tailwind's default theme names only when the project imports Tailwind", () => {
    expect(run('a { color: var(--color-red-500); }', [], { tailwind: true })).toHaveLength(0);
    expect(run('a { color: var(--color-red-500); }', [])).toHaveLength(1);
    // Not a Tailwind default: the name an agent invents.
    expect(isTailwindDefault('--color-text-primary')).toBe(false);
    expect(isTailwindDefault('--text-sm')).toBe(true);
  });

  it('is silent when the declarations are incomplete or were never computed', () => {
    expect(run('a { color: var(--x); }', [], { complete: false })).toHaveLength(0);
    const bare: DetectorContext = { ruleId: 'H-117', bucket: 'mechanical', severity: 'error', tokens: {}, projectParticipates: true, raw: '' };
    expect(undeclaredToken.run('a { color: var(--x); }', 'a.css', bare)).toHaveLength(0);
  });
});

describe('collectDeclaredProperties', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'jig-decl-')); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('collects stylesheet, @theme, style attribute, JSX and setProperty declarations, plus token names', () => {
    writeFileSync(join(root, 'a.css'), ':root { --a: 1; }\n@theme { --color-ink: red; }\n@property --b { syntax: "*"; }');
    writeFileSync(join(root, 'b.html'), '<div style="--c: 2"></div><script>el.style.setProperty("--d", 1)</script>');
    writeFileSync(join(root, 'c.tsx'), 'const s = { "--e": 3 };');
    const d = collectDeclaredProperties(root, ['a.css', 'b.html', 'c.tsx'], ['color-text-strong']);
    for (const n of ['--a', '--color-ink', '--b', '--c', '--d', '--e', '--color-text-strong']) expect(d.names.has(n), n).toBe(true);
    expect(d.complete).toBe(true);
  });

  it('marks the set incomplete when a package import cannot be read, and reads one that can', () => {
    writeFileSync(join(root, 'a.css'), '@import "tailwindcss";\n@import "missing-lib/theme.css";');
    expect(collectDeclaredProperties(root, ['a.css'])).toMatchObject({ tailwind: true, complete: false });
    mkdirSync(join(root, 'node_modules', 'lib'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'lib', 'theme.css'), ':root { --lib-x: 1; }');
    writeFileSync(join(root, 'a.css'), '@import "lib/theme.css";');
    const d = collectDeclaredProperties(root, ['a.css']);
    expect(d.complete).toBe(true);
    expect(d.names.has('--lib-x')).toBe(true);
  });
});

describe('a hand-edited jig.config.json is reported', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'jig-cfg-')); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const write = (c: unknown) => writeFileSync(join(root, 'jig.config.json'), typeof c === 'string' ? c : JSON.stringify(c));

  it('names a brand that is a directory, surfaces written as an object, and broken JSON', () => {
    mkdirSync(join(root, 'jig'));
    write({ brand: 'jig', surfaces: [{ match: '/', mode: 'editorial' }] });
    expect(modeWiringProblems(root)[0].message).toMatch(/"brand" is "jig"/);
    write({ surfaces: { pricing: 'editorial' } });
    expect(modeWiringProblems(root)[0].message).toMatch(/"surfaces" must be a list/);
    const out = formatReport([], { totalRules: 1, version: 'x', modeUnwired: modeWiringProblems(root) });
    expect(out).toMatch(/Fix jig\.config\.json by hand/);
    write('{ nope');
    expect(modeWiringProblems(root)[0].message).toMatch(/not valid JSON/);
  });

  it('accepts the shape init writes', () => {
    write({ surfaces: [{ match: '/', mode: 'editorial' }] });
    expect(modeWiringProblems(root)).toEqual([]);
  });
});
