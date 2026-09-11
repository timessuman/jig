import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCommandBody, buildSkillBody, install } from '../src/commands/install.js';
import { ADAPTERS, getAdapter, skillFilesFor } from '../src/adapters/registry.js';
import { repoRoot } from './helpers/registered-commands.js';

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

  it("gives codex a command at global scope, where its prompts actually live", () => {
    // OpenAI documents custom prompts as loading from `~/.codex/prompts` only —
    // top-level Markdown, no project-scoped equivalent — so the file is written
    // for a global install and nothing is written for a project one.
    const global = skillFilesFor(getAdapter('codex'), ctx('global'));
    const command = global.find((f) => f.relPath === '.codex/prompts/jig.md')!;
    expect(command, 'expected .codex/prompts/jig.md at global scope').toBeDefined();
    expect(command.content).toContain('$ARGUMENTS');

    const project = skillFilesFor(getAdapter('codex'), ctx('project'));
    expect(
      project.map((f) => f.relPath).filter((p) => p.includes('prompts')),
      'a project-scope prompt file is read by nothing',
    ).toEqual([]);
  });

  it('never writes a .codex/commands file — that mechanism does not exist', () => {
    // The bare `commands` string in the Codex binary belongs to its
    // import-from-another-agent feature, not to prompt loading.
    for (const scope of ['project', 'global'] as const) {
      const paths = skillFilesFor(getAdapter('codex'), ctx(scope)).map((f) => f.relPath);
      expect(paths.filter((p) => p.includes('commands'))).toEqual([]);
    }
  });

  it('still gives codex its skill and AGENTS.md pointer at both scopes', () => {
    for (const scope of ['project', 'global'] as const) {
      const paths = skillFilesFor(getAdapter('codex'), ctx(scope)).map((f) => f.relPath);
      expect(paths).toContain('.agents/skills/jig/SKILL.md');
      expect(paths.some((p) => p.endsWith('AGENTS.md'))).toBe(true);
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

/**
 * `update`'s whole job is to move the pinned version forward, so it is the one
 * command that must NOT be invoked at the pin. Run as `npx jig-ui@<installed>
 * update` it refreshes to the version already installed and reports success —
 * "Updated Jig → 0.4.0" — for a no-op.
 *
 * `buildSkillBody` knew this and had `update_path` for it. `buildCommandBody`
 * did not, and the command template told the agent to run every subcommand at
 * `{{scripts_path}}`, which is pinned. So `/jig update` could never upgrade
 * anyone, and would say it had.
 */
describe('/jig update is not pinned to the version it is meant to replace', () => {
  const real = () => buildCommandBody(repoRoot, '.claude/skills/jig/rules', '0.4.0', '$ARGUMENTS').body;

  it('tells the agent to run update at @latest', () => {
    const body = real();
    const update = body.slice(body.indexOf('## update'));
    expect(update, 'the update section does not name @latest').toContain('jig-ui@latest');
  });

  it('still pins every other subcommand to the installed version', () => {
    expect(real()).toContain('npx jig-ui@0.4.0');
  });

  it('never tells an agent to run update at a pinned version, in EITHER body', () => {
    // The invariant, stated once and checked on every agent-facing surface.
    // It held for the skill body and not for the command body, which is
    // precisely why the bug lived in one and not the other — two assertions in
    // two files describing one rule is how a third surface gets it wrong next.
    const bodies = {
      skill: buildSkillBody(repoRoot, '.claude/skills/jig/rules', '0.4.0'),
      command: buildCommandBody(repoRoot, '.claude/skills/jig/rules', '0.4.0', '$ARGUMENTS').body,
    };
    for (const [name, body] of Object.entries(bodies)) {
      const pinned = body
        .split('\n')
        .filter((l) => /\bupdate\b/.test(l) && /npx jig-ui@/.test(l) && !l.includes('@latest'));
      expect(pinned, `${name} body invokes update at a pin: ${pinned.join(' / ')}`).toEqual([]);
    }
  });

  it('lands in the file an agent actually reads', () => {
    install({ agent: 'claude', scope: 'project', projectRoot: project,
              packageRoot: repoRoot, homeDir: home, version: '0.4.0' });
    const command = readFileSync(join(project, '.claude', 'commands', 'jig.md'), 'utf8');
    expect(command).toContain('jig-ui@latest');
    expect(command).toContain('npx jig-ui@0.4.0');
  });
});

/**
 * Mode is the most consequential thing `init` writes and the thing it is worst
 * at choosing. `--yes` takes `'/' → product` without reading the project, and
 * `01-modes.md` rule 1 then makes that config outrank every agent's later
 * inference — so a default chosen in a second binds the project indefinitely.
 * Two baseline runs on an `ops-console` read every signal as `operator`, found
 * `product` in the config, and correctly deferred to it.
 *
 * The CLI cannot fix this: "is this a marketing site, an app, or an internal
 * console" is a question, not a detection. But the agent is holding a
 * conversation with someone who knows the answer, and `init` already honours a
 * `jig.config.json` that exists before it runs. So the instruction is: settle
 * the surfaces FIRST, write them down, then run the command.
 */
describe('the command file tells the agent to settle mode before init runs', () => {
  const initSection = () => {
    const body = buildCommandBody(repoRoot, '.claude/skills/jig/rules', '0.5.0', '$ARGUMENTS').body;
    return body.slice(body.indexOf('## init'), body.indexOf('## check'));
  };

  it('says to establish the surfaces before running init, not after', () => {
    const s = initSection().toLowerCase();
    expect(s, 'no instruction to act before running').toMatch(/before (you )?run/);
    expect(s).toMatch(/jig\.config\.json/);
  });

  it('tells it to ask rather than infer silently', () => {
    expect(initSection().toLowerCase()).toMatch(/ask/);
  });

  it('names all three modes, so the question can be asked concretely', () => {
    const s = initSection();
    for (const mode of ['editorial', 'product', 'operator']) {
      expect(s, `${mode} is not named`).toContain(mode);
    }
  });

  it('still forbids authoring token values by hand', () => {
    expect(initSection().toLowerCase()).toMatch(/not author|never author/);
  });
});
