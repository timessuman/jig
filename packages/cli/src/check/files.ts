import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// I5: a build/output directory scanned like source pollutes both detection
// (derives a brand colour from compiled/vendored CSS) and `check`'s findings
// (re-reports issues that don't exist in anything the user actually wrote).
// This static list is the fast-path prune during the directory walk itself
// (so these are never even descended into — important for `node_modules`-
// sized directories) and the sole answer for a non-git project. For a git
// repo, `wholeRepoFiles` additionally honours `.gitignore` via
// `git check-ignore` below, which catches whatever a project's own ignore
// rules list that this list doesn't (a custom output dir, `.turbo`, ...) —
// this list stays the fallback, not the only line of defence.
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.jig',
  '.next',
  'build',
  'out',
  'coverage',
  '.svelte-kit',
  'vendor',
]);

function isGitRepo(root: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * `--relative` makes `git diff` emit paths relative to `cwd` rather than
 * the repository's top level (its default) — `git ls-files` is already
 * cwd-relative by default. Without this the two commands would disagree
 * whenever `root` (an install root found by walking up to the nearest
 * `package.json`/`.git`/`jig.config.json`) sits below the actual git root,
 * e.g. a monorepo package.
 */
function gitChangedFiles(root: string): string[] {
  // A repository with no commits has an unborn HEAD, so `git diff … HEAD`
  // fails. `git init && jig install && jig check` is a plausible first five
  // minutes, and it should not exit with a raw git error — treat it as
  // "nothing committed to compare against" and let the caller fall back to
  // scanning everything.
  let diffOut: string;
  try {
    diffOut = execFileSync('git', ['diff', '--name-only', '--relative', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    diffOut = '';
  }
  const untrackedOut = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  });
  const files = new Set<string>();
  for (const line of [...diffOut.split('\n'), ...untrackedOut.split('\n')]) {
    const f = line.trim();
    if (f) files.add(f);
  }
  return [...files];
}

function isExcluded(relPath: string): boolean {
  return relPath.split('/').some((segment) => EXCLUDE_DIRS.has(segment));
}

function walk(root: string, dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(root, abs, out);
    } else if (entry.isFile()) {
      out.push(relative(root, abs).split(sep).join('/'));
    }
  }
}

/**
 * Filters `files` (root-relative, forward-slash paths) down to the ones
 * `.gitignore` does NOT ignore, via a single batched `git check-ignore
 * --stdin` call rather than one process per file. `git check-ignore` exits 1
 * (not an error — just "none of these are ignored") whenever nothing in the
 * batch matches; `execFileSync` still throws on that, so the exit code is
 * inspected on the caught error rather than treated as failure. Any other
 * failure (git missing, not actually a repo) leaves `files` unfiltered —
 * this is an additive correctness improvement, never a hard requirement.
 */
function filterGitIgnored(root: string, files: string[]): string[] {
  if (files.length === 0) return files;
  const parseIgnored = (out: string) => new Set(out.split('\n').map((l) => l.trim()).filter(Boolean));
  try {
    const out = execFileSync('git', ['check-ignore', '--stdin'], {
      cwd: root,
      input: `${files.join('\n')}\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const ignored = parseIgnored(out);
    return files.filter((f) => !ignored.has(f));
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) {
      const stdout = (err as { stdout?: Buffer | string }).stdout;
      const out = typeof stdout === 'string' ? stdout : (stdout?.toString('utf8') ?? '');
      const ignored = parseIgnored(out);
      return files.filter((f) => !ignored.has(f));
    }
    return files;
  }
}

export function wholeRepoFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, root, out);
  return isGitRepo(root) ? filterGitIgnored(root, out) : out;
}

export interface FileSelection {
  files: string[];
  mode: 'changed' | 'all';
}

/**
 * Default: changed files (`git diff --name-only HEAD` plus untracked).
 * `all: true` (the `--all` flag) forces whole-repo — the first-run case
 * against an existing codebase. Falls back to whole-repo when the target
 * isn't a git repo, or when there is nothing changed (an empty diff would
 * otherwise mean `check` silently does nothing).
 */
export function selectFiles(root: string, all: boolean): FileSelection {
  if (all || !isGitRepo(root)) return { files: wholeRepoFiles(root), mode: 'all' };

  const changed = gitChangedFiles(root).filter((f) => !isExcluded(f));
  if (changed.length === 0) return { files: wholeRepoFiles(root), mode: 'all' };
  return { files: changed, mode: 'changed' };
}
