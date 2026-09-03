import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPackageRoot } from '../../src/paths.js';

export const repoRoot = join(getPackageRoot(), '..', '..');

/**
 * The commands `src/index.ts` actually registers on the commander program,
 * read out of the source rather than listed by hand.
 *
 * A hand-maintained list was the reason the stale-metadata bug survived: when
 * `check` shipped, nobody updated either the list or
 * `templates/command-metadata.json`, so the guard that was supposed to catch
 * the drift agreed with it and stayed green. A baseline agent then reported
 * "the `check` command is live, even though the vendored SKILL.md still lists
 * it as 'planned'" and had to run `--help` to find out what was true.
 *
 * Read by parsing, not by importing, because `src/index.ts` calls
 * `program.parse()` at module scope and would consume the test runner's argv.
 */
export function registeredCommands(): string[] {
  const src = readFileSync(join(repoRoot, 'packages/cli/src/index.ts'), 'utf8');
  return [...src.matchAll(/^\s*\.command\('([a-z-]+)'\)/gm)].map((m) => m[1]).sort();
}

export function commandMetadata(): Record<
  string,
  { description: string; argumentHint: string; status: string }
> {
  return JSON.parse(readFileSync(join(repoRoot, 'templates/command-metadata.json'), 'utf8'));
}
