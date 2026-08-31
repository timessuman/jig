import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { SKILL_DESCRIPTION, quoteYamlString } from './types.js';

export const cursor: Adapter = {
  name: 'cursor',
  displayName: 'Cursor',
  supportsScope: (scope) => scope === 'project',
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    const content = [
      '---',
      `description: ${quoteYamlString(SKILL_DESCRIPTION)}`,
      'alwaysApply: false',
      '---',
      '',
      ctx.skillBody,
      '',
    ].join('\n');
    return [{ relPath: '.cursor/rules/jig.mdc', content }];
  },
};
