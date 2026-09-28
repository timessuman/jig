import { describe, it, expect, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate } from '../src/commands/gate.js';

/**
 * jig-site: a critique session swapped the rule its page demonstrates to get
 * past a block, then re-judged the page it had changed; a mockup session wrote
 * the site's stylesheet; and the session that recorded a mockup's approval
 * then redrew it. spec, mockup and critique write records under .jig/, and an
 * approval is of the drawing the owner saw.
 */
let root: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
const commit = (m: string) => { git('add', '-A'); git('-c', 'user.email=t@example.test', '-c', 'user.name=t', 'commit', '-q', '-m', m); };
// Transcripts live outside the project, as Claude Code keeps them.
const transcripts = mkdtempSync(join(tmpdir(), 'jig-transcripts-'));
let started: string;
const session = (command: string) => {
  const path = join(transcripts, `t-${command}.jsonl`);
  writeFileSync(path, JSON.stringify({ type: 'user', timestamp: started, message: { content: `<command-name>/jig</command-name>\n<command-args>${command} home</command-args>` } }) + '\n');
  return gate({ projectRoot: root, version: '0.21.0', input: { session_id: command, transcript_path: path } });
};
const spec = (mockup: string) => `---
feature: land on the site
surface: home
mode: editorial
sizes:
  phone:
    regions: [headline, proof]
    nav: Menu button, top left
  tablet:
    same-as: phone
    why: one column
  desktop:
    same-as: phone
    why: one column
  wide:
    same-as: phone
    why: one column
confirmed: true
mockup: ${mockup}
mockup_at: .jig/mockups/home.html
---
Prose.`;
const drawing = (extra = '') => ['phone', 'tablet', 'desktop', 'wide'].map((s) =>
  `<section class="frame" data-size="${s}"><span class="name">headline</span><span class="name">proof</span>${extra}</section>`).join('\n');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-records-'));
  git('init', '-q');
  writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }] }));
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'index.astro'), '<h1>Jig</h1>\n<p data-rule="A-01"></p>\n');
  mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
  mkdirSync(join(root, '.jig', 'mockups'), { recursive: true });
  writeFileSync(join(root, '.jig', 'specs', 'home.spec.md'), spec('pending'));
  writeFileSync(join(root, '.jig', 'mockups', 'home.html'), drawing());
  commit('the page, its spec and its drawing');
  // The session begins after that commit; git dates to the second.
  started = new Date(Date.now() + 1500).toISOString();
});
// A commit made during the session, dated after it began.
const commitLater = (m: string) => {
  git('add', '-A');
  execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', 'commit', '-q', '-m', m], { cwd: root, stdio: 'ignore', env: { ...process.env, GIT_COMMITTER_DATE: new Date(Date.now() + 60_000).toISOString(), GIT_AUTHOR_DATE: new Date(Date.now() + 60_000).toISOString() } });
};

describe('spec, mockup and critique write under .jig/ only', () => {
  it('stops a critique that changed the page it judges, committed or not', () => {
    writeFileSync(join(root, 'src', 'index.astro'), '<h1>Jig</h1>\n<p data-rule="A-139"></p>\n');
    expect(session('critique').reason).toMatch(/critique writes under \.jig\/ only, and this session changed src\/index\.astro.*grading its own work/s);
    commitLater('swap the rule');
    expect(session('critique').reason).toMatch(/this session changed src\/index\.astro/);
  });

  it('stops a mockup session that wrote the site\'s stylesheet', () => {
    writeFileSync(join(root, 'src', 'site.css'), ':root { --breakpoint-hero: 1228px; }\n');
    const during = new Date(Date.parse(started) + 5000);
    utimesSync(join(root, 'src', 'site.css'), during, during);
    expect(session('mockup').reason).toMatch(/mockup writes under \.jig\/ only, and this session changed src\/site\.css/);
  });

  it('lets them write their own records', () => {
    mkdirSync(join(root, '.jig', 'critique', 'home'), { recursive: true });
    writeFileSync(join(root, '.jig', 'critique', 'home', 'REPORT.md'), '# findings\n');
    writeFileSync(join(root, '.jig', 'mockups', 'home.html'), drawing('<span class="name">note</span>'));
    expect(session('mockup').reason ?? '').not.toMatch(/writes under \.jig\/ only/);
  });
});

describe('an approval is of the drawing the owner saw', () => {
  it('sends a drawing changed after its approval back to pending', () => {
    writeFileSync(join(root, '.jig', 'specs', 'home.spec.md'), spec('approved   # by the owner'));
    commit('record the approval');
    writeFileSync(join(root, '.jig', 'mockups', 'home.html'), drawing('<div data-width="1227"></div>'));
    expect(session('mockup').reason).toMatch(/home\.html has changed since the owner approved it \([0-9a-f]{7}\).*set `mockup: pending`/s);
  });

  it('leaves an approved drawing that is as the owner saw it', () => {
    writeFileSync(join(root, '.jig', 'specs', 'home.spec.md'), spec('approved   # by the owner'));
    commit('record the approval');
    expect(session('mockup').reason ?? '').not.toMatch(/changed since the owner approved it/);
    expect(readFileSync(join(root, '.jig', 'specs', 'home.spec.md'), 'utf8')).toMatch(/mockup: approved/);
  });
});
