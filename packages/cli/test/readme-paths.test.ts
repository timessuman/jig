import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADAPTERS, getAdapter, skillFilesFor } from '../src/adapters/registry.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * The README's slash-command table is a promise about where files land, and it
 * was written from memory once — it claimed `.agents/commands/jig.md` for the
 * generic adapter, which has no command mechanism at all. Assert it against the
 * adapters instead.
 */
const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');

const ctx = (scope: 'project' | 'global') => ({
  version: '0.4.0',
  scope,
  skillBody: 'BODY',
  commandBody: 'COMMAND $ARGUMENTS',
  commandPrefix: '/jig ',
});

describe('the README slash-command table matches the adapters', () => {
  it('names the real command path for every harness that has one', () => {
    for (const adapter of ADAPTERS) {
      const project = skillFilesFor(adapter, ctx('project')).map((f) => f.relPath);
      const global = skillFilesFor(adapter, ctx('global')).map((f) => f.relPath);
      const commandFile = [...project, ...global].find(
        (p) => /\/(commands?|prompts)\//.test(p) && /jig\.(md|toml)$/.test(p),
      );
      if (!commandFile) continue;
      expect(readme, `README does not mention ${adapter.name}'s command file`).toContain(
        commandFile,
      );
    }
  });

  it('claims no command file for a harness that has none', () => {
    // generic: `.agents/skills/` is a skills convention, not a harness.
    const paths = [
      ...skillFilesFor(getAdapter('generic'), ctx('project')).map((f) => f.relPath),
      ...skillFilesFor(getAdapter('generic'), ctx('global')).map((f) => f.relPath),
    ];
    expect(paths.filter((p) => p.includes('command'))).toEqual([]);
    expect(readme, 'README claims a generic command file').not.toContain('.agents/commands/');
  });
});
