import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../src/commands/install.js';
import { update } from '../src/commands/update.js';
import { readManifest } from '../src/install/manifest.js';
import { getAdapter } from '../src/adapters/registry.js';

/**
 * The rule files say what good UI is. The reference files say how to *use* the
 * system — the procedure for a command, and what to do when two rules appear to
 * disagree. Both are agent-read material, so both ship beside the skill file.
 *
 * They are copied as a tree rather than a hardcoded list, so adding a reference
 * is a file drop with no code change — the same property the harness table has.
 */
let project: string;
let pkg: string;
let home: string;

const claudeDir = getAdapter('claude').referenceDir('project');

function opts(version: string) {
  return {
    agent: 'claude',
    scope: 'project' as const,
    projectRoot: project,
    packageRoot: pkg,
    version,
    homeDir: home,
  };
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  home = mkdtempSync(join(tmpdir(), 'jig-home-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  mkdirSync(join(pkg, 'references', 'commands'), { recursive: true });
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n');
  writeFileSync(join(pkg, 'rules.index.json'), JSON.stringify([]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'), 'Rules at {{rules_path}}.');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'), JSON.stringify({}));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig');
  writeFileSync(join(pkg, 'references', 'conflicts.md'), '# When rules appear to disagree\n');
  writeFileSync(join(pkg, 'references', 'commands', 'init.md'), '# init\n');
  writeFileSync(join(pkg, 'references', 'commands', 'check.md'), '# check\n');
});

afterEach(() => {
  for (const d of [project, pkg, home]) rmSync(d, { recursive: true, force: true });
});

describe('install ships the reference files', () => {
  it('writes them beside the skill, preserving the subdirectory shape', () => {
    install(opts('0.1.0'));
    expect(existsSync(join(project, claudeDir, 'conflicts.md'))).toBe(true);
    expect(existsSync(join(project, claudeDir, 'commands', 'init.md'))).toBe(true);
    expect(existsSync(join(project, claudeDir, 'commands', 'check.md'))).toBe(true);
  });

  it('tracks them in the manifest so update and re-install can skip local edits', () => {
    install(opts('0.1.0'));
    const manifest = readManifest(project, claudeDir);
    expect(Object.keys(manifest!.files)).toContain(`${claudeDir}/conflicts.md`);
    expect(Object.keys(manifest!.files)).toContain(`${claudeDir}/commands/init.md`);
  });

  it('picks up a new reference with no code change', () => {
    // The whole point of copying a tree: a future reference is a file drop.
    writeFileSync(join(pkg, 'references', 'commands', 'build.md'), '# build\n');
    install(opts('0.1.0'));
    expect(existsSync(join(project, claudeDir, 'commands', 'build.md'))).toBe(true);
  });

  it('stamps each one with a vendor header naming the version', () => {
    install(opts('0.1.0'));
    const body = readFileSync(join(project, claudeDir, 'conflicts.md'), 'utf8');
    expect(body).toContain('0.1.0');
    expect(body).toContain('When rules appear to disagree');
  });
});

describe('update refreshes the reference files', () => {
  it('replaces an untouched reference', () => {
    install(opts('0.1.0'));
    writeFileSync(join(pkg, 'references', 'conflicts.md'), '# Revised conflict procedure\n');
    const result = update(opts('0.2.0'));
    const body = readFileSync(join(project, claudeDir, 'conflicts.md'), 'utf8');
    expect(body).toContain('Revised conflict procedure');
    expect(result.updated).toContain(`${claudeDir}/conflicts.md`);
  });

  it('leaves a reference the user has edited alone', () => {
    install(opts('0.1.0'));
    const target = join(project, claudeDir, 'commands', 'init.md');
    writeFileSync(target, '# init\n\nour team always uses operator mode\n');
    writeFileSync(join(pkg, 'references', 'commands', 'init.md'), '# init, revised\n');
    const result = update(opts('0.2.0'));
    expect(readFileSync(target, 'utf8')).toContain('our team always uses operator mode');
    expect(result.skipped).toContain(`${claudeDir}/commands/init.md`);
  });

  it('delivers a reference added since the install', () => {
    install(opts('0.1.0'));
    writeFileSync(join(pkg, 'references', 'commands', 'build.md'), '# build\n');
    update(opts('0.2.0'));
    expect(existsSync(join(project, claudeDir, 'commands', 'build.md'))).toBe(true);
  });
});
