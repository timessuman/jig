import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install, upsertBlock, vendorHeader } from '../src/commands/install.js';
import { readManifest } from '../src/install/manifest.js';

let project: string;
let pkg: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n❌ bad\n✅ good\n');
  writeFileSync(join(pkg, 'rules.index.json'),
    JSON.stringify([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' }]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
    'Use {{command_prefix}}check. Config {{config_file}}.\n{{available_commands}}\n{{ask_instruction}}\n{{scripts_path}}');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'),
    JSON.stringify({ check: { description: 'Check.', argumentHint: '[target]' } }));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig\nCopyright ...');
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(pkg, { recursive: true, force: true });
});

const opts = () => ({ agent: 'claude', scope: 'project' as const, projectRoot: project, packageRoot: pkg, version: '0.1.0' });

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

  it('preserves existing AGENTS.md content', () => {
    writeFileSync(join(project, 'AGENTS.md'), '# House rules\n\nDo the thing.\n');
    install({ ...opts(), agent: 'codex' });
    const out = readFileSync(join(project, 'AGENTS.md'), 'utf8');
    expect(out).toContain('# House rules');
    expect(out).toContain('jig:start');
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
