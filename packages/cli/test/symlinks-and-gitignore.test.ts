import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { selectFiles } from '../src/check/files.js';
import { isIgnored } from '../src/init/gitignore.js';

let project: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-link-'));
  mkdirSync(join(project, 'src'), { recursive: true });
  writeFileSync(join(project, 'package.json'), '{"name":"x"}');
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

/**
 * M1. `wholeRepoFiles` walked with `withFileTypes` and collected only on
 * `isFile()`/`isDirectory()`. A symlink is neither, so it was skipped in
 * silence — and a monorepo with a shared `styles/` symlinked into an app
 * package had that whole tree checked as nothing at all.
 */
describe('the repo walk follows symlinks', () => {
  it('finds a symlinked stylesheet', () => {
    mkdirSync(join(project, 'shared'), { recursive: true });
    writeFileSync(join(project, 'shared', 'tokens.css'), '.a { color: red; }\n');
    symlinkSync(join(project, 'shared', 'tokens.css'), join(project, 'src', 'linked.css'));
    expect(selectFiles(project, true).files).toContain('src/linked.css');
  });

  it('descends into a directory symlinked in from outside the repo', () => {
    // The real M1 case: a monorepo's shared `styles/` lives outside this
    // package, so the link is the ONLY way the walk can reach it.
    const outside = mkdtempSync(join(tmpdir(), 'jig-shared-'));
    mkdirSync(join(outside, 'css'), { recursive: true });
    writeFileSync(join(outside, 'css', 'a.css'), '.a { color: red; }\n');
    symlinkSync(join(outside, 'css'), join(project, 'src', 'styles'));
    expect(selectFiles(project, true).files).toContain('src/styles/a.css');
    rmSync(outside, { recursive: true, force: true });
  });

  it('reports a file reachable by two paths only once', () => {
    // Without the cycle guard's realpath set, a directory symlinked beside its
    // own target would double every finding inside it.
    mkdirSync(join(project, 'shared'), { recursive: true });
    writeFileSync(join(project, 'shared', 'a.css'), '.a { color: red; }\n');
    symlinkSync(join(project, 'shared'), join(project, 'src', 'alias'));
    const css = selectFiles(project, true).files.filter((f) => f.endsWith('a.css'));
    expect(css).toHaveLength(1);
  });

  it('does not hang on a symlink loop', () => {
    // A link pointing at an ancestor is a cycle; the walk must terminate.
    symlinkSync(project, join(project, 'src', 'loop'));
    expect(() => selectFiles(project, true)).not.toThrow();
  });

  it('ignores a broken symlink rather than throwing', () => {
    symlinkSync(join(project, 'nope.css'), join(project, 'src', 'dangling.css'));
    expect(() => selectFiles(project, true)).not.toThrow();
    expect(selectFiles(project, true).files).not.toContain('src/dangling.css');
  });
});

/**
 * M9. `init` vendors the tokens a teammate's build and a CI `jig check` both
 * depend on. Gitignored, the whole system silently does not exist for anyone
 * who did not run `init` themselves.
 */
describe('detecting a gitignored .jig/', () => {
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=T', ...args], { cwd: project });

  it('reports .jig/ as ignored when it is', () => {
    git('init', '-q');
    writeFileSync(join(project, '.gitignore'), '.jig/\n');
    expect(isIgnored(project, '.jig')).toBe(true);
  });

  it('reports it as not ignored when it is tracked', () => {
    git('init', '-q');
    writeFileSync(join(project, '.gitignore'), 'node_modules/\n');
    expect(isIgnored(project, '.jig')).toBe(false);
  });

  it('says not-ignored outside a git repo rather than failing', () => {
    expect(isIgnored(project, '.jig')).toBe(false);
  });
});
