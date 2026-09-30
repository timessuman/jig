import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate } from '../src/commands/gate.js';
import { pageChecksum, ship } from '../src/commands/ship.js';
import { specProblems } from '../src/check/spec-shape.js';
import { checksum } from '../src/install/manifest.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * The owner, on jig-site: a critique after every make and tweak slows the work,
 * and a page critiqued later gets the same verdicts. So a critique can wait, and
 * `ship` is where nothing is optional: every confirmed page judged as it stands,
 * nothing open, no mechanical or seo errors.
 */
let root: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
const commit = (m: string) => { git('add', '-A'); git('commit', '-q', '-m', m); };
const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
const ids = (pass: string) => index.filter((r) => (r.bucket === 'judgment' || r.bucket === 'hybrid') && r.pass === pass).map((r) => ({ id: r.id, verdict: 'ok', reason: `${r.id} holds on this page` }));
const dir = (surface: string) => join(root, '.jig', 'critique', surface);

const spec = (confirmed = true) => `---
feature: choose a plan
surface: pricing
mode: editorial
sizes:
  phone:
    regions: [nav, plans]
    nav: Menu button, top right
  tablet:
    regions: [nav, plans]
    nav: five links in a row
  desktop:
    regions: [nav, plans]
    nav: five links in a row
  wide:
    same-as: desktop
    why: content is capped
confirmed: ${confirmed}
mockup: skipped — the owner: "a small page"
---
Prose.`;

const critiqued = (surface: string, finding = false) => {
  mkdirSync(dir(surface), { recursive: true });
  const screen = [...ids('screen'), { id: 'P-14', verdict: 'ok', reason: 'nav reads as the spec says' }];
  if (finding) Object.assign(screen[0]!, { verdict: 'finding', reason: 'the heading is lighter than the body copy under it' });
  writeFileSync(join(dir(surface), 'screen.json'), JSON.stringify({ rendered: false, verdicts: screen }));
  writeFileSync(join(dir(surface), 'code.json'), JSON.stringify({ verdicts: ids('code') }));
};
const session = (command: string, said = '') => {
  const path = join(root, `t-${command}.jsonl`);
  writeFileSync(path, JSON.stringify({ type: 'user', message: { content: `<command-name>/jig</command-name>\n<command-args>${command} pricing</command-args>\n${said}` } }) + '\n');
  return gate({ projectRoot: root, version: '0.22.0', input: { session_id: command, transcript_path: path } });
};
const state = () => ship({ projectRoot: root, version: '0.22.0' });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-ship-'));
  git('init', '-q');
  git('config', 'user.email', 't@example.test');
  git('config', 'user.name', 't');
  writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }] }));
  mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
  writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec());
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('jig ship', () => {
  it('holds a confirmed page that was never critiqued', () => {
    const r = state();
    expect(r.ready).toBe(false);
    expect(r.report).toMatch(/✗ pricing: never critiqued/);
    expect(r.line).toMatch(/JIG_SHIP: ready=no mechanical=0 seo=0 pages=1 judged=0 owed=1/);
  });

  // jig-site listed two replaced specs as never critiqued at every ship.
  it('owes nothing for a spec another replaced, and names the replacement', () => {
    writeFileSync(join(root, '.jig', 'specs', 'plans.spec.md'), spec().replace('confirmed: true', 'confirmed: true\nsuperseded_by: pricing.spec.md   # one page now'));
    const r = state();
    expect(r.report).toMatch(/· plans: superseded by pricing\.spec\.md/);
    expect(r.line).toMatch(/owed=1 in-progress=0 superseded=1/);
  });

  it('holds a replacement that does not exist', () => {
    writeFileSync(join(root, '.jig', 'specs', 'plans.spec.md'), spec().replace('confirmed: true', 'confirmed: true\nsuperseded_by: gone'));
    expect(state().report).toMatch(/✗ plans: `superseded_by: gone` names a spec that does not exist/);
  });

  it('passes a page judged as it stands, and says what Jig does not check', () => {
    critiqued('pricing');
    const r = state();
    expect(r.ready).toBe(true);
    expect(r.report).toMatch(/✓ pricing: judged as it stands, nothing open/);
    expect(r.report).toMatch(/Not checked by Jig, here or anywhere: security, performance/);
  });

  it('does not hold a page whose spec is still in progress', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), spec(false));
    const r = state();
    expect(r.ready).toBe(true);
    expect(r.report).toMatch(/· pricing: its spec is not confirmed/);
  });

  it('holds a finding the owner has not ruled on', () => {
    critiqued('pricing', true);
    expect(state().report).toMatch(/✗ pricing: 1 finding the owner has not ruled on/);
  });

  it('holds a page that changed after its critique judged it', () => {
    critiqued('pricing');
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'pricing.html'), '<main>after the tweak</main>');
    writeFileSync(join(dir('pricing'), 'verdicts.lock'), JSON.stringify({ checksum: 'x', verdicts: {}, page: { file: 'dist/pricing.html', checksum: checksum('<main>before</main>') } }));
    expect(state().report).toMatch(/✗ pricing: dist\/pricing\.html changed after it was judged/);
  });

  // jig-site: one page's new classes renamed the shared stylesheet, and every
  // page read as changed since it was judged.
  it('reads a page whose only change is an asset name as judged', () => {
    critiqued('pricing');
    mkdirSync(join(root, 'dist'), { recursive: true });
    const page = (css: string) => `<link rel="stylesheet" href="/_astro/${css}.css"><main>judged</main>`;
    writeFileSync(join(root, 'dist', 'pricing.html'), page('base.Dh1WGOR'));
    writeFileSync(join(dir('pricing'), 'verdicts.lock'), JSON.stringify({ checksum: 'x', verdicts: {}, page: { file: 'dist/pricing.html', checksum: pageChecksum(page('base.ce6revOR')) } }));
    expect(state().report).toMatch(/✓ pricing: judged as it stands/);
    writeFileSync(join(root, 'dist', 'pricing.html'), page('base.Dh1WGOR').replace('judged', 'reworded'));
    expect(state().report).toMatch(/✗ pricing: dist\/pricing\.html changed after it was judged/);
  });

  it('holds a mechanical error anywhere in the project', () => {
    critiqued('pricing');
    writeFileSync(join(root, 'a.css'), 'body {\n  font-family: var(--font-body);\n}');
    const r = state();
    expect(r.ready).toBe(false);
    expect(r.report).toMatch(/✗ check --all --ci: 1 mechanical error/);
  });
});

describe('the lock records the page it judged', () => {
  it('writes the page the probes name, with its checksum', () => {
    critiqued('pricing');
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'pricing.html'), '<main>judged</main>');
    writeFileSync(join(dir('pricing'), 'probe-360.json'), JSON.stringify({ pageFile: 'dist/pricing.html' }));
    session('critique');
    const lock = JSON.parse(readFileSync(join(dir('pricing'), 'verdicts.lock'), 'utf8'));
    expect(lock.page).toEqual({ file: 'dist/pricing.html', checksum: checksum('<main>judged</main>') });
  });
});

describe('a tweak whose re-judge waits', () => {
  const deferredTweak = (deferred: string | boolean) => {
    critiqued('pricing');
    commit('critique');
    session('critique');
    commit('lock');
    writeFileSync(join(dir('pricing'), 'tweak.json'), JSON.stringify({ at: '2026-09-29T10:00:00Z', change: 'tighten the plan names', ids: ['A-60'], deferred }));
  };

  it('is taken in the owner\'s words, and the page then owes a critique', () => {
    deferredTweak('leave the critique for later');
    expect(session('tweak', 'Tighten the plan names. Leave the critique for later.').reason ?? '').not.toMatch(/defers its re-judge/);
    expect(state().report).toMatch(/✗ pricing: a tweak deferred its re-judge/);
  });

  it('is refused when nobody said to wait', () => {
    deferredTweak('the owner is in a hurry');
    expect(session('tweak', 'Tighten the plan names.').reason).toMatch(/defers its re-judge, and nobody said to/);
    deferredTweak(true);
    expect(session('tweak', 'Tighten the plan names.').reason).toMatch(/defers its re-judge, and nobody said to/);
  });

  // Words the owner said, that do not say to wait, are not a deferral.
  it('is refused when the words quoted do not say to wait', () => {
    deferredTweak('tighten the plan names');
    expect(session('tweak', 'Tighten the plan names.').reason).toMatch(/does not leave the re-judge for later/);
  });

  // `change` is the owner's words, and every later check reads it as theirs.
  it('holds its change to the owner\'s words', () => {
    deferredTweak('leave the critique for later');
    writeFileSync(join(dir('pricing'), 'tweak.json'), JSON.stringify({ at: '2026-09-29T10:00:00Z', change: 'make the plans read as a clear ladder', ids: ['A-60'], deferred: 'leave the critique for later' }));
    expect(session('tweak', 'Tighten the plan names. Leave the critique for later.').reason).toMatch(/`change` is "make the plans read as a clear ladder", which the owner did not say/);
  });

  it('is taken as `true` where the project waits for ship', () => {
    writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }], critique: 'at-ship' }));
    deferredTweak(true);
    expect(session('tweak', 'Tighten the plan names.').reason ?? '').not.toMatch(/defers its re-judge/);
  });

  it('is settled once a critique has judged the page since', () => {
    deferredTweak('leave the critique for later');
    session('critique');
    expect(state().report).not.toMatch(/deferred its re-judge/);
  });
});

describe('a ship session', () => {
  it('is held while jig ship fails, and lets the agent stop to ask the owner', () => {
    const held = session('ship');
    expect(held.block).toBe(true);
    expect(held.reason).toMatch(/the project is not ready to ship/);
    const path = join(root, 't-ask.jsonl');
    writeFileSync(path, [
      { type: 'user', message: { content: '<command-name>/jig</command-name>\n<command-args>ship</command-args>' } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'pricing has one finding. Fix it, or rule on it?' }] } },
    ].map((l) => JSON.stringify(l)).join('\n') + '\n');
    expect(gate({ projectRoot: root, version: '0.22.0', input: { session_id: 'ask', transcript_path: path } }).reason ?? '').not.toMatch(/not ready to ship/);
  });

  it('lets a ready project finish', () => {
    critiqued('pricing');
    commit('critique');
    expect(session('ship').reason ?? '').not.toMatch(/not ready to ship/);
  });
});

/**
 * The owner: some pages critiqued as they are built, others left for ship. A
 * page's spec says which for itself, and wins over the project's default.
 */
describe('each page says when it is critiqued', () => {
  const withCritique = (value: string) => spec().replace('confirmed: true', `confirmed: true\ncritique: ${value}`);
  const deferTrue = () => {
    critiqued('pricing');
    commit('critique');
    session('critique');
    commit('lock');
    writeFileSync(join(dir('pricing'), 'tweak.json'), JSON.stringify({ at: '2026-09-29T11:00:00Z', change: 'tighten the plan names', ids: ['A-60'], deferred: true }));
  };

  it('lets a page whose spec waits for ship defer, the project silent', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), withCritique('at-ship'));
    deferTrue();
    expect(session('tweak', 'Tighten the plan names.').reason ?? '').not.toMatch(/defers its re-judge/);
  });

  it('holds a page whose spec says each, whatever the project says', () => {
    writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }], critique: 'at-ship' }));
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), withCritique('each'));
    deferTrue();
    expect(session('tweak', 'Tighten the plan names.').reason).toMatch(/defers its re-judge, and nobody said to/);
  });

  it('names a value that is neither', () => {
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), withCritique('sometimes'));
    expect(specProblems({ path: '.jig/specs/pricing.spec.md', body: withCritique('sometimes') }).join(' ')).toMatch(/`critique: sometimes` is neither `each` nor `at-ship`/);
    expect(specProblems({ path: '.jig/specs/pricing.spec.md', body: withCritique('at-ship   # the chapters wait') }).join(' ')).not.toMatch(/critique:/);
  });

  // G-42: each movement on the page says what triggers it and what it tells.
  it('holds a movement in `motion:` that gives no trigger or reason', () => {
    const withMotion = (value: string) => spec().replace('confirmed: true', `confirmed: true\nmotion:${value}`);
    const problems = (value: string) => specProblems({ path: '.jig/specs/pricing.spec.md', body: withMotion(value) }).join(' ');
    expect(problems(' none')).not.toMatch(/motion/);
    expect(problems('\n  - deleted row: rows below slide up, on delete; tells where the list went')).not.toMatch(/motion/);
    expect(problems('\n  - hero: the gradient drifts')).toMatch(/does not say what triggers it/);
    expect(problems(' sometimes')).toMatch(/neither `none` nor a list/);
  });
});
