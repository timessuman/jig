import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../src/commands/install.js';
import { check } from '../src/commands/check.js';

let project: string;
let pkg: string;
let home: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-check-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-check-pkg-'));
  home = mkdtempSync(join(tmpdir(), 'jig-check-home-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  mkdirSync(join(pkg, 'tokens'), { recursive: true });

  for (const t of ['brand.default.css', 'mode.editorial.css', 'mode.product.css', 'mode.operator.css']) {
    writeFileSync(join(pkg, 'tokens', t), `:root { --from: ${t}; }\n`);
  }
  writeFileSync(
    join(pkg, 'rules', '00-anti-patterns.md'),
    [
      '### E-29 Focus removed without replacement',
      '❌ `outline: none` with nothing in its place',
      '✅ A `:focus-visible` rule with a visible indicator.',
      '',
      '### H-47 Values invented at the call site',
      '❌ A raw colour or px value where a token exists',
      '✅ Reference the matching `--color-*` / `--spacing-*` token.',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(pkg, 'rules.index.json'),
    JSON.stringify([
      { id: 'E-29', bucket: 'mechanical', severity: 'error', detector: 'focus-removed', since: '0.1.0' },
      { id: 'H-47', bucket: 'mechanical', severity: 'error', detector: 'hardcoded-value', since: '0.1.0' },
    ]),
  );
  writeFileSync(
    join(pkg, 'templates', 'SKILL.md.tmpl'),
    '{{command_prefix}}{{config_file}}{{available_commands}}{{ask_instruction}}{{scripts_path}} Rules at {{rules_path}}/00-anti-patterns.md.',
  );
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'), JSON.stringify({}));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig');
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(pkg, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe('check — end to end', () => {
  it('installs into a temp project, then finds two real violations in a written file', () => {
    install({ agent: 'claude', scope: 'project', projectRoot: project, packageRoot: pkg, version: '0.1.0', homeDir: home });

    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(
      join(project, 'src', 'Button.css'),
      ['.button {', '  outline: none;', '  color: #6D28D9;', '}', ''].join('\n'),
    );

    const result = check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: false });

    expect(result.findings).toHaveLength(2);
    const ruleIds = result.findings.map((f) => f.ruleId).sort();
    expect(ruleIds).toEqual(['E-29', 'H-47']);
    expect(result.findings.every((f) => f.file === 'src/Button.css')).toBe(true);
    expect(result.hasError).toBe(true);
    expect(result.report).toContain('E-29');
    expect(result.report).toContain('H-47');
    expect(result.report).toContain('src/Button.css');
    expect(result.report).toContain('2 errors');
    expect(result.report).toContain('mechanical=fail:2');
  });

  it('throws a clear error naming jig install when Jig is not installed', () => {
    expect(() => check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: false })).toThrow(
      /jig install/i,
    );
  });

  it('--ci restricts to the mechanical bucket and is what a caller checks for a non-zero exit', () => {
    install({ agent: 'claude', scope: 'project', projectRoot: project, packageRoot: pkg, version: '0.1.0', homeDir: home });
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'Button.css'), '.button {\n  outline: none;\n}\n');

    const result = check({ projectRoot: project, homeDir: home, version: '0.1.0', all: true, ci: true });
    expect(result.hasError).toBe(true);
    expect(result.findings.every((f) => f.bucket === 'mechanical')).toBe(true);
  });
});
