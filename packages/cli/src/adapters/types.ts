import type { Scope } from '../install/manifest.js';

export interface RenderedFile {
  /**
   * Path relative to the target scope's root — e.g. `.claude/skills/jig/SKILL.md`.
   * Always relative: never an absolute path, never containing a `..` segment (see
   * `assertSafeRelPath`). It is scope-invariant — an adapter returns the same relPath
   * regardless of `ctx.scope`. Resolving `global` scope to a real filesystem location
   * (e.g. a home directory) is the install command's job, not the adapter's.
   */
  relPath: string;
  content: string;
}

export interface AdapterContext {
  version: string;
  scope: Scope;
  skillBody: string;
  commandPrefix: string;
}

export interface Adapter {
  name: string;
  displayName: string;
  supportsScope(scope: Scope): boolean;
  skillFiles(ctx: AdapterContext): RenderedFile[];
}

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
