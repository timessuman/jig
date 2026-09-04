import type { Scope } from '../install/manifest.js';

export interface RenderedFile {
  /**
   * Path relative to the install root for `ctx.scope` — e.g.
   * `.claude/skills/jig/SKILL.md` relative to the project root when
   * `ctx.scope === 'project'`. Always relative: never an absolute path, never
   * containing a `..` segment (see `assertSafeRelPath`).
   *
   * relPath is NOT guaranteed scope-invariant: an adapter may (and several
   * do) return a different relative path depending on `ctx.scope`, because
   * the project-scope location for that agent is not where it looks for a
   * machine-wide install — e.g. codex writes `AGENTS.md` for project scope
   * but `.codex/AGENTS.md` for global scope. Resolving which absolute
   * directory a scope's install root points at (the project root vs. the
   * user's home directory) is the install command's job, not the adapter's
   * — the adapter only picks the correct *relative* shape for the given
   * scope.
   */
  relPath: string;
  content: string;
}

export interface AdapterContext {
  version: string;
  scope: Scope;
  skillBody: string;
  commandPrefix: string;
  /**
   * The rendered slash-command body, already carrying the harness's own
   * argument placeholder. Absent when a caller only wants the skill file.
   */
  commandBody?: string;
  /** Subcommands the command file should offer — the ones actually implemented. */
  subcommands?: string[];

}

export interface Adapter {
  name: string;
  displayName: string;
  skillFiles(ctx: AdapterContext): RenderedFile[];
  /**
   * Directory, relative to the install root for `scope` (the project root
   * for `'project'`, the user's home directory for `'global'`), where Jig's
   * reference material — `rules/*.md`, `rules.index.json`, `LICENSE`,
   * `NOTICE`, and this adapter's own `manifest.json` — is written.
   *
   * For an adapter with a real skill directory (every harness in
   * `adapters/skill-dir.ts` — claude, cursor, opencode, generic, gemini,
   * and any future row added to that table) this is that directory, so the
   * reference material sits beside the skill file the way impeccable keeps
   * `reference/*.md` inside its own skill directory. For codex — the one
   * marker-based adapter left, writing into `AGENTS.md`, which has no
   * skill directory — this is a `.jig` directory next to wherever
   * `AGENTS.md` lands.
   *
   * `install`/`update` build the `rules_path` baked into the rendered
   * skill/instructions body from this value too (see `commands/install.ts`),
   * so it must resolve from wherever the corresponding `skillFiles()` output
   * actually lands, for both scopes — every adapter supports both scopes.
   */
  referenceDir(scope: Scope): string;
  /**
   * The placeholder this harness substitutes the slash command's arguments
   * into — `$ARGUMENTS` for the markdown harnesses, `{{args}}` for Gemini's
   * TOML. Absent for a harness with no slash commands.
   */
  argsPlaceholder?: string;
}

export const COMMAND_DESCRIPTION =
  'Run a Jig design-system command: set the project up, review the UI against the rules, or refresh the install.';

export const SKILL_DESCRIPTION =
  'Design system rules for generating and reviewing UI. Load before building any interface.';

/**
 * Throws if `relPath` is unsafe to join against a user's project (or home) root:
 * an absolute POSIX path (starts with `/`), a Windows drive-prefixed path (e.g. `C:\...`),
 * or a path containing a `..` segment. Adapters must never produce such a path — see
 * `skillFilesFor` in `registry.ts`, which runs this over every file an adapter returns.
 */
export function assertSafeRelPath(relPath: string, adapterName: string): void {
  const isAbsolute = relPath.startsWith('/') || /^[A-Za-z]:/.test(relPath);
  const hasDotDotSegment = relPath.split(/[\\/]/).includes('..');
  if (isAbsolute || hasDotDotSegment) {
    throw new Error(`Adapter '${adapterName}' produced an unsafe relPath: ${relPath}`);
  }
}

/**
 * Renders `value` as a double-quoted YAML scalar, escaping embedded backslashes and
 * double quotes. Use this for any value interpolated into YAML frontmatter — e.g.
 * `description: ${quoteYamlString(SKILL_DESCRIPTION)}` — so a future value containing
 * a colon, a leading `-`, or a `#` cannot silently produce invalid frontmatter.
 */
export function quoteYamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export const BLOCK_START = '<!-- jig:start -->';
export const BLOCK_END = '<!-- jig:end -->';

/**
 * Wraps `skillBody` in `BLOCK_START` / `BLOCK_END` markers so an AGENTS.md-writing
 * adapter's output can later be located and replaced in-place within a user's existing
 * AGENTS.md, rather than overwriting the whole file.
 */
export function agentsBlock(skillBody: string): string {
  return [BLOCK_START, '', '# Jig — UI rules', '', skillBody, '', BLOCK_END, ''].join('\n');
}

/**
 * A short pointer for `AGENTS.md`, naming the skill rather than inlining it.
 *
 * `AGENTS.md` is read into the context of every session, so the full rule
 * summary sat there permanently whether the task touched UI or not — the one
 * cost the skill-directory convention exists to avoid, and the reason Codex
 * was the only harness still paying it. The skill itself now lives at
 * `skillPath`, where Codex loads it on demand.
 *
 * The pointer stays because project-scope skill discovery is unproven (only
 * `$CODEX_HOME/skills` is documented in the binary), so this guarantees an
 * agent can still find the rules by reading a file it definitely loads.
 */
export function agentsPointer(skillPath: string): string {
  return [
    BLOCK_START,
    '',
    '# Jig — UI rules',
    '',
    `This project uses Jig, a design system for generating and reviewing UI.`,
    `Before building or reviewing any interface, read \`${skillPath}\` and follow it.`,
    'It is short, and it tells you which rule files to load for the task at hand.',
    '',
    BLOCK_END,
    '',
  ].join('\n');
}
