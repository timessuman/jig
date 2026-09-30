import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentFileProblems, agentsGuide, ensureAgentFiles } from '../src/install/agent-files.js';
import { ship } from '../src/commands/ship.js';
import { gate } from '../src/commands/gate.js';
import { execFileSync } from 'node:child_process';

/**
 * Most people run Jig through an agent, and AGENTS.md is the file agents read
 * first. Jig keeps a marked block there, and a CLAUDE.md that imports it for
 * Claude Code; the rest of both files is the project's.
 */
let root: string;
let home: string;
const read = (f: string) => readFileSync(join(root, f), 'utf8');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-agent-files-'));
  home = mkdtempSync(join(tmpdir(), 'jig-agent-home-'));
  mkdirSync(join(root, '.jig'), { recursive: true });
  writeFileSync(join(root, '.jig', 'state.json'), '{}');
});
afterEach(() => {
  for (const d of [root, home]) rmSync(d, { recursive: true, force: true });
});

describe('the project\'s agent instructions', () => {
  it('creates AGENTS.md when it is missing, and CLAUDE.md importing it for Claude Code', () => {
    expect(ensureAgentFiles(root, { claude: true })).toEqual(['AGENTS.md', 'CLAUDE.md']);
    expect(read('AGENTS.md')).toContain('# Jig: the design system for this project\'s UI');
    expect(read('CLAUDE.md')).toMatch(/^@AGENTS\.md$/m);
  });

  it('writes into an AGENTS.md the project already has, and leaves its own text alone', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# House rules\n\nTabs, always.\n');
    ensureAgentFiles(root, { claude: false });
    const text = read('AGENTS.md');
    expect(text.startsWith('# House rules\n\nTabs, always.\n')).toBe(true);
    expect(text).toContain(agentsGuide().trim());
  });

  it('writes nothing when the block is already current, and puts back an edited one', () => {
    ensureAgentFiles(root, { claude: false });
    expect(ensureAgentFiles(root, { claude: false })).toEqual([]);
    writeFileSync(join(root, 'AGENTS.md'), read('AGENTS.md').replace('/jig ship', '/jig release'));
    expect(ensureAgentFiles(root, { claude: false })).toEqual(['AGENTS.md']);
    expect(read('AGENTS.md')).toContain('/jig ship');
  });

  it('reports a missing file or an edited block, in a project Jig has set up', () => {
    expect(agentFileProblems(root, home).join(' ')).toMatch(/AGENTS\.md is missing/);
    ensureAgentFiles(root, { claude: false });
    expect(agentFileProblems(root, home)).toEqual([]);
    writeFileSync(join(root, 'AGENTS.md'), read('AGENTS.md').replace('/jig ship', '/jig release'));
    expect(agentFileProblems(root, home).join(' ')).toMatch(/Jig's block has been edited or is out of date\. Run `jig update`/);
    rmSync(join(root, '.jig', 'state.json'));
    expect(agentFileProblems(root, home)).toEqual([]);
  });

  it('asks for CLAUDE.md wherever Claude Code has Jig installed', () => {
    ensureAgentFiles(root, { claude: false });
    mkdirSync(join(home, '.claude', 'skills', 'jig'), { recursive: true });
    writeFileSync(join(home, '.claude', 'skills', 'jig', 'SKILL.md'), '');
    expect(agentFileProblems(root, home).join(' ')).toMatch(/CLAUDE\.md is missing/);
  });

  it('keeps ship from being ready without them', () => {
    expect(ship({ projectRoot: root, version: '0.24.0' }).report).toMatch(/✗ AGENTS\.md is missing/);
  });

  // A session that removed or edited Jig's block is held; one that only
  // found it stale is told by `check`, not held.
  it('holds a session that removed Jig\'s block', () => {
    // The project as it stood before the session: set up a minute ago.
    const before = new Date(Date.now() - 60_000);
    const git = (...a: string[]) => execFileSync('git', a, { cwd: root, stdio: 'ignore', env: { ...process.env, GIT_AUTHOR_DATE: before.toISOString(), GIT_COMMITTER_DATE: before.toISOString() } });
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    ensureAgentFiles(root, { claude: false });
    utimesSync(join(root, 'AGENTS.md'), before, before);
    git('add', '-A'); git('commit', '-qm', 'setup');
    const transcript = join(root, 't.jsonl');
    writeFileSync(transcript, JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: 'tidy the docs' } }) + '\n');
    // Claude Code's install is looked for in the home folder: this one has none.
    const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
    process.env.HOME = home; process.env.USERPROFILE = home;
    try {
      const run = () => gate({ projectRoot: root, version: '0.24.0', input: { session_id: 's', transcript_path: transcript } });
      expect(run().reason ?? '').not.toMatch(/agent instructions/);
      writeFileSync(join(root, 'AGENTS.md'), '# House rules\n');
      expect(run().reason).toMatch(/Jig's agent instructions: AGENTS\.md has no Jig block/);
    } finally {
      process.env.HOME = saved.HOME; process.env.USERPROFILE = saved.USERPROFILE;
    }
  });
});

