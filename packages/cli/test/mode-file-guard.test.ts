import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate } from '../src/commands/gate.js';

/**
 * jig-site: a make round told its three columns must fit at 1280 narrowed
 * `--size-rail` in mode.editorial.css, Jig's own file, which `update` refreshes.
 */
let root: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
const run = (command: string) => {
  const path = join(root, `t-${command}.jsonl`);
  writeFileSync(path, JSON.stringify({ type: 'user', message: { content: `<command-name>/jig</command-name>\n<command-args>${command}</command-args>` } }) + '\n');
  return gate({ projectRoot: root, version: '0.21.0', input: { session_id: command, transcript_path: path } });
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-mode-'));
  git('init', '-q'); git('config', 'user.email', 't@example.test'); git('config', 'user.name', 't');
  writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }] }));
  mkdirSync(join(root, '.jig'), { recursive: true });
  mkdirSync(join(root, 'src', 'styles', 'jig'), { recursive: true });
  writeFileSync(join(root, 'src', 'styles', 'jig', 'mode.editorial.css'), ':root { --size-rail: 288px; }\n');
  writeFileSync(join(root, 'src', 'styles', 'jig', 'brand.site.css'), ':root { --brand-h: 0; }\n');
  writeFileSync(join(root, '.jig', 'state.json'), JSON.stringify({ files: { 'src/styles/jig/mode.editorial.css': 'sha256:x', 'src/styles/jig/brand.site.css': 'sha256:y' } }));
  git('add', '-A'); git('commit', '-q', '-m', 'init');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("Jig's mode file", () => {
  it('stops a session that changed it', () => {
    writeFileSync(join(root, 'src', 'styles', 'jig', 'mode.editorial.css'), ':root { --size-rail: 283px; }\n');
    expect(run('make').reason).toMatch(/src\/styles\/jig\/mode\.editorial\.css changed in this session\. A mode file is Jig's/);
  });

  it('leaves the brand file to the project', () => {
    writeFileSync(join(root, 'src', 'styles', 'jig', 'brand.site.css'), ':root { --brand-h: 210; }\n');
    expect(run('make').reason ?? '').not.toMatch(/A mode file is Jig's/);
  });
});
