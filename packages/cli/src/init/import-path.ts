import { relative, sep } from 'node:path';

/**
 * Computes the `@import` path from a CSS file at `fromAbsDir` to the target
 * file at `toAbsFile`, as a POSIX-style relative path (`@import` never
 * accepts a `~` expansion — that isn't a thing CSS or a bundler resolves, so
 * this never produces one, regardless of scope).
 *
 * This is what makes a **global** install coherent (see the init task
 * brief): the brand file is always written into the *project's own* tree, so
 * it is always import-reachable with an ordinary relative path. The mode
 * file, for a global install, still lives once in `$HOME/.jig/tokens/` — not
 * copied per project — and `node:path`'s `relative()` computes a perfectly
 * valid relative filesystem path to it from anywhere on the same machine,
 * with as many `../` segments as it takes. That path only resolves on the
 * machine (and the `$HOME`) it was generated for, which is the same
 * single-machine assumption a global install already makes for its agent
 * skill file (`~/.jig` is only ever readable by the agent running on that
 * box). It is not a promise that a CI runner or a teammate's machine can
 * build this stylesheet without their own global install — see the init
 * report for the tradeoff.
 */
export function relativeImportPath(fromAbsDir: string, toAbsFile: string): string {
  let rel = relative(fromAbsDir, toAbsFile).split(sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}
