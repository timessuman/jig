import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
});
