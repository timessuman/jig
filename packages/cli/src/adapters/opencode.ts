import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { SKILL_DESCRIPTION, quoteYamlString } from './types.js';

export const opencode: Adapter = {
  name: 'opencode',
  displayName: 'opencode',
  supportsScope: () => true,
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    const content = [
      '---',
      'name: jig',
      `description: ${quoteYamlString(SKILL_DESCRIPTION)}`,
      '---',
      '',
      ctx.skillBody,
      '',
    ].join('\n');
    return [{ relPath: '.opencode/skills/jig/SKILL.md', content }];
  },
};
