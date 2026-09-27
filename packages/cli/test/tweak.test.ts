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
    expect(run('tweak').reason).toMatch(/the regions under `sizes:` differ from the ones approved with the mockup/);
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
    expect(run('tweak').reason).toMatch(/pricing\.html has changed since the owner approved it/);
  });

  it('refuses a page whose mockup is not approved or skipped', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec().replace('mockup: approved', 'mockup: pending'));
    expect(run('tweak').reason).toMatch(/`mockup:` is pending\. A tweak changes a page whose drawing the owner has approved/);
  });
});
