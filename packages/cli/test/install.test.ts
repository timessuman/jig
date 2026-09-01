import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install, upsertBlock, vendorHeader } from '../src/commands/install.js';
import { readManifest } from '../src/install/manifest.js';
import { BLOCK_START, BLOCK_END } from '../src/adapters/types.js';

let project: string;
let pkg: string;
let home: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  home = mkdtempSync(join(tmpdir(), 'jig-home-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  mkdirSync(join(pkg, 'tokens'), { recursive: true });
  for (const t of ['brand.default.css', 'mode.editorial.css', 'mode.product.css', 'mode.operator.css']) {
    writeFileSync(join(pkg, 'tokens', t), `:root { --from: ${t}; }\n`);
  }
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n❌ bad\n✅ good\n');
  writeFileSync(join(pkg, 'rules.index.json'),
    JSON.stringify([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' }]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
    'Use {{command_prefix}}check. Config {{config_file}}. Rules at {{rules_path}}/00-anti-patterns.md.\n{{available_commands}}\n{{ask_instruction}}\n{{scripts_path}}');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'),
    JSON.stringify({ check: { description: 'Check.', argumentHint: '[target]' } }));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig\nCopyright ...');
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(pkg, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

const opts = () => ({
  agent: 'claude',
  scope: 'project' as const,
  projectRoot: project,
  packageRoot: pkg,
  version: '0.1.0',
  homeDir: home,
});

describe('upsertBlock', () => {
  const block = '<!-- jig:start -->\nNEW\n<!-- jig:end -->\n';

  it('appends when no markers exist', () => {
    expect(upsertBlock('# My agents file\n', block)).toContain('# My agents file');
    expect(upsertBlock('# My agents file\n', block)).toContain('NEW');
  });

  it('replaces between markers, preserving surrounding content', () => {
    const existing = '# Mine\n\n<!-- jig:start -->\nOLD\n<!-- jig:end -->\n\n# After\n';
    const out = upsertBlock(existing, block);
    expect(out).toContain('# Mine');
    expect(out).toContain('# After');
    expect(out).toContain('NEW');
    expect(out).not.toContain('OLD');
  });

  it('does not duplicate the block on repeat application', () => {
    const once = upsertBlock('', block);
    const twice = upsertBlock(once, block);
    expect(twice.match(/jig:start/g)).toHaveLength(1);
  });

  // --- Fix 3: malformed pre-existing markers must still converge on exactly
  // one clean block, with surrounding text preserved. ---

  it('cleans up an orphan start marker with no end marker', () => {
    const existing = '# Mine\n\n<!-- jig:start -->\nOLD\n';
    const out = upsertBlock(existing, block);
    expect(out.match(/jig:start/g)).toHaveLength(1);
    expect(out.match(/jig:end/g)).toHaveLength(1);
    expect(out.indexOf('jig:start')).toBeLessThan(out.indexOf('jig:end'));
    expect(out).toContain('# Mine');
    expect(out).not.toContain('OLD');
    expect(out).toContain('NEW');
  });

  it('cleans up an end marker that appears before any start marker', () => {
    const existing = '# Mine\n\n<!-- jig:end -->\n<!-- jig:start -->\nOLD\n';
    const out = upsertBlock(existing, block);
    expect(out.match(/jig:start/g)).toHaveLength(1);
    expect(out.match(/jig:end/g)).toHaveLength(1);
    expect(out.indexOf('jig:start')).toBeLessThan(out.indexOf('jig:end'));
    expect(out).toContain('# Mine');
    expect(out).not.toContain('OLD');
    expect(out).toContain('NEW');
  });

  it('collapses an already-duplicated block pair into one', () => {
    const existing =
      '# Mine\n\n<!-- jig:start -->\nOLD1\n<!-- jig:end -->\n\n' +
      '<!-- jig:start -->\nOLD2\n<!-- jig:end -->\n\n# After\n';
    const out = upsertBlock(existing, block);
    expect(out.match(/jig:start/g)).toHaveLength(1);
    expect(out.match(/jig:end/g)).toHaveLength(1);
    expect(out.indexOf('jig:start')).toBeLessThan(out.indexOf('jig:end'));
    expect(out).toContain('# Mine');
    expect(out).toContain('# After');
    expect(out).not.toContain('OLD1');
    expect(out).not.toContain('OLD2');
    expect(out).toContain('NEW');
  });
});

describe('vendorHeader', () => {
  it('names the project, version and licence', () => {
    const h = vendorHeader('00-anti-patterns.md', '0.1.0');
    expect(h).toContain('Jig');
    expect(h).toContain('0.1.0');
    expect(h).toContain('Apache-2.0');
  });
});

describe('install', () => {
  it('vendors rules into .jig/', () => {
    install(opts());
    expect(existsSync(join(project, '.jig', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(project, '.jig', 'rules.index.json'))).toBe(true);
  });

  it('prefixes each vendored rule file with an attribution header', () => {
    install(opts());
    const body = readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8');
    expect(body).toContain('Apache-2.0');
    expect(body).toContain('### A-01 Rule');
  });

  it('writes LICENSE and NOTICE into .jig/', () => {
    install(opts());
    expect(existsSync(join(project, '.jig', 'LICENSE'))).toBe(true);
    expect(existsSync(join(project, '.jig', 'NOTICE'))).toBe(true);
  });

  it('writes the agent skill file', () => {
    install(opts());
    const skill = join(project, '.claude', 'skills', 'jig', 'SKILL.md');
    expect(existsSync(skill)).toBe(true);
    expect(readFileSync(skill, 'utf8')).toContain('/jig check');
  });

  it('records every written file in the manifest with a checksum', () => {
    const result = install(opts());
    const m = readManifest(project)!;
    expect(m.agent).toBe('claude');
    expect(m.version).toBe('0.1.0');
    for (const rel of result.written) {
      if (rel.endsWith('manifest.json')) continue;
      expect(m.files[rel]).toMatch(/^sha256:/);
    }
  });

  it('is idempotent', () => {
    install(opts());
    const first = readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8');
    install(opts());
    expect(readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8')).toBe(first);
  });

  it('rejects an unsupported scope for the adapter', () => {
    expect(() => install({ ...opts(), agent: 'cursor', scope: 'global' }))
      .toThrow(/does not support global/);
  });

  // --- I1: re-running install must not silently destroy a user's edit to a
  // vendored file. The vendor header on every rule file promises exactly
  // this ("`jig update` will not overwrite a file you have changed") and
  // the README's headline instruction is the install line itself, so a
  // second `install` run is a real, common path — not just `update`. ---
  it('does not clobber a locally edited rule file on a second install, and reports it skipped (I1)', () => {
    install(opts());
    const target = join(project, '.jig', '00-anti-patterns.md');
    const edited = `${readFileSync(target, 'utf8')}\n### A-99 My own addition\n`;
    writeFileSync(target, edited);

    const result = install(opts());

    expect(readFileSync(target, 'utf8')).toBe(edited);
    expect(result.skipped).toContain('.jig/00-anti-patterns.md');
    expect(result.written).not.toContain('.jig/00-anti-patterns.md');
  });

  it('still replaces LICENSE and NOTICE on a second install even if they were edited (I1)', () => {
    install(opts());
    writeFileSync(join(project, '.jig', 'NOTICE'), 'tampered');
    writeFileSync(join(pkg, 'NOTICE'), 'Jig v2 NOTICE');

    const result = install(opts());

    expect(readFileSync(join(project, '.jig', 'NOTICE'), 'utf8')).toBe('Jig v2 NOTICE');
    expect(result.skipped).not.toContain('.jig/NOTICE');
  });

  it('preserves existing AGENTS.md content (I3: install must recognize the block via BLOCK_START, not a hardcoded literal)', () => {
    writeFileSync(join(project, 'AGENTS.md'), '# House rules\n\nDo the thing.\n');
    install({ ...opts(), agent: 'codex' });
    const out = readFileSync(join(project, 'AGENTS.md'), 'utf8');
    // If install.ts ever falls back to matching a hardcoded marker literal
    // instead of the BLOCK_START constant that adapters/vendor.ts actually
    // emits, this upsert is skipped and install() overwrites the whole file
    // — losing "# House rules" — instead of merging the block in. Asserting
    // against the constant itself (not a copy-pasted literal) is what makes
    // this test catch that drift.
    expect(out).toContain('# House rules');
    expect(out).toContain(BLOCK_START);
    expect(out).toContain(BLOCK_END);
  });

  it('records manifest keys using forward slashes only (Correction 2)', () => {
    install(opts());
    const m = readManifest(project)!;
    for (const key of Object.keys(m.files)) {
      expect(key).not.toContain('\\');
    }
    // Spot-check a couple of well-known keys are POSIX-style.
    expect(m.files['.jig/00-anti-patterns.md']).toMatch(/^sha256:/);
    expect(m.files['.jig/LICENSE']).toMatch(/^sha256:/);
  });
});

describe('install — scope resolution (Fix 1)', () => {
  it('writes a global-scope install under homeDir, not projectRoot', () => {
    install({ ...opts(), scope: 'global' });
    expect(existsSync(join(home, '.jig', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(home, '.claude', 'skills', 'jig', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(project, '.jig'))).toBe(false);
    expect(existsSync(join(project, '.claude'))).toBe(false);
  });

  it('project-scope install is unaffected by homeDir', () => {
    install(opts());
    expect(existsSync(join(project, '.jig', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(home, '.jig'))).toBe(false);
  });

  it('codex writes AGENTS.md for project scope and .codex/AGENTS.md for global scope', () => {
    install({ ...opts(), agent: 'codex', scope: 'project' });
    expect(existsSync(join(project, 'AGENTS.md'))).toBe(true);

    install({ ...opts(), agent: 'codex', scope: 'global' });
    expect(existsSync(join(home, '.codex', 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(home, 'AGENTS.md'))).toBe(false);
  });

  it('opencode writes .opencode/skills for project scope and .config/opencode/skills for global scope', () => {
    install({ ...opts(), agent: 'opencode', scope: 'project' });
    expect(existsSync(join(project, '.opencode', 'skills', 'jig', 'SKILL.md'))).toBe(true);

    install({ ...opts(), agent: 'opencode', scope: 'global' });
    expect(existsSync(join(home, '.config', 'opencode', 'skills', 'jig', 'SKILL.md'))).toBe(true);
  });

  it('cursor still rejects global scope', () => {
    expect(() => install({ ...opts(), agent: 'cursor', scope: 'global' }))
      .toThrow(/does not support global/);
  });

  it('a global install writes a skill file whose rule paths are home-anchored (C2)', () => {
    install({ ...opts(), scope: 'global' });
    const skill = readFileSync(join(home, '.claude', 'skills', 'jig', 'SKILL.md'), 'utf8');
    expect(skill).toContain('Rules at ~/.jig/00-anti-patterns.md.');
  });

  it('a project install writes a skill file whose rule paths are project-anchored (C2)', () => {
    install(opts());
    const skill = readFileSync(join(project, '.claude', 'skills', 'jig', 'SKILL.md'), 'utf8');
    expect(skill).toContain('Rules at .jig/00-anti-patterns.md.');
  });

  it('writes the global-scope manifest under homeDir/.jig/manifest.json', () => {
    install({ ...opts(), scope: 'global' });
    expect(existsSync(join(home, '.jig', 'manifest.json'))).toBe(true);
    expect(existsSync(join(project, '.jig', 'manifest.json'))).toBe(false);
    const m = readManifest(home)!;
    expect(m.scope).toBe('global');
  });
});

describe('install — prepare-then-commit (Fix 2)', () => {
  it('is a clean no-op when a required source asset is unreadable', () => {
    rmSync(join(pkg, 'NOTICE'));
    expect(() => install(opts())).toThrow();
    expect(existsSync(join(project, '.jig'))).toBe(false);
    expect(existsSync(join(project, '.claude'))).toBe(false);
  });

  it('does not write a manifest when install fails while gathering', () => {
    rmSync(join(pkg, 'templates', 'command-metadata.json'));
    expect(() => install(opts())).toThrow();
    expect(readManifest(project)).toBeNull();
  });

  it('leaves a prior good install untouched when a later install call fails', () => {
    install(opts());
    const before = readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8');
    rmSync(join(pkg, 'LICENSE'));
    expect(() => install(opts())).toThrow();
    expect(readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8')).toBe(before);
  });
});

describe('token vendoring', () => {
  it('writes every token file into .jig/tokens/', () => {
    install(opts());
    for (const f of ['brand.default.css', 'mode.editorial.css', 'mode.product.css', 'mode.operator.css']) {
      expect(existsSync(join(project, '.jig', 'tokens', f))).toBe(true);
    }
  });

  it('gives vendored CSS a CSS comment header, never an HTML one', () => {
    install(opts());
    const css = readFileSync(join(project, '.jig', 'tokens', 'brand.default.css'), 'utf8');
    expect(css.startsWith('/*')).toBe(true);
    expect(css).not.toContain('<!--');
    expect(css).toContain('Apache-2.0');
  });

  it('keys token files with forward slashes', () => {
    install(opts());
    const m = readManifest(project)!;
    const keys = Object.keys(m.files).filter((k) => k.includes('tokens'));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k).not.toContain('\\');
  });

  it('preserves a user-edited token file on reinstall and reports it skipped', () => {
    install(opts());
    const target = join(project, '.jig', 'tokens', 'brand.default.css');
    const mine = `${readFileSync(target, 'utf8')}\n:root { --brand-h: 200; }\n`;
    writeFileSync(target, mine);
    const result = install(opts());
    expect(readFileSync(target, 'utf8')).toBe(mine);
    expect(result.skipped).toContain('.jig/tokens/brand.default.css');
  });
});
