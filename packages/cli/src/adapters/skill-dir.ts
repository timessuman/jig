import type { Scope } from '../install/manifest.js';
import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { SKILL_DESCRIPTION, quoteYamlString } from './types.js';

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
}

/**
 * Harnesses that read `<harness>/skills/<name>/` — the ecosystem
 * convention. Adding a harness that follows it is exactly one row here.
 */
export const SKILL_DIR_HARNESSES: SkillDirHarness[] = [
  { name: 'claude', dir: '.claude', displayName: 'Claude Code', extraFrontmatter: ['user-invocable: true'] },
  { name: 'cursor', dir: '.cursor', displayName: 'Cursor' },
  { name: 'opencode', dir: '.opencode', globalDir: '.config/opencode', displayName: 'opencode' },
  { name: 'generic', dir: '.agents', displayName: 'Generic (.agents/skills)' },
  // Proves the table design: this row is the entire diff needed to support
  // a sixth harness. Gemini CLI, Copilot CLI and others read `.agents/skills`
  // too, but Gemini also has its own `.gemini` skill directory.
  { name: 'gemini', dir: '.gemini', displayName: 'Gemini CLI' },
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
      return [{ relPath: `${dirFor(h, ctx.scope)}/skills/jig/SKILL.md`, content }];
    },
    referenceDir(scope: Scope): string {
      return `${dirFor(h, scope)}/skills/jig`;
    },
  };
}

export const SKILL_DIR_ADAPTERS: Adapter[] = SKILL_DIR_HARNESSES.map(skillDirAdapter);
