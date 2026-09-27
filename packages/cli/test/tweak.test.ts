import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate } from '../src/commands/gate.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * `/jig tweak`: a change the approved mockup does not show, decided, specced,
 * built and re-judged in one pass. On jig-site half a day's rounds were changes
 * of that kind (a word that wrapped, a mark's colour, how a version is
 * written), each taken through decide, spec, make and two full critiques.
 *
 * The gate bounds it: the structure is as approved, the drawing is untouched,
 * and only the verdicts the tweak names may change, each of them re-judged.
 */
let root: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
const commit = (m: string) => { git('add', '-A'); git('commit', '-q', '-m', m); };
const dir = () => join(root, '.jig', 'critique', 'pricing');
const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
const ids = (pass: string) => index.filter((r) => (r.bucket === 'judgment' || r.bucket === 'hybrid') && r.pass === pass).map((r) => ({ id: r.id, verdict: 'ok', reason: `${r.id} holds on this page` }));

const spec = (regions = '[nav, plans]') => `---
feature: choose a plan
surface: pricing
mode: editorial
sizes:
  phone:
    regions: ${regions}
    nav: Menu button, top right
  tablet:
    regions: ${regions}
    nav: five links in a row
  desktop:
    regions: ${regions}
    nav: five links in a row
  wide:
    same-as: desktop
    why: content is capped, so 1600 adds margin and nothing else
confirmed: true
mockup: approved
mockup_at: .jig/mockups/pricing.html
---
Prose.`;

const run = (command: string) => {
  const path = join(root, `transcript-${command}.jsonl`);
  writeFileSync(path, JSON.stringify({ type: 'user', message: { content: `<command-name>/jig</command-name>\n<command-args>${command}</command-args>` } }) + '\n');
  return gate({ projectRoot: root, version: '0.19.0', input: { session_id: command, transcript_path: path } });
};

const readScreen = () => JSON.parse(readFileSync(join(dir(), 'screen.json'), 'utf8')) as { rendered: boolean; verdicts: Array<Record<string, string>> };
const rejudge = (id: string, at: string, verdict = 'ok') => {
  const screen = readScreen();
  const v = screen.verdicts.find((x) => x.id === id)!;
  Object.assign(v, { verdict, reason: `${id} re-judged on the changed page`, tweak: at });
  writeFileSync(join(dir(), 'screen.json'), JSON.stringify(screen));
};
const tweakRecord = (idsNamed: string[], at = '2026-09-26T14:02:00Z') =>
  writeFileSync(join(dir(), 'tweak.json'), JSON.stringify({ at, change: 'draw the GitHub mark in the quieter text colour', ids: idsNamed }));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-tweak-'));
  git('init', '-q');
  git('config', 'user.email', 't@example.test');
  git('config', 'user.name', 't');
  writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }] }));
  mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
  mkdirSync(join(root, '.jig', 'mockups'), { recursive: true });
  writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec());
  writeFileSync(join(root, '.jig', 'mockups', 'pricing.html'), '<section class="frame" data-size="phone"></section>');
  mkdirSync(dir(), { recursive: true });
  writeFileSync(join(dir(), 'screen.json'), JSON.stringify({ rendered: false, verdicts: [...ids('screen'), { id: 'P-14', verdict: 'ok', reason: 'nav reads as the spec says' }] }));
  writeFileSync(join(dir(), 'code.json'), JSON.stringify({ verdicts: ids('code') }));
  commit('approve the mockup, and critique the page');
  // The critique's own stop records the lock the tweak is held to.
  run('critique');
  commit('record the critique lock');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('/jig tweak', () => {
  it('passes a change that re-judges exactly what it names', () => {
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    const r = run('tweak');
    expect(r.reason ?? '').toBe('');
    expect(r.block).toBe(false);
  });

  it('refuses a verdict it changed but did not name', () => {
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    const other = readScreen().verdicts.find((v) => v.id !== 'A-60')!.id;
    rejudge(other, '2026-09-26T14:02:00Z', 'finding');
    expect(run('tweak').reason).toMatch(new RegExp(`a tweak changed verdicts it did not name \\(${other}\\)`));
  });

  it('refuses a verdict it named but did not re-judge', () => {
    tweakRecord(['A-60', 'D-96']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    expect(run('tweak').reason).toMatch(/tweak\.json names D-96 but no verdict for it carries `"tweak": "2026-09-26T14:02:00Z"`/);
  });

  it('asks for the record of what changed and what was re-judged', () => {
    expect(run('tweak').reason).toMatch(/\.jig\/critique\/pricing\/tweak\.json is missing/);
  });

  it('refuses a change to the structure the owner approved', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec('[nav, plans, faq]'));
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    expect(run('tweak').reason).toMatch(/the regions under `sizes:` differ from the ones the page had when the last critique judged it/);
  });

  it('lets region wording change, since copy is a tweak', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec('[nav, plans]').replace('Prose.', 'Prose, reworded.'));
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    expect(run('tweak').reason ?? '').not.toMatch(/regions under `sizes:`/);
  });

  it('refuses a change to the approved drawing', () => {
    writeFileSync(join(root, '.jig', 'mockups', 'pricing.html'), '<section class="frame" data-size="phone">changed</section>');
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    expect(run('tweak').reason).toMatch(/pricing\.html has changed since the last critique judged it/);
  });

  // jig-site: five owner rounds changed the header's regions after its mockup
  // was approved, each confirmed and critiqued. Held to the approval commit,
  // the first tweak on it could not pass.
  it('measures the structure against the last critique, not the first approval', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec('[nav, plans, faq]'));
    const screen = readScreen();
    screen.verdicts.find((v) => v.id === 'P-14')!.reason = 'nav reads as the spec says, with the faq below the plans';
    writeFileSync(join(dir(), 'screen.json'), JSON.stringify(screen));
    run('critique');
    commit('a confirmed round adds the faq, and a critique judges it');
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    const r = run('tweak');
    expect(r.reason ?? '').not.toMatch(/regions under `sizes:`/);
  });

  // jig-site: the header spec's `surface:` is a sentence; its critique lives
  // under the spec's file name, as every surface's does.
  it('finds the tweak record under the spec\'s file name, whatever `surface:` says', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec().replace('surface: pricing', 'surface: the pricing page (plans, and what each costs)'));
    commit('describe the surface');
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    expect(run('tweak').reason ?? '').toBe('');
  });

  // jig-site: the versions tweak was judged as a critique from its second stop,
  // because the command file loaded into the session and the tool results
  // quoting it say `/jig critique` on many lines.
  it('reads the command the user sent, not the documentation quoted after it', () => {
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    const path = join(root, 'transcript-quoted.jsonl');
    writeFileSync(path, [
      { type: 'user', message: { content: '<command-name>/jig</command-name>\n<command-args>tweak pricing\n\nThe owner says: put it back.</command-args>' } },
      { type: 'user', isMeta: true, message: { content: [{ type: 'text', text: 'Base directory for this skill.\n\nFindings go back to `/jig make`, then `/jig critique` again.' }] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Next, /jig critique would re-judge everything.' }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', content: 'run `/jig critique` to judge the fix' }] } },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n');
    const r = gate({ projectRoot: root, version: '0.19.0', input: { session_id: 'quoted', transcript_path: path } });
    expect(r.reason ?? '').toBe('');
  });

  it('judges the surface the command names, not the spec written last', () => {
    writeFileSync(join(root, '.jig', 'specs', 'other.spec.md'), '# a spec touched later, with no frontmatter');
    tweakRecord(['A-60']);
    rejudge('A-60', '2026-09-26T14:02:00Z');
    const path = join(root, 'transcript-named.jsonl');
    writeFileSync(path, JSON.stringify({ type: 'user', message: { content: '<command-name>/jig</command-name>\n<command-args>tweak pricing</command-args>' } }) + '\n');
    expect(gate({ projectRoot: root, version: '0.19.0', input: { session_id: 'named', transcript_path: path } }).reason ?? '').toBe('');
  });

  it('refuses a page whose mockup is not approved or skipped', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec().replace('mockup: approved', 'mockup: pending'));
    expect(run('tweak').reason).toMatch(/`mockup:` is pending\. A tweak changes a page whose drawing the owner has approved/);
  });
});
