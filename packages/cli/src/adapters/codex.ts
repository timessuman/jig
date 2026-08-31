import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { agentsBlock } from './types.js';

export const codex: Adapter = {
  name: 'codex',
  displayName: 'Codex',
  supportsScope: () => true,
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    return [{ relPath: 'AGENTS.md', content: agentsBlock(ctx.skillBody) }];
  },
};
