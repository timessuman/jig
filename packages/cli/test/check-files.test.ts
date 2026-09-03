import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { selectFiles } from '../src/check/files.js';

let root: string;

function git(...args: string[]) {
  execFileSync('git', args, { cwd: root, stdio: 'pipe' });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-check-files-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('selectFiles', () => {
  it('falls back to whole-repo when the target is not a git repo', () => {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.css'), '.a{}');
    writeFileSync(join(root, 'src', 'b.css'), '.b{}');
    const { files, mode } = selectFiles(root, false);
    expect(mode).toBe('all');
    expect(files.sort()).toEqual(['src/a.css', 'src/b.css']);
  });

  it('forces whole-repo with --all even inside a git repo with changes', () => {
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    writeFileSync(join(root, 'a.css'), '.a{}');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');
    writeFileSync(join(root, 'b.css'), '.b{}'); // untracked

    const { files, mode } = selectFiles(root, true);
    expect(mode).toBe('all');
    expect(files.sort()).toEqual(['a.css', 'b.css']);
  });

  it('returns only changed + untracked files by default in a git repo', () => {
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    writeFileSync(join(root, 'a.css'), '.a{}');
    writeFileSync(join(root, 'untouched.css'), '.u{}');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');

    writeFileSync(join(root, 'a.css'), '.a{color:red}'); // modified
    writeFileSync(join(root, 'new.css'), '.n{}'); // untracked

    const { files, mode } = selectFiles(root, false);
    expect(mode).toBe('changed');
    expect(files.sort()).toEqual(['a.css', 'new.css']);
    expect(files).not.toContain('untouched.css');
  });

  it('falls back to whole-repo when there is nothing changed', () => {
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    writeFileSync(join(root, 'a.css'), '.a{}');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');

    const { files, mode } = selectFiles(root, false);
    expect(mode).toBe('all');
    expect(files).toEqual(['a.css']);
  });

  it('always excludes node_modules, dist, .git and .jig', () => {
    mkdirSync(join(root, 'node_modules', 'x'), { recursive: true });
    mkdirSync(join(root, 'dist'), { recursive: true });
    mkdirSync(join(root, '.jig', 'tokens'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'x', 'y.css'), '.a{}');
    writeFileSync(join(root, 'dist', 'out.css'), '.a{}');
    writeFileSync(join(root, '.jig', 'tokens', 'brand.default.css'), ':root{}');
    writeFileSync(join(root, 'src.css'), '.a{}');

    const { files } = selectFiles(root, false);
    expect(files).toEqual(['src.css']);
  });

  // I3: an unreadable directory (a root-owned mount, another user's
  // .venv, ...) used to abort the whole scan with EACCES and exit 1 — no
  // report at all. It must be skipped, and the rest of the tree still
  // walked.
  it('skips an unreadable directory rather than aborting the whole scan', () => {
    writeFileSync(join(root, 'a.css'), '.a{}');
    mkdirSync(join(root, 'locked'), { recursive: true });
    writeFileSync(join(root, 'locked', 'b.css'), '.b{}');
    mkdirSync(join(root, 'ok'), { recursive: true });
    writeFileSync(join(root, 'ok', 'c.css'), '.c{}');
    chmodSync(join(root, 'locked'), 0o000);

    try {
      const { files } = selectFiles(root, false);
      expect(files.sort()).toEqual(['a.css', 'ok/c.css']);
    } finally {
      chmodSync(join(root, 'locked'), 0o755);
    }
  });

  // I6: `git rev-parse --is-inside-work-tree` prints `false` and still exits
  // 0 inside a bare repository. Checking the exit code alone made
  // `isGitRepo` return true for a bare repo, and the later `ls-files` call
  // threw. A bare repo must fall back to a whole-repo scan, not crash.
  it('falls back to whole-repo inside a bare repository instead of throwing', () => {
    git('init', '--bare', '-q');
    writeFileSync(join(root, 'a.css'), '.a{}');

    // Must not throw (the old code's `ls-files` call would, once
    // `isGitRepo` wrongly returned true for a bare repo) and must fall back
    // to a whole-repo walk rather than trying to diff a bare repo's HEAD.
    const { files, mode } = selectFiles(root, false);
    expect(mode).toBe('all');
    expect(files).toContain('a.css');
  });

  // I4: git's default core.quotePath=true renders a non-ASCII filename as a
  // quoted C-style literal (e.g. `"src/\303\251.css"`), which never matches
  // a real path when joined onto root — the file silently drops out of
  // changed-files mode even though `--all` would report it. `-c
  // core.quotePath=false -z` sidesteps this regardless of the ambient repo
  // config.
  it('picks up a modified file with a non-ASCII name in changed-files mode', () => {
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    git('config', 'core.quotePath', 'true'); // the default; asserted explicitly
    const name = 'é.css';
    writeFileSync(join(root, name), '.a{}');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');

    writeFileSync(join(root, name), '.a{color:red}'); // modified

    const { files, mode } = selectFiles(root, false);
    expect(mode).toBe('changed');
    expect(files).toEqual([name]);
  });

  // I5: build output scanned like source pollutes both `check`'s findings
  // and (via wholeRepoFiles, which init/detect.ts also uses) brand-colour
  // derivation. These directories are excluded statically regardless of
  // whether the target is a git repo.
  it('excludes .next, build, out, coverage, .svelte-kit and vendor', () => {
    for (const dir of ['.next', 'build', 'out', 'coverage', '.svelte-kit', 'vendor']) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, 'artifact.css'), '.a{}');
    }
    writeFileSync(join(root, 'src.css'), '.a{}');

    const { files } = selectFiles(root, true);
    expect(files).toEqual(['src.css']);
  });

  it('honours .gitignore for a custom build directory the static list does not name', () => {
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    writeFileSync(join(root, '.gitignore'), 'generated/\n');
    mkdirSync(join(root, 'generated'), { recursive: true });
    writeFileSync(join(root, 'generated', 'artifact.css'), '.a{ color: #e11d48; }');
    writeFileSync(join(root, 'src.css'), '.a{}');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');

    const { files } = selectFiles(root, true);
    expect(files.sort()).toEqual(['.gitignore', 'src.css']);
  });
});
