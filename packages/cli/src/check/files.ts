import { execFileSync } from 'node:child_process';
import { readdirSync, type Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', '.jig']);

function isGitRepo(root: string): boolean {
  try {
    // A bare repository prints `false` to stdout and still exits 0, so the
    // exit code alone can't distinguish "inside a work tree" from "inside a
    // bare repo" — the stdout content is the actual answer.
    const out = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() === 'true';
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
 *
 * Both commands run with `-c core.quotePath=false` and `-z`, and the output
 * is split on NUL rather than newline. Git's default `core.quotePath=true`
 * renders any filename with a non-ASCII byte as a quoted C-style literal
 * (e.g. `"src/\303\251.css"`); joined onto `root` as-is, that literal never
 * matches a real file, `readFileSync` throws, and `run.ts` silently treats
 * it as a deleted file. `-z` (NUL-terminated, unquoted paths) sidesteps
 * quoting entirely and also removes any hazard from a newline in a
 * filename.
 */
function gitChangedFiles(root: string): string[] {
  // A repository with no commits has an unborn HEAD, so `git diff … HEAD`
  // fails. `git init && jig install && jig check` is a plausible first five
  // minutes, and it should not exit with a raw git error — treat it as
  // "nothing committed to compare against" and let the caller fall back to
  // scanning everything.
  let diffOut: string;
  try {
    diffOut = execFileSync(
      'git',
      ['-c', 'core.quotePath=false', 'diff', '--name-only', '--relative', '-z', 'HEAD'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    diffOut = '';
  }
  // `ls-files` can fail too — same bare-repo/detached edge cases `diff` can
  // hit — and previously had no guard at all, so it could crash the whole
  // scan instead of falling back like `diff` does.
  let untrackedOut: string;
  try {
    untrackedOut = execFileSync(
      'git',
      ['-c', 'core.quotePath=false', 'ls-files', '--others', '--exclude-standard', '-z'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    untrackedOut = '';
  }
  const files = new Set<string>();
  for (const entry of [...diffOut.split('\0'), ...untrackedOut.split('\0')]) {
    const f = entry.trim();
    if (f) files.add(f);
  }
  return [...files];
}

function isExcluded(relPath: string): boolean {
  return relPath.split('/').some((segment) => EXCLUDE_DIRS.has(segment));
}

function walk(root: string, dir: string, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // A real repo can contain a root-owned mount, another user's `.venv`, or
    // any other directory this process can't read. One unreadable directory
    // used to abort the entire scan with EACCES and exit 1 — no report at
    // all. Skip it and keep walking the rest of the tree instead.
    return;
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(root, abs, out);
    } else if (entry.isFile()) {
      out.push(relative(root, abs).split(sep).join('/'));
    }
  }
}

export function wholeRepoFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, root, out);
  return out;
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
