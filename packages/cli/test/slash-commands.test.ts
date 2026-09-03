import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../src/commands/install.js';
import { ADAPTERS, getAdapter, skillFilesFor } from '../src/adapters/registry.js';

/**
 * Developers drive these harnesses by slash command. `/jig init` and
 * `/jig check` should work the way `/commit` or `/review-pr` do, rather than
 * making someone remember an `npx` incantation.
 *
 * One command file per harness, dispatching on its arguments — that is what
 * produces `/jig init` with a space, rather than a separate `/jig-init` per
 * subcommand.
 */
let project: string;
let pkg: string;
let home: string;

const ctx = (scope: 'project' | 'global', argsPlaceholder = '$ARGUMENTS') => ({
  version: '0.4.0',
  scope,
  skillBody: 'BODY',
  commandPrefix: '/jig ',
  commandBody: `Run npx jig-ui@0.4.0 with ${argsPlaceholder}. Subcommands: check, init, install, update.`,
  subcommands: ['check', 'init', 'install', 'update'],
});

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  home = mkdtempSync(join(tmpdir(), 'jig-home-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n');
  writeFileSync(join(pkg, 'rules.index.json'), JSON.stringify([]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'), 'Rules at {{rules_path}}.');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'), JSON.stringify({
    init: { description: 'Set up', argumentHint: '[--yes]', status: 'available' },
    check: { description: 'Check', argumentHint: '[--all]', status: 'available' },
    explain: { description: 'Explain', argumentHint: '<id>', status: 'planned' },
  }));
  writeFileSync(join(pkg, 'templates', 'COMMAND.md.tmpl'), 'Run {{scripts_path}} {{subcommand_list}}');
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig');
});

afterEach(() => {
  for (const d of [project, pkg, home]) rmSync(d, { recursive: true, force: true });
});

describe('every harness that supports slash commands gets one', () => {
  it('writes a single dispatching command file, so `/jig init` works with a space', () => {
    const files = skillFilesFor(getAdapter('claude'), ctx('project'));
    const command = files.find((f) => f.relPath === '.claude/commands/jig.md');
    expect(command, 'expected .claude/commands/jig.md').toBeDefined();
    // One file named `jig` — not `jig-init.md`, which would give `/jig-init`.
    expect(files.filter((f) => f.relPath.includes('/commands/'))).toHaveLength(1);
  });

  it('dispatches on the argument, which is how `/jig init` reaches init', () => {
    const command = skillFilesFor(getAdapter('claude'), ctx('project')).find((f) =>
      f.relPath.endsWith('commands/jig.md'),
    )!;
    expect(command.content).toContain('$ARGUMENTS');
  });

  it('carries frontmatter the harness understands', () => {
    const command = skillFilesFor(getAdapter('claude'), ctx('project')).find((f) =>
      f.relPath.endsWith('commands/jig.md'),
    )!;
    expect(command.content.startsWith('---\n')).toBe(true);
    expect(command.content).toMatch(/^description:/m);
    expect(command.content).toMatch(/^argument-hint:/m);
  });

  it('lists only the subcommands that actually exist', () => {
    const command = skillFilesFor(getAdapter('claude'), ctx('project')).find((f) =>
      f.relPath.endsWith('commands/jig.md'),
    )!;
    expect(command.content).toContain('init');
    expect(command.content).toContain('check');
    // `explain` is planned; a slash command that errors out is worse than none.
    expect(command.content).not.toContain('explain');
  });

  it('puts the command where each harness reads it', () => {
    const expected: Record<string, string> = {
      claude: '.claude/commands/jig.md',
      cursor: '.cursor/commands/jig.md',
      opencode: '.opencode/command/jig.md',
      gemini: '.gemini/commands/jig.toml',
    };
    for (const [agent, relPath] of Object.entries(expected)) {
      const files = skillFilesFor(getAdapter(agent), ctx('project'));
      expect(
        files.map((f) => f.relPath),
        `${agent} command path`,
      ).toContain(relPath);
    }
  });

  it('follows each harness to its own global location', () => {
    const claude = skillFilesFor(getAdapter('claude'), ctx('global'));
    expect(claude.map((f) => f.relPath)).toContain('.claude/commands/jig.md');
    const opencode = skillFilesFor(getAdapter('opencode'), ctx('global'));
    expect(opencode.map((f) => f.relPath)).toContain('.config/opencode/command/jig.md');
  });

  it('emits Gemini its TOML shape rather than markdown', () => {
    const command = skillFilesFor(getAdapter('gemini'), ctx('project', '{{args}}')).find((f) =>
      f.relPath.endsWith('.toml'),
    )!;
    expect(command.content).toMatch(/^description = /m);
    expect(command.content).toMatch(/^prompt = /m);
    expect(command.content).toContain('{{args}}');
  });

  it('gives no adapter an unsafe command path', () => {
    for (const adapter of ADAPTERS) {
      for (const scope of ['project', 'global'] as const) {
        expect(() => skillFilesFor(adapter, ctx(scope))).not.toThrow();
      }
    }
  });
});

describe('install writes the command file', () => {
  it('lands on disk and is tracked in the manifest', () => {
    install({
      agent: 'claude',
      scope: 'project',
      projectRoot: project,
      packageRoot: pkg,
      version: '0.4.0',
      homeDir: home,
    });
    expect(existsSync(join(project, '.claude', 'commands', 'jig.md'))).toBe(true);
    const manifest = JSON.parse(
      readFileSync(join(project, '.claude', 'skills', 'jig', 'manifest.json'), 'utf8'),
    );
    expect(Object.keys(manifest.files)).toContain('.claude/commands/jig.md');
  });
});
