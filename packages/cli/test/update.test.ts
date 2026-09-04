import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../src/commands/install.js';
import { update } from '../src/commands/update.js';
import { checksum, readManifest } from '../src/install/manifest.js';
import { getAdapter } from '../src/adapters/registry.js';

let project: string;
let pkg: string;
let home: string;

const claudeDir = getAdapter('claude').referenceDir('project'); // '.claude/skills/jig'

function seedPackage(ruleBody: string) {
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), ruleBody);
}

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
  seedPackage('### A-01 Rule\n❌ bad\n✅ good\n');
  writeFileSync(join(pkg, 'rules.index.json'),
    JSON.stringify([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' }]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
    '{{command_prefix}}{{config_file}}{{available_commands}}{{ask_instruction}}{{scripts_path}} Rules at {{rules_path}}/00-anti-patterns.md.');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'), JSON.stringify({}));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig');
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(pkg, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

const opts = (version: string) => ({
  agent: 'claude', scope: 'project' as const,
  projectRoot: project, packageRoot: pkg, version, homeDir: home,
});

describe('update', () => {
  it('replaces an untouched rule file', () => {
    install(opts('0.1.0'));
    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    const result = update(opts('0.2.0'));
    const body = readFileSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8');
    expect(body).toContain('Rule revised');
    expect(result.updated).toContain(`${claudeDir}/rules/00-anti-patterns.md`);
    expect(result.skipped).toHaveLength(0);
  });

  it('skips a rule file the user has edited', () => {
    install(opts('0.1.0'));
    const target = join(project, claudeDir, 'rules', '00-anti-patterns.md');
    writeFileSync(target, `${readFileSync(target, 'utf8')}\n### A-99 My own rule\n`);
    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    const result = update(opts('0.2.0'));
    expect(readFileSync(target, 'utf8')).toContain('A-99 My own rule');
    expect(readFileSync(target, 'utf8')).not.toContain('Rule revised');
    expect(result.skipped).toContain(`${claudeDir}/rules/00-anti-patterns.md`);
  });

  it('always replaces LICENSE and NOTICE even if edited', () => {
    install(opts('0.1.0'));
    writeFileSync(join(project, claudeDir, 'NOTICE'), 'tampered');
    writeFileSync(join(pkg, 'NOTICE'), 'Jig v2');
    update(opts('0.2.0'));
    expect(readFileSync(join(project, claudeDir, 'NOTICE'), 'utf8')).toBe('Jig v2');
  });

  it('reports the version transition', () => {
    install(opts('0.1.0'));
    const result = update(opts('0.2.0'));
    expect(result.fromVersion).toBe('0.1.0');
    expect(result.toVersion).toBe('0.2.0');
  });

  it('records the new version in the manifest', () => {
    install(opts('0.1.0'));
    update(opts('0.2.0'));
    const m = readManifest(project, claudeDir)!;
    expect(m.version).toBe('0.2.0');
  });

  it('throws when Jig is not installed', () => {
    expect(() => update(opts('0.2.0'))).toThrow(/not installed/i);
  });
});

// --- Correction 2: manifest discovery must check both possible install
// roots. A project-scope install's manifest lives under `projectRoot`; a
// global-scope install's manifest lives under `homeDir`. `update` must find
// either one without being told which scope was used — the scope flag on
// `opts` is not the source of truth, the manifest is. ---
describe('update — manifest discovery (Correction 2)', () => {
  it('discovers a project-scope install via projectRoot', () => {
    install({ ...opts('0.1.0'), scope: 'project' });
    expect(readManifest(project, claudeDir)?.scope).toBe('project');
    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    const result = update({ ...opts('0.2.0'), scope: 'project' });
    expect(result.fromVersion).toBe('0.1.0');
    expect(result.toVersion).toBe('0.2.0');
    expect(existsSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'))).toBe(true);
    const body = readFileSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8');
    expect(body).toContain('Rule revised');
    // Nothing was ever written under homeDir for a project-scope install.
    expect(existsSync(join(home, claudeDir))).toBe(false);
  });

  it('discovers a global-scope install via homeDir even when opts.scope says project', () => {
    install({ ...opts('0.1.0'), scope: 'global' });
    expect(readManifest(home, claudeDir)?.scope).toBe('global');
    expect(existsSync(join(project, claudeDir))).toBe(false);
    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    // Deliberately pass scope: 'project' here — discovery must ignore it and
    // still find + update the global install, per Correction 1: scope comes
    // from the manifest, never from the flag.
    const result = update({ ...opts('0.2.0'), scope: 'project' });
    expect(result.fromVersion).toBe('0.1.0');
    expect(result.toVersion).toBe('0.2.0');
    const body = readFileSync(join(home, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8');
    expect(body).toContain('Rule revised');
    // Still nothing under projectRoot.
    expect(existsSync(join(project, claudeDir))).toBe(false);
    const m = readManifest(home, claudeDir)!;
    expect(m.scope).toBe('global');
    expect(m.version).toBe('0.2.0');
  });

  it('skips an edited rule file in a global-scope install and always replaces its LICENSE/NOTICE', () => {
    install({ ...opts('0.1.0'), scope: 'global' });
    const target = join(home, claudeDir, 'rules', '00-anti-patterns.md');
    writeFileSync(target, `${readFileSync(target, 'utf8')}\n### A-99 My own rule\n`);
    writeFileSync(join(home, claudeDir, 'NOTICE'), 'tampered');
    writeFileSync(join(pkg, 'NOTICE'), 'Jig v2');
    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    const result = update({ ...opts('0.2.0'), scope: 'project' });
    expect(readFileSync(target, 'utf8')).toContain('A-99 My own rule');
    expect(readFileSync(target, 'utf8')).not.toContain('Rule revised');
    expect(result.skipped).toContain(`${claudeDir}/rules/00-anti-patterns.md`);
    expect(readFileSync(join(home, claudeDir, 'NOTICE'), 'utf8')).toBe('Jig v2');
  });
});

// --- Fix: `update` must also refresh the adapter's skill/instruction file
// (`.claude/skills/jig/SKILL.md`, `AGENTS.md`, ...). It is manifest-tracked
// just like a rule file, so a stale one after `update` would silently
// misinstruct the agent with an outdated command table / attestation
// format. Whole-file targets (claude, cursor, opencode) follow the same
// skip-if-edited rule as a rule file; marker-based targets (codex, generic
// AGENTS.md) are co-owned with user content outside the markers, so they
// always get their block upserted instead. ---
describe('update — skill file refresh', () => {
  it('refreshes an untouched SKILL.md when the template changes, and reports it in updated', () => {
    install(opts('0.1.0'));
    const skillPath = join(project, claudeDir, 'SKILL.md');
    const before = readFileSync(skillPath, 'utf8');

    writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
      '{{command_prefix}}{{config_file}}{{available_commands}}{{ask_instruction}}{{scripts_path}} REVISED-SKILL-BODY');

    const result = update(opts('0.2.0'));

    const after = readFileSync(skillPath, 'utf8');
    expect(after).not.toBe(before);
    expect(after).toContain('REVISED-SKILL-BODY');
    expect(result.updated).toContain(`${claudeDir}/SKILL.md`);
    expect(result.skipped).not.toContain(`${claudeDir}/SKILL.md`);
  });

  it('leaves a user-edited SKILL.md byte-identical and reports it in skipped', () => {
    install(opts('0.1.0'));
    const skillPath = join(project, claudeDir, 'SKILL.md');
    const edited = `${readFileSync(skillPath, 'utf8')}\n<!-- my own notes -->\n`;
    writeFileSync(skillPath, edited);

    writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
      '{{command_prefix}}{{config_file}}{{available_commands}}{{ask_instruction}}{{scripts_path}} REVISED-SKILL-BODY');

    const result = update(opts('0.2.0'));

    expect(readFileSync(skillPath, 'utf8')).toBe(edited);
    expect(result.skipped).toContain(`${claudeDir}/SKILL.md`);
    expect(result.updated).not.toContain(`${claudeDir}/SKILL.md`);
  });

  it('updates the manifest checksum for the skill file when it is rewritten', () => {
    install(opts('0.1.0'));
    writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
      '{{command_prefix}}{{config_file}}{{available_commands}}{{ask_instruction}}{{scripts_path}} REVISED-SKILL-BODY');
    update(opts('0.2.0'));
    const skillPath = join(project, claudeDir, 'SKILL.md');
    const m = readManifest(project, claudeDir)!;
    expect(m.files[`${claudeDir}/SKILL.md`]).toBe(checksum(readFileSync(skillPath, 'utf8')));
  });

  it('always upserts the pointer block in a codex AGENTS.md, preserving edited user content above it', () => {
    const codexOpts = (version: string) => ({ ...opts(version), agent: 'codex' });
    install(codexOpts('0.1.0'));
    const agentsPath = join(project, 'AGENTS.md');

    // The user adds their own house rules above Jig's block, then edits
    // that content again — any edit here makes the whole-file checksum
    // stop matching, which must NOT cause the block to be skipped.
    const original = readFileSync(agentsPath, 'utf8');
    const withUserContent = `# My house rules\n\nAlways use tabs.\n\n${original}`;
    writeFileSync(agentsPath, withUserContent);
    writeFileSync(agentsPath, withUserContent.replace('Always use tabs.', 'Always use tabs. Edited again.'));

    writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
      '{{command_prefix}}{{config_file}}{{available_commands}}{{ask_instruction}}{{scripts_path}}{{update_path}} REVISED-SKILL-BODY');

    const result = update(codexOpts('0.2.0'));

    const after = readFileSync(agentsPath, 'utf8');
    expect(after).toContain('# My house rules');
    expect(after).toContain('Always use tabs. Edited again.');
    // The revised body lands in the skill file; AGENTS.md keeps its pointer.
    expect(
      readFileSync(join(project, '.agents', 'skills', 'jig', 'SKILL.md'), 'utf8'),
    ).toContain('REVISED-SKILL-BODY');
    expect(after).toContain('.agents/skills/jig/SKILL.md');
    // The body itself is NOT in AGENTS.md any more — that is the point of the
    // move: AGENTS.md is read into every session, so it carries a pointer.
    expect(after).not.toContain('REVISED-SKILL-BODY');
    expect(after.match(/<!-- jig:start -->/g)).toHaveLength(1);
    expect(after.match(/<!-- jig:end -->/g)).toHaveLength(1);
    expect(result.updated).toContain('AGENTS.md');
    expect(result.skipped).not.toContain('AGENTS.md');
  });
});

// --- C3: manifest.json can live inside a shared, version-controlled repo —
// it must never be trusted to redirect writes outside the location it was
// actually found at, and a malformed or adapter/scope-mismatched manifest
// must fail loudly rather than silently writing somewhere unexpected. ---
describe('update — manifest cannot redirect writes outside where it was found (C3)', () => {
  it('a manifest claiming global scope while sitting at the project root updates the PROJECT, not $HOME', () => {
    const genericDir = getAdapter('generic').referenceDir('project'); // '.agents/skills/jig'
    mkdirSync(join(project, genericDir), { recursive: true });
    writeFileSync(
      join(project, genericDir, 'manifest.json'),
      JSON.stringify({
        version: '0.0.1',
        agent: 'generic',
        scope: 'global',
        installedAt: new Date().toISOString(),
        files: {},
      }),
    );

    const result = update({ ...opts('0.1.0'), agent: 'generic' });

    expect(existsSync(join(project, genericDir, 'rules', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(project, genericDir, 'SKILL.md'))).toBe(true);
    // Nothing escaped to $HOME.
    expect(existsSync(join(home, genericDir))).toBe(false);

    const m = readManifest(project, genericDir)!;
    expect(m.scope).toBe('project');
    expect(result.fromVersion).toBe('0.0.1');
  });

  it('gives a clear, actionable error when the manifest is malformed JSON', () => {
    mkdirSync(join(project, claudeDir), { recursive: true });
    writeFileSync(join(project, claudeDir, 'manifest.json'), 'not json');
    expect(() => update(opts('0.2.0'))).toThrow(/jig install/i);
  });

  it('gives a clear, actionable error when the manifest has a `..` file key', () => {
    mkdirSync(join(project, claudeDir), { recursive: true });
    writeFileSync(
      join(project, claudeDir, 'manifest.json'),
      JSON.stringify({
        version: '0.1.0',
        agent: 'claude',
        scope: 'project',
        installedAt: new Date().toISOString(),
        files: { '../../etc/passwd': 'sha256:' + '0'.repeat(64) },
      }),
    );
    expect(() => update(opts('0.2.0'))).toThrow(/jig install/i);
  });

  it('rejects a manifest recording an unknown agent instead of silently updating', () => {
    // Every adapter supports both scopes as of the harness-table refactor,
    // so there is no longer an adapter/scope combination `resolveInstalled`
    // itself rejects — the remaining way a manifest's own content can try
    // to redirect behavior is claiming an `agent` this build doesn't know,
    // which `getAdapter` (called with the manifest's recorded agent, not
    // whatever `update()` was invoked with) must still fail loudly on.
    const globalDir = getAdapter('claude').referenceDir('global');
    mkdirSync(join(home, globalDir), { recursive: true });
    writeFileSync(
      join(home, globalDir, 'manifest.json'),
      JSON.stringify({
        version: '0.1.0',
        agent: 'not-a-real-agent',
        scope: 'global',
        installedAt: new Date().toISOString(),
        files: {},
      }),
    );
    expect(() => update({ ...opts('0.2.0'), agent: 'claude' })).toThrow(/Unknown agent/i);
  });
});

describe('update — same root as $HOME does not downgrade a global install (C2 regression)', () => {
  it('keeps scope global when projectRoot and homeDir are the same path', () => {
    install({ ...opts('0.1.0'), scope: 'global' });
    expect(readManifest(home, claudeDir)?.scope).toBe('global');

    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    const result = update({ ...opts('0.2.0'), projectRoot: home, homeDir: home });

    expect(result.fromVersion).toBe('0.1.0');
    const m = readManifest(home, claudeDir)!;
    expect(m.scope).toBe('global');

    const skillPath = join(home, claudeDir, 'SKILL.md');
    const skill = readFileSync(skillPath, 'utf8');
    expect(skill).toContain(`Rules at ~/${claudeDir}/rules/00-anti-patterns.md.`);
    expect(skill).not.toContain(`Rules at ${claudeDir}/rules/00-anti-patterns.md.`);
  });

  it('still updates the PROJECT when the manifest claims global but the roots differ (C3 escape stays closed)', () => {
    mkdirSync(join(project, claudeDir), { recursive: true });
    writeFileSync(
      join(project, claudeDir, 'manifest.json'),
      JSON.stringify({
        version: '0.1.0',
        agent: 'claude',
        scope: 'global',
        installedAt: new Date().toISOString(),
        files: {},
      }),
    );

    const result = update(opts('0.2.0'));

    expect(existsSync(join(project, claudeDir, 'rules', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(home, claudeDir))).toBe(false);
    const m = readManifest(project, claudeDir)!;
    expect(m.scope).toBe('project');
    expect(result.fromVersion).toBe('0.1.0');
  });

  it('a normal global update from a real (different-path) project directory still works', () => {
    install({ ...opts('0.1.0'), scope: 'global' });
    expect(existsSync(join(project, claudeDir))).toBe(false);

    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    const result = update(opts('0.2.0'));

    expect(result.fromVersion).toBe('0.1.0');
    const body = readFileSync(join(home, claudeDir, 'rules', '00-anti-patterns.md'), 'utf8');
    expect(body).toContain('Rule revised');
    expect(existsSync(join(project, claudeDir))).toBe(false);
    expect(readManifest(home, claudeDir)?.scope).toBe('global');
  });
});

// --- Since 0.4.0, `install` no longer vendors any token file into the
// project — only `init` copies the modes a project actually declares.
// `update` still has to keep those copies fresh (see commands/update.ts's
// state.json-driven refresh loop below). ---
describe('update and the project mode-file copy (state.json)', () => {
  it('refreshes an untouched mode file tracked in .jig/state.json', () => {
    install(opts('0.1.0'));
    mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
    const original = ':root { --from: mode.product.css; }\n';
    writeFileSync(join(project, '.jig', 'tokens', 'mode.product.css'), original);
    writeFileSync(
      join(project, '.jig', 'state.json'),
      JSON.stringify({ version: '0.1.0', modes: ['product'], files: { '.jig/tokens/mode.product.css': checksum(original) } }),
    );

    writeFileSync(join(pkg, 'tokens', 'mode.product.css'), ':root { --from: revised; }\n');
    const result = update(opts('0.2.0'));

    const body = readFileSync(join(project, '.jig', 'tokens', 'mode.product.css'), 'utf8');
    expect(body).toContain('--from: revised');
    expect(result.updated).toContain('.jig/tokens/mode.product.css');
  });

  it('leaves a user-edited mode file byte-identical and reports it skipped', () => {
    install(opts('0.1.0'));
    mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
    const original = ':root { --from: mode.product.css; }\n';
    writeFileSync(
      join(project, '.jig', 'state.json'),
      JSON.stringify({ version: '0.1.0', modes: ['product'], files: { '.jig/tokens/mode.product.css': checksum(original) } }),
    );
    const mine = `${original}\n:root { --brand-h: 200; }\n`;
    writeFileSync(join(project, '.jig', 'tokens', 'mode.product.css'), mine);

    writeFileSync(join(pkg, 'tokens', 'mode.product.css'), ':root { --from: revised; }\n');
    const result = update(opts('0.2.0'));

    expect(readFileSync(join(project, '.jig', 'tokens', 'mode.product.css'), 'utf8')).toBe(mine);
    expect(result.skipped).toContain('.jig/tokens/mode.product.css');
  });

  it('is a no-op on tokens when the project was never init-ed (no state.json)', () => {
    install(opts('0.1.0'));
    const result = update(opts('0.2.0'));
    expect(existsSync(join(project, '.jig'))).toBe(false);
    expect(result.updated.some((f) => f.includes('tokens'))).toBe(false);
  });

});

describe('update — every installed harness (I2)', () => {
  it('refreshes every installed harness, not just the first one found', () => {
    // A project may hold several installs — the README documents installing
    // per agent — and each keeps its own manifest under its own reference
    // directory. Refreshing only the first left the rest pinned at their
    // install version forever, with nothing said about them.
    for (const agent of ['claude', 'cursor', 'gemini']) {
      install({ ...opts('0.1.0'), agent });
    }
    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');

    const result = update(opts('0.2.0'));

    for (const agent of ['claude', 'cursor', 'gemini']) {
      const dir = getAdapter(agent).referenceDir('project');
      const manifest = readManifest(project, dir);
      expect(manifest?.version, `${agent} manifest version`).toBe('0.2.0');
      expect(
        readFileSync(join(project, dir, 'rules', '00-anti-patterns.md'), 'utf8'),
        `${agent} rules`,
      ).toContain('Rule revised');
    }

    expect(result.targets.map((t) => t.agent).sort()).toEqual(['claude', 'cursor', 'gemini']);
    for (const t of result.targets) expect(t.fromVersion).toBe('0.1.0');
  });
});
