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
  // codex has no skill directory: AGENTS.md is a plain file (project root,
  // or `.codex/` for a global install). Reference material lives in a
  // `.jig` directory right beside it.
  referenceDir: (scope) => (scope === 'global' ? '.codex/.jig' : '.jig'),
};
