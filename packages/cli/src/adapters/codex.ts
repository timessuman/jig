import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { agentsBlock } from './types.js';

export const codex: Adapter = {
  name: 'codex',
  displayName: 'Codex',
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    // A bare AGENTS.md at $HOME is not how codex discovers global instructions;
    // global scope needs the agent-specific config directory instead.
    const relPath = ctx.scope === 'global' ? '.codex/AGENTS.md' : 'AGENTS.md';
    const files: RenderedFile[] = [{ relPath, content: agentsBlock(ctx.skillBody) }];

    // Codex's command templates live in `.codex/prompts/<name>.md` and
    // substitute `$ARGUMENTS`, so `/jig init` reaches the same dispatching body
    // every other harness gets. Evidence, since this was got wrong once by
    // assuming and once by testing the wrong thing:
    //
    // - The Codex binary carries the strings "No command template body was
    //   found." and "$ARGUMENTS" together, alongside "migrated-command-skills".
    // - A first probe put a file in `~/.codex/prompts/` and drove it with
    //   `codex exec`, which did not expand it — `codex exec` is the
    //   non-interactive path, and slash commands are a TUI affordance. That
    //   result says nothing about whether the file is read in the TUI, which is
    //   how people actually use Codex, so it is not a reason to ship nothing.
    //
    // Unlike the skill-directory harnesses, the prompts directory is `.codex/`
    // at both scopes — under the project root for a project install, under
    // $HOME for a global one — matching where its reference bundle already goes.
    if (ctx.commandBody) {
      files.push({
        relPath: '.codex/prompts/jig.md',
        content: `${ctx.commandBody}\n`,
      });
    }
    return files;
  },
  /**
   * codex has no skill directory: AGENTS.md is a plain file (project root, or
   * `.codex/` for a global install). Reference material lives under `.codex/`
   * at BOTH scopes.
   *
   * Project scope used to be a bare `.jig`, which put Jig's rules, index,
   * licence and manifest into the one directory 0.4.0 reserves for the
   * project's own material — the brand file, the mode copies, `state.json`.
   * That cost more than tidiness:
   *
   * - `detectLegacyRules` scans `.jig/` for install artifacts and offers to
   *   remove them. Under the old layout a *live* codex install looked exactly
   *   like the legacy one, so the migration path could offer to delete the
   *   install just made.
   * - One directory holding two manifests is what let a stale
   *   `.jig/manifest.json` hijack `update` and resurrect the vendored layout.
   *
   * Mirroring the global path keeps codex's own convention and leaves `.jig/`
   * unambiguously the project's.
   */
  referenceDir: () => '.codex/.jig',
  argsPlaceholder: '$ARGUMENTS',
};
