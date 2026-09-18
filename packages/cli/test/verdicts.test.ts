import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyVerdicts } from '../src/commands/verdicts.js';
import { saveProbe } from '../src/probe/save.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * A live Haiku run of `critique` produced arms that invented rule ids
 * ("M-01-no-scroll"), judged 1 of 30 screen rules and filed it as a review,
 * reported `code=ran:97` against 67 and `ran:100` against both, and ran its
 * arms in the building agent's own head. Every one of those was forbidden in
 * prose. `jig verdicts` makes them checkable: the arms write verdict files,
 * and the CLI — not the agent — decides whether the review is complete and
 * what the counts are.
 */
const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
const screenIds = index.filter((r) => r.bucket === 'judgment' && r.pass === 'screen').map((r) => r.id);
const codeIds = index.filter((r) => r.bucket === 'judgment' && r.pass === 'code').map((r) => r.id);

const all = (ids: string[]) => ids.map((id) => ({ id, verdict: 'n/a', reason: `${id} — nothing on this page it applies to` }));

let project: string;
const dir = () => join(project, '.jig', 'critique', 'pricing');
const write = (name: string, body: unknown) => writeFileSync(join(dir(), name), JSON.stringify(body), 'utf8');
const run = () => verifyVerdicts({ projectRoot: project, surface: 'pricing', packageRoot: repoRoot });

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-verdicts-'));
  mkdirSync(dir(), { recursive: true });
  mkdirSync(join(project, 'shots'));
  writeFileSync(join(project, 'shots', '360.png'), 'png');
});

describe('jig verdicts', () => {
  it('passes a complete review and computes the counts itself', () => {
    write('screen.json', { rendered: true, artefacts: ['shots/360.png'], verdicts: all(screenIds) });
    write('code.json', { verdicts: all(codeIds) });
    // A rendered review carries a probe at each width, recorded through the CLI
    // so it carries the page's checksum (see probe.test.ts).
    writeFileSync(join(project, 'pricing.html'), '<html><body><a href="/">home</a></body></html>', 'utf8');
    for (const width of [360, 768, 1280, 1600]) {
      saveProbe({ projectRoot: project, surface: 'pricing', json: JSON.stringify({ jigProbe: 4, url: `file://${join(project, 'pricing.html')}`, width, sidewaysScroll: false, scrollWidth: width, clientWidth: width, defaultFont: false, unresolvedTokens: [], junkText: [], brokenImages: 0, navLinksVisible: 5, menu: null }) });
    }
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.line).toContain(`screen=ran:${screenIds.length}`);
    expect(r.line).toContain(`code=ran:${codeIds.length}`);
    expect(r.line).toContain('rendered=yes');
  });

  it('rejects an id that is not in the corpus', () => {
    write('screen.json', { rendered: false, verdicts: [...all(screenIds), { id: 'M-01-no-scroll', verdict: 'ok', reason: 'no horizontal scroll' }] });
    write('code.json', { verdicts: all(codeIds) });
    const r = run();
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/M-01-no-scroll/);
  });

  it('names every rule the arm did not judge, and never reports that arm as ran', () => {
    write('screen.json', { rendered: false, verdicts: all(screenIds.slice(0, 1)) });
    write('code.json', { verdicts: all(codeIds) });
    const r = run();
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toContain(screenIds[screenIds.length - 1]);
    expect(r.line).toContain(`screen=incomplete:1/${screenIds.length}`);
    expect(r.line).not.toMatch(/screen=ran/);
  });

  it('rejects a code rule filed by the screen arm', () => {
    write('screen.json', { rendered: false, verdicts: [...all(screenIds), ...all(codeIds.slice(0, 1))] });
    write('code.json', { verdicts: all(codeIds) });
    expect(run().errors.join('\n')).toMatch(new RegExp(`${codeIds[0]}.*pass: code`));
  });

  // Arm test 3: C-19 and A-05 were reported as "not a rule", sending the agent
  // to hunt for a typo in an id that exists and belongs to `jig check`.
  it('says a mechanical rule belongs to check, not that it does not exist', () => {
    write('screen.json', { rendered: false, verdicts: [...all(screenIds), { id: 'C-19', verdict: 'ok', reason: 'contrast is fine' }] });
    write('code.json', { verdicts: all(codeIds) });
    const errors = run().errors.join('\n');
    expect(errors).toMatch(/C-19 is a mechanical rule — `jig check` decides it/);
    expect(errors).not.toMatch(/C-19 is not a rule/);
  });

  it('rejects a rule judged twice', () => {
    write('screen.json', { rendered: false, verdicts: [...all(screenIds), all(screenIds.slice(0, 1))[0]] });
    write('code.json', { verdicts: all(codeIds) });
    expect(run().errors.join('\n')).toMatch(/more than once/);
  });

  it('rejects an n/a that is an absence rather than a verdict', () => {
    const v = all(codeIds);
    v[0] = { id: codeIds[0], verdict: 'n/a', reason: 'rule not found in accessible corpus' };
    write('screen.json', { rendered: false, verdicts: all(screenIds) });
    write('code.json', { verdicts: v });
    expect(run().errors.join('\n')).toMatch(new RegExp(codeIds[0]));
  });

  it('rejects a verdict that is not ok, finding or n/a', () => {
    const v = all(codeIds);
    v[0] = { id: codeIds[0], verdict: 'pass', reason: 'fine' };
    write('screen.json', { rendered: false, verdicts: all(screenIds) });
    write('code.json', { verdicts: v });
    expect(run().errors.join('\n')).toMatch(/pass/);
  });

  it('refuses rendered: true without an artefact that exists', () => {
    write('screen.json', { rendered: true, artefacts: ['shots/missing.png'], verdicts: all(screenIds) });
    write('code.json', { verdicts: all(codeIds) });
    const r = run();
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/missing\.png/);
  });

  // P- specs are not in rules.index.json, so walking the index never reaches
  // them. P-14 went unjudged in every run of the last test, and 5 of 6 pages
  // failed it. A spec with navigation now requires a verdict on it.
  it('requires a P-14 verdict when the spec has navigation, and accepts one', () => {
    mkdirSync(join(project, '.jig', 'specs'), { recursive: true });
    writeFileSync(join(project, '.jig', 'specs', 'pricing.spec.md'),
      '---\nsurface: pricing\nsizes:\n  phone:\n    nav: menu button top right\n---\n', 'utf8');
    write('screen.json', { rendered: false, verdicts: all(screenIds) });
    write('code.json', { verdicts: all(codeIds) });
    expect(run().errors.join('\n')).toMatch(/P-14/);

    write('screen.json', { rendered: false, verdicts: [...all(screenIds), { id: 'P-14', verdict: 'finding', reason: 'menu does not open at 360px' }] });
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.line).toContain('findings=1');
  });

  it('reports a missing verdict file as missing, not as a pass', () => {
    write('code.json', { verdicts: all(codeIds) });
    const r = run();
    expect(r.ok).toBe(false);
    expect(r.line).toContain('screen=missing:0');
  });
});
