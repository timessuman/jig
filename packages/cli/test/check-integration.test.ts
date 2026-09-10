import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check } from '../src/commands/check.js';

let project: string;
let home: string;

// check reads rules from the CLI's own bundled assets (`assetRoot()`), which
// resolve to the real repo root in this dev checkout — see `paths.ts`. No
// `install`/`init` fixture is needed for the mechanical/hybrid rules
// themselves any more; only project state (tokens) still comes from the
// project.
beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-check-proj-'));
  home = mkdtempSync(join(tmpdir(), 'jig-check-home-'));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe('check — end to end', () => {
  it('finds real violations in a written file, with no install or init required', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(
      join(project, 'src', 'Button.css'),
      ['.button {', '  outline: none;', '  color: #6D28D9;', '}', ''].join('\n'),
    );

    const result = check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: false });

    const ruleIds = new Set(result.findings.map((f) => f.ruleId));
    expect(ruleIds.has('E-29')).toBe(true); // outline: none with nothing in its place
    expect(result.findings.every((f) => f.file === 'src/Button.css')).toBe(true);
    expect(result.hasError).toBe(true);
    expect(result.report).toContain('E-29');
    expect(result.report).toContain('src/Button.css');
  });

  it('works on a project with no .jig/ at all — no install, no init', () => {
    expect(existsSync(join(project, '.jig'))).toBe(false);
    const result = check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: false });
    expect(result.report).toMatch(/\d+ rules(?: \(\+ \d+ pattern and mode specs\))?,/);
  });

  it('--ci restricts to the mechanical bucket and is what a caller checks for a non-zero exit', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'Button.css'), '.button {\n  outline: none;\n}\n');

    const result = check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: true });
    expect(result.hasError).toBe(true);
    expect(result.findings.every((f) => f.bucket === 'mechanical')).toBe(true);
  });
});

// --- Migration: check must keep reading a legacy project rules.index.json
// (vendored there by a pre-0.4.0 `install`) for one minor version, so an
// un-migrated project does not break on upgrade. ---
describe('check — legacy .jig/rules.index.json compatibility', () => {
  it('prefers a legacy project rules.index.json over the bundled one when present', () => {
    mkdirSync(join(project, '.jig'), { recursive: true });
    writeFileSync(
      join(project, '.jig', 'rules.index.json'),
      JSON.stringify([{ id: 'E-29', bucket: 'mechanical', severity: 'error', detector: 'focus-removed', since: '0.1.0' }]),
    );
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'Button.css'), '.button {\n  outline: none;\n}\n');

    const result = check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: false });

    // Only the one legacy-index rule could have fired — this proves the
    // legacy index (not the bundled ~104-rule one) is what got read.
    expect(result.findings.every((f) => f.ruleId === 'E-29')).toBe(true);
    // The rule COUNT is the legacy index's; the spec count beside it comes from
    // the CLI's own bundle, since specs describe the system rather than
    // whatever a project vendored.
    expect(result.report).toMatch(/1 rules(?: \(\+ \d+ pattern and mode specs\))?, 1 fired/);
  });
});

/**
 * I5, end to end. The unit tests in `consumer-tokens.test.ts` prove the token
 * map now holds a project's own custom properties; this proves a detector
 * actually fires on one, which is the part a user sees.
 *
 * Before this, a project that declared its greys itself — i.e. any project that
 * had not run `jig init` — got "no findings" from `contrast-floor` no matter
 * what those greys were, because every `var(--muted)` was unresolvable and
 * unresolvable values are skipped.
 */
describe('check resolves the project’s own tokens (I5)', () => {
  it('reports a contrast failure on a grey the project declared itself', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(
      join(project, 'src', 'theme.css'),
      ':root {\n  --muted: #b0b0b0;\n  --page: #ffffff;\n}\n',
    );
    writeFileSync(
      join(project, 'src', 'Caption.css'),
      '.caption {\n  color: var(--muted);\n  background: var(--page);\n}\n',
    );

    const result = check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: false });

    const contrast = result.findings.filter((f) => f.ruleId === 'C-19');
    expect(contrast.length, 'no contrast finding — the consumer token did not resolve')
      .toBeGreaterThan(0);
    expect(contrast.some((f) => f.file === 'src/Caption.css')).toBe(true);
  });

  it('says nothing when the same token is declared two different ways', () => {
    // Ambiguous rather than wrong: which value applies depends on import order.
    // A reported finding against a value the page never renders costs more than
    // a missed one.
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'a.css'), ':root { --muted: #b0b0b0; }\n');
    writeFileSync(join(project, 'src', 'b.css'), ':root { --muted: #595959; }\n');
    writeFileSync(
      join(project, 'src', 'Caption.css'),
      '.caption {\n  color: var(--muted);\n  background: #ffffff;\n}\n',
    );

    const result = check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: false });
    expect(result.findings.filter((f) => f.ruleId === 'C-19' && f.file === 'src/Caption.css'))
      .toHaveLength(0);
  });
});
