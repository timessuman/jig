import { execFileSync } from 'node:child_process';

/**
 * Whether `relPath` is ignored by the project's git configuration.
 *
 * `init` vendors the token files a teammate's build and a CI `jig check` both
 * depend on. Gitignored, the whole system silently does not exist for anyone
 * who did not run `init` themselves — the stylesheet `@import`s dangle, and the
 * first sign is a broken build on someone else's machine.
 *
 * Not being in a git repo, or not having git at all, is not ignored — the
 * answer has to be "no" rather than an error, since this only ever adds a
 * warning.
 */
export function isIgnored(projectRoot: string, relPath: string): boolean {
  // A directory pattern like `.jig/` matches a bare `.jig` only once the
  // directory exists on disk; queried with a trailing slash it matches either
  // way. `init` asks before the directory is there, so both forms are tried.
  const candidates = relPath.endsWith('/') ? [relPath] : [relPath, `${relPath}/`];
  return candidates.some((path) => {
    try {
      execFileSync('git', ['check-ignore', '-q', '--', path], {
        cwd: projectRoot,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return true; // exit 0 — the path is ignored
    } catch {
      // Exit 1 means "not ignored"; 128 means not a repo. Both are "no".
      return false;
    }
  });
}
