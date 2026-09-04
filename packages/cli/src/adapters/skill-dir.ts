import type { Scope } from '../install/manifest.js';
import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { COMMAND_DESCRIPTION, SKILL_DESCRIPTION, quoteYamlString } from './types.js';

/**
 * A harness that reads `<dir>/skills/<name>/SKILL.md` — the convention
 * impeccable's `pin.mjs` applies uniformly across eleven harnesses, and
 * gstack ships for `.agents`, `.cursor`, `.opencode`, `.factory`, `.hermes`,
 * `.kiro`, `.openclaw`, `.slate`. Jig's five hand-written adapters used to
 * each hardcode their own path; this table is the fix — a new harness that
 * follows the convention is one row here, not a new file.
 */
export interface SkillDirHarness {
  name: string;
  /**
   * Directory this harness reads skills from, relative to the scope root
   * (the project root for `'project'`, `$HOME` for `'global'`) — e.g.
   * `.claude`. Used for BOTH scopes unless `globalDir` overrides it.
   */
  dir: string;
  /**
   * Override for global scope only, when a harness's machine-wide skill
   * location is not simply `dir` under `$HOME`. opencode is the one row
   * that needs this: it resolves its GLOBAL skills from the XDG config
   * directory (`~/.config/opencode/skills/`), not `~/.opencode/skills/` —
   * confirmed against gstack's own `hosts/opencode.ts`, which documents
   * the identical split ("XDG config dir, not ~/.opencode") and against
   * this codebase's own prior opencode adapter, which already shipped that
   * distinction. Every other row in this table uses the same relative path
   * for both scopes.
   */
  globalDir?: string;
  displayName: string;
  /**
   * Extra frontmatter lines beyond `name`/`description`, inserted after
   * `description` and before the closing `---`. Matches the shape gstack's
   * own generated per-skill SKILL.md files under `.cursor/skills/` and
   * `.opencode/skills/` use — `name` + `description` only, nothing else (verified by
   * reading `~/.claude/skills/gstack/.cursor/skills/gstack/SKILL.md`).
   * Claude Code is the one harness with a real extra field of its own
   * (`user-invocable`, a Claude Code-specific skill-frontmatter key), so it
   * is the only row that sets this.
   */
  extraFrontmatter?: string[];
  /**
   * Where this harness reads slash commands from, relative to the same scope
   * root as `dir`, and in which format.
   *
   * One file named `jig`, dispatching on its arguments — that is what produces
   * `/jig init` with a space. A file per subcommand would give `/jig-init`.
   *
   * Omitted for a harness with no slash-command mechanism; nothing is written
   * for it rather than a file it will never read.
   */
  commands?: { dir: string; format: 'md' | 'toml' };
}

/**
 * Harnesses that read `<harness>/skills/<name>/` — the ecosystem
 * convention. Adding a harness that follows it is exactly one row here.
 */
export const SKILL_DIR_HARNESSES: SkillDirHarness[] = [
  {
    name: 'claude',
    dir: '.claude',
    displayName: 'Claude Code',
    extraFrontmatter: ['user-invocable: true'],
    // `commands/<name>.md`, YAML frontmatter, `$ARGUMENTS` in the body —
    // verified against the shipped command files under
    // ~/.claude/plugins/marketplaces/*/plugins/*/commands/.
    commands: { dir: 'commands', format: 'md' },
  },
  { name: 'cursor', dir: '.cursor', displayName: 'Cursor', commands: { dir: 'commands', format: 'md' } },
  {
    name: 'opencode',
    dir: '.opencode',
    globalDir: '.config/opencode',
    displayName: 'opencode',
    // Singular `command/`, unlike everyone else's `commands/`.
    commands: { dir: 'command', format: 'md' },
  },
  // No slash-command mechanism of its own — `.agents` is a skills convention
  // rather than a harness, so there is nothing to write a command file for.
  { name: 'generic', dir: '.agents', displayName: 'Generic (.agents/skills)' },
  // Proves the table design: this row is the entire diff needed to support
  // a sixth harness. Gemini CLI, Copilot CLI and others read `.agents/skills`
  // too, but Gemini also has its own `.gemini` skill directory.
  {
    name: 'gemini',
    dir: '.gemini',
    displayName: 'Gemini CLI',
    // Gemini reads TOML, with `{{args}}` where the others use `$ARGUMENTS`.
    commands: { dir: 'commands', format: 'toml' },
  },
];

function dirFor(h: SkillDirHarness, scope: Scope): string {
  return scope === 'global' && h.globalDir ? h.globalDir : h.dir;
}

function skillDirAdapter(h: SkillDirHarness): Adapter {
  return {
    name: h.name,
    displayName: h.displayName,
    skillFiles(ctx: AdapterContext): RenderedFile[] {
      const content = [
        '---',
        'name: jig',
        `description: ${quoteYamlString(SKILL_DESCRIPTION)}`,
        ...(h.extraFrontmatter ?? []),
        '---',
        '',
        ctx.skillBody,
        '',
      ].join('\n');
      const files: RenderedFile[] = [
        { relPath: `${dirFor(h, ctx.scope)}/skills/jig/SKILL.md`, content },
      ];
      if (h.commands && ctx.commandBody) {
        files.push({
          relPath: `${dirFor(h, ctx.scope)}/${h.commands.dir}/jig.${h.commands.format}`,
          content:
            h.commands.format === 'toml'
              ? tomlCommand(ctx.commandBody)
              : markdownCommand(ctx.commandBody, ctx.subcommands ?? []),
        });
      }
      return files;
    },
    referenceDir(scope: Scope): string {
      return `${dirFor(h, scope)}/skills/jig`;
    },
    argsPlaceholder: h.commands?.format === 'toml' ? '{{args}}' : '$ARGUMENTS',
  };
}

/**
 * A markdown slash command: YAML frontmatter, then the body. `argument-hint`
 * shows the subcommands in the harness's own command picker, so someone typing
 * `/jig ` sees what is available without reading anything.
 */
function markdownCommand(body: string, subcommands: string[]): string {
  return [
    '---',
    `description: ${quoteYamlString(COMMAND_DESCRIPTION)}`,
    `argument-hint: ${subcommands.join('|')} [flags]`,
    '---',
    '',
    body,
    '',
  ].join('\n');
}

/** TOML's literal multi-line string delimiter. */
const TOML_DELIM = "'''";

/**
 * Gemini's TOML form. The body goes in a literal multi-line string, which has
 * no escape processing — so a body containing a quote or a backslash needs no
 * escaping, and can only terminate the string early by containing the
 * delimiter itself, which is swapped out.
 */
function tomlCommand(body: string): string {
  const safe = body.split(TOML_DELIM).join('"""');
  return [
    `description = ${JSON.stringify(COMMAND_DESCRIPTION)}`,
    `prompt = ${TOML_DELIM}`,
    safe,
    TOML_DELIM,
    '',
  ].join('\n');
}

export const SKILL_DIR_ADAPTERS: Adapter[] = SKILL_DIR_HARNESSES.map(skillDirAdapter);
