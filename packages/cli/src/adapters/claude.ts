import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { SKILL_DESCRIPTION, quoteYamlString } from './types.js';

export const claude: Adapter = {
  name: 'claude',
  displayName: 'Claude Code',
  supportsScope: () => true,
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    const content = [
      '---',
      'name: jig',
      `description: ${quoteYamlString(SKILL_DESCRIPTION)}`,
      'user-invocable: true',
      '---',
      '',
      ctx.skillBody,
      '',
    ].join('\n');
    return [{ relPath: '.claude/skills/jig/SKILL.md', content }];
  },
};
