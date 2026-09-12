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

/**
 * Every long flag each command registers, read out of `src/index.ts` the same
 * way and for the same reason.
 *
 * `.option('--list', ...)` is attributed to the nearest preceding
 * `.command('x')`, which is exactly how commander scopes them.
 *
 * Scanned over the whole source rather than line by line. The line-based
 * version required the flag string to sit on the same line as `.option(`, so
 * reformatting one option across several lines — to fit a longer description,
 * or to add a comment above it — silently dropped that flag from the metadata
 * and from every guard built on it. A flag can go missing here without anyone
 * touching a flag, which is the failure this helper exists to prevent.
 */
export function registeredFlags(): Record<string, string[]> {
  const src = readFileSync(join(repoRoot, 'packages/cli/src/index.ts'), 'utf8');
  const out: Record<string, string[]> = {};
  let current: string | null = null;
  // One pass, both token shapes, in source order — `\s*` spans newlines, so the
  // argument may sit on its own line.
  const TOKEN = /\.command\(\s*'([a-z-]+)'\s*\)|\.option\(\s*'([^']*)'/g;
  for (const m of src.matchAll(TOKEN)) {
    if (m[1] !== undefined) {
      current = m[1];
      out[current] ??= [];
      continue;
    }
    if (!current) continue;
    for (const flag of m[2].matchAll(/--[a-z][a-z-]*/g)) out[current].push(flag[0]);
  }
  return out;
}
