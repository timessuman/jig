import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { agentsBlock } from './types.js';

export const codex: Adapter = {
  name: 'codex',
  displayName: 'Codex',
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    // A bare AGENTS.md at $HOME is not how codex discovers global instructions;
    // global scope needs the agent-specific config directory instead.
    const relPath = ctx.scope === 'global' ? '.codex/AGENTS.md' : 'AGENTS.md';
    return [{ relPath, content: agentsBlock(ctx.skillBody) }];
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
};
