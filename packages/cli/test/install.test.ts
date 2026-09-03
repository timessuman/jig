import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install, upsertBlock, vendorHeader } from '../src/commands/install.js';
import { readManifest } from '../src/install/manifest.js';
import { BLOCK_START, BLOCK_END } from '../src/adapters/types.js';
import { getAdapter } from '../src/adapters/registry.js';

let project: string;
let pkg: string;
let home: string;

const claudeDir = getAdapter('claude').referenceDir('project'); // '.claude/skills/jig'

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
  it('vendors rules beside the skill file, not into the project', () => {
    install(opts());
    expect(existsSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(project, claudeDir, 'rules.index.json'))).toBe(true);
  });

  it('writes nothing into the project-local .jig/ directory (claude, project scope)', () => {
    install(opts());
    expect(existsSync(join(project, '.jig'))).toBe(false);
  });

  it('writes nothing into the project-local .jig/ directory (claude, global scope)', () => {
    install({ ...opts(), scope: 'global' });
    expect(existsSync(join(project, '.jig'))).toBe(false);
    expect(existsSync(join(project, '.claude'))).toBe(false);
  });

  it('prefixes each vendored rule file with an attribution header', () => {
    install(opts());
    const body = readFileSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8');
    expect(body).toContain('Apache-2.0');
    expect(body).toContain('### A-01 Rule');
  });

  it('writes LICENSE and NOTICE beside the skill file', () => {
    install(opts());
    expect(existsSync(join(project, claudeDir, 'LICENSE'))).toBe(true);
    expect(existsSync(join(project, claudeDir, 'NOTICE'))).toBe(true);
  });

  it('writes the agent skill file', () => {
    install(opts());
    const skill = join(project, claudeDir, 'SKILL.md');
    expect(existsSync(skill)).toBe(true);
    expect(readFileSync(skill, 'utf8')).toContain('/jig check');
  });

  it('does not vendor any token file — tokens are project property, written only by init', () => {
    install(opts());
    expect(existsSync(join(project, claudeDir, 'tokens'))).toBe(false);
  });

  it('records every written file in the manifest with a checksum', () => {
    const result = install(opts());
    const m = readManifest(project, claudeDir)!;
    expect(m.agent).toBe('claude');
    expect(m.version).toBe('0.1.0');
    for (const rel of result.written) {
      if (rel.endsWith('manifest.json')) continue;
      expect(m.files[rel]).toMatch(/^sha256:/);
    }
  });

  it('is idempotent', () => {
    install(opts());
    const first = readFileSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8');
    install(opts());
    expect(readFileSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8')).toBe(first);
  });

  it('rejects an unknown agent', () => {
    expect(() => install({ ...opts(), agent: 'nope' })).toThrow(/Unknown agent 'nope'/);
  });

  // --- I1: re-running install must not silently destroy a user's edit to a
  // vendored file. The vendor header on every rule file promises exactly
  // this ("`jig update` will not overwrite a file you have changed") and
  // the README's headline instruction is the install line itself, so a
  // second `install` run is a real, common path — not just `update`. ---
  it('does not clobber a locally edited rule file on a second install, and reports it skipped (I1)', () => {
    install(opts());
    const target = join(project, claudeDir, 'rules', '00-anti-patterns.md');
    const edited = `${readFileSync(target, 'utf8')}\n### A-99 My own addition\n`;
    writeFileSync(target, edited);

    const result = install(opts());

    expect(readFileSync(target, 'utf8')).toBe(edited);
    expect(result.skipped).toContain(`${claudeDir}/rules/00-anti-patterns.md`);
    expect(result.written).not.toContain(`${claudeDir}/rules/00-anti-patterns.md`);
  });

  it('still replaces LICENSE and NOTICE on a second install even if they were edited (I1)', () => {
    install(opts());
    writeFileSync(join(project, claudeDir, 'NOTICE'), 'tampered');
    writeFileSync(join(pkg, 'NOTICE'), 'Jig v2 NOTICE');

    const result = install(opts());

    expect(readFileSync(join(project, claudeDir, 'NOTICE'), 'utf8')).toBe('Jig v2 NOTICE');
    expect(result.skipped).not.toContain(`${claudeDir}/NOTICE`);
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
    const m = readManifest(project, claudeDir)!;
    for (const key of Object.keys(m.files)) {
      expect(key).not.toContain('\\');
    }
    // Spot-check a couple of well-known keys are POSIX-style.
    expect(m.files[`${claudeDir}/rules/00-anti-patterns.md`]).toMatch(/^sha256:/);
    expect(m.files[`${claudeDir}/LICENSE`]).toMatch(/^sha256:/);
  });
});

describe('install — codex reference material lives beside AGENTS.md in .jig/', () => {
  it("codex (project scope) puts rules in .jig/, since it has no skill directory of its own", () => {
    install({ ...opts(), agent: 'codex' });
    expect(existsSync(join(project, '.jig', 'rules', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(project, '.jig', 'rules.index.json'))).toBe(true);
    expect(existsSync(join(project, 'AGENTS.md'))).toBe(true);
    // But install still never writes any project-state file — those come
    // only from `init` (tokens/, jig.config.json, state.json).
    expect(existsSync(join(project, '.jig', 'tokens'))).toBe(false);
    expect(existsSync(join(project, '.jig', 'state.json'))).toBe(false);
    expect(existsSync(join(project, 'jig.config.json'))).toBe(false);
  });
});

describe('install — generic uses the shared skill-dir convention', () => {
  it('generic writes SKILL.md and rules under .agents/skills/jig/, not AGENTS.md', () => {
    install({ ...opts(), agent: 'generic' });
    expect(existsSync(join(project, '.agents', 'skills', 'jig', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(project, '.agents', 'skills', 'jig', 'rules', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(project, 'AGENTS.md'))).toBe(false);
  });

  it('generic supports global scope too, at ~/.agents/skills/jig/', () => {
    install({ ...opts(), agent: 'generic', scope: 'global' });
    expect(existsSync(join(home, '.agents', 'skills', 'jig', 'SKILL.md'))).toBe(true);
  });
});

describe('install — global install already present warns instead of duplicating (project install)', () => {
  it('warns and writes nothing when the same agent is already installed globally', () => {
    install({ ...opts(), scope: 'global' });
    const result = install(opts());
    expect(result.warning).toMatch(/already installed globally/i);
    expect(result.written).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(existsSync(join(project, claudeDir))).toBe(false);
  });

  it('does not warn for a different agent even if that one is installed globally', () => {
    install({ ...opts(), agent: 'claude', scope: 'global' });
    const result = install({ ...opts(), agent: 'cursor', scope: 'project' });
    expect(result.warning).toBeUndefined();
    expect(existsSync(join(project, '.cursor', 'skills', 'jig', 'SKILL.md'))).toBe(true);
  });

  it('a plain project install with no existing global install proceeds normally', () => {
    const result = install(opts());
    expect(result.warning).toBeUndefined();
    expect(result.written.length).toBeGreaterThan(0);
  });
});

describe('install — scope resolution (Fix 1)', () => {
  it('writes a global-scope install under homeDir, not projectRoot', () => {
    install({ ...opts(), scope: 'global' });
    expect(existsSync(join(home, claudeDir, 'rules', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(home, claudeDir, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(project, claudeDir))).toBe(false);
  });

  it('project-scope install is unaffected by homeDir', () => {
    install(opts());
    expect(existsSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(home, claudeDir))).toBe(false);
  });

  it('codex writes AGENTS.md for project scope and .codex/AGENTS.md for global scope', () => {
    install({ ...opts(), agent: 'codex', scope: 'project' });
    expect(existsSync(join(project, 'AGENTS.md'))).toBe(true);

    install({ ...opts(), agent: 'codex', scope: 'global' });
    expect(existsSync(join(home, '.codex', 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(home, 'AGENTS.md'))).toBe(false);
    // The global codex reference bundle lives beside .codex/AGENTS.md, in
    // .codex/.jig — not the bare ~/.jig this project no longer uses.
    expect(existsSync(join(home, '.codex', '.jig', 'rules', '00-anti-patterns.md'))).toBe(true);
  });

  it('opencode writes .opencode/skills for project scope and .config/opencode/skills for global scope', () => {
    install({ ...opts(), agent: 'opencode', scope: 'project' });
    expect(existsSync(join(project, '.opencode', 'skills', 'jig', 'SKILL.md'))).toBe(true);

    install({ ...opts(), agent: 'opencode', scope: 'global' });
    expect(existsSync(join(home, '.config', 'opencode', 'skills', 'jig', 'SKILL.md'))).toBe(true);
  });

  it('cursor now supports global scope too, at ~/.cursor/skills/jig/', () => {
    install({ ...opts(), agent: 'cursor', scope: 'project' });
    expect(existsSync(join(project, '.cursor', 'skills', 'jig', 'SKILL.md'))).toBe(true);

    install({ ...opts(), agent: 'cursor', scope: 'global' });
    expect(existsSync(join(home, '.cursor', 'skills', 'jig', 'SKILL.md'))).toBe(true);
  });

  it('a global install writes a skill file whose rule paths are home-anchored (C2)', () => {
    install({ ...opts(), scope: 'global' });
    const skill = readFileSync(join(home, claudeDir, 'SKILL.md'), 'utf8');
    expect(skill).toContain(`Rules at ~/${claudeDir}/rules/00-anti-patterns.md.`);
  });

  it('a project install writes a skill file whose rule paths are project-anchored (C2)', () => {
    install(opts());
    const skill = readFileSync(join(project, claudeDir, 'SKILL.md'), 'utf8');
    expect(skill).toContain(`Rules at ${claudeDir}/rules/00-anti-patterns.md.`);
  });

  // --- "Verify the rendered path actually resolves from where the skill
  // file lands... not that it looks right — that it resolves." Both scopes:
  // extract rules_path from the rendered SKILL.md and confirm a rule file
  // really exists there, resolved the way the two anchors are meant to be
  // read (project-relative from projectRoot; ~/-relative from homeDir). ---
  it("a project-scope SKILL.md's rules_path resolves, on disk, to the vendored rule file", () => {
    install(opts());
    const skill = readFileSync(join(project, claudeDir, 'SKILL.md'), 'utf8');
    const m = /Rules at (\S+)\/00-anti-patterns\.md\./.exec(skill);
    expect(m).not.toBeNull();
    const rulesPath = m![1];
    expect(rulesPath.startsWith('~')).toBe(false);
    const resolved = join(project, ...rulesPath.split('/'), '00-anti-patterns.md');
    expect(existsSync(resolved)).toBe(true);
    expect(resolved).toBe(join(project, claudeDir, 'rules', '00-anti-patterns.md'));
  });

  it("a global-scope SKILL.md's rules_path resolves, on disk (via ~ = homeDir), to the vendored rule file", () => {
    install({ ...opts(), scope: 'global' });
    const skill = readFileSync(join(home, claudeDir, 'SKILL.md'), 'utf8');
    const m = /Rules at (\S+)\/00-anti-patterns\.md\./.exec(skill);
    expect(m).not.toBeNull();
    const rulesPath = m![1];
    expect(rulesPath.startsWith('~/')).toBe(true);
    const resolved = join(home, ...rulesPath.slice(2).split('/'), '00-anti-patterns.md');
    expect(existsSync(resolved)).toBe(true);
    expect(resolved).toBe(join(home, claudeDir, 'rules', '00-anti-patterns.md'));
  });

  it('writes the global-scope manifest beside the skill file under homeDir', () => {
    install({ ...opts(), scope: 'global' });
    expect(existsSync(join(home, claudeDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(project, claudeDir, 'manifest.json'))).toBe(false);
    const m = readManifest(home, claudeDir)!;
    expect(m.scope).toBe('global');
  });
});

describe('install — prepare-then-commit (Fix 2)', () => {
  it('is a clean no-op when a required source asset is unreadable', () => {
    rmSync(join(pkg, 'NOTICE'));
    expect(() => install(opts())).toThrow();
    expect(existsSync(join(project, claudeDir))).toBe(false);
  });

  it('does not write a manifest when install fails while gathering', () => {
    rmSync(join(pkg, 'templates', 'command-metadata.json'));
    expect(() => install(opts())).toThrow();
    expect(readManifest(project, claudeDir)).toBeNull();
  });

  it('leaves a prior good install untouched when a later install call fails', () => {
    install(opts());
    const before = readFileSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8');
    rmSync(join(pkg, 'LICENSE'));
    expect(() => install(opts())).toThrow();
    expect(readFileSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8')).toBe(before);
  });
});
