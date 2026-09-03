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
  // Cursor has no notion of a skill directory — `.cursor/rules/jig.mdc` is a
  // single rule file living among a project's other `.cursor/rules/*.mdc`
  // files. Reference material gets its own `jig/` subdirectory there rather
  // than spilling rules/index/LICENSE/NOTICE directly into the shared
  // `.cursor/rules/` folder.
  referenceDir: () => '.cursor/rules/jig',
};
