import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { agentsBlock } from './types.js';

export const generic: Adapter = {
  name: 'generic',
  displayName: 'Generic (AGENTS.md)',
  supportsScope: (scope) => scope === 'project',
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    return [{ relPath: 'AGENTS.md', content: agentsBlock(ctx.skillBody) }];
  },
};
