import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROBE_SCRIPT } from '../src/probe/script.js';
import { probeContradictions, readProbes, type ProbeResult } from '../src/probe/check.js';
import { saveProbe } from '../src/probe/save.js';
import { verifyVerdicts } from '../src/commands/verdicts.js';
import { repoRoot } from './helpers/registered-commands.js';

const probe = (over: Partial<ProbeResult> = {}): ProbeResult => ({
  jigProbe: 3, width: 360, sidewaysScroll: false, scrollWidth: 360, clientWidth: 360,
  defaultFont: false, unresolvedTokens: [], junkText: [], brokenImages: 0, navLinksVisible: 5,
  menu: { opened: true, labelChanged: true, escapeCloses: true, focusReturned: true, expandedBefore: 'false', expandedAfter: 'true', linksBefore: 0, linksAfter: 5 },
  ...over,
});
const verdicts = (v: Record<string, string>) => (id: string) => v[id];

describe('the probe script', () => {
  it('is one expression any browser tool can evaluate', () => {
    expect(() => new Function(`return ${PROBE_SCRIPT}`)).not.toThrow();
  });
});

/** tw-1 in arm test 3: 31 verdicts, all prose, passed; the page was broken. */
describe('probeContradictions', () => {
  it('accepts a page whose measurements agree with ok verdicts', () => {
    const wide = (width: number) => probe({ width, menu: null, navLinksVisible: 5 });
    expect(probeContradictions([probe(), wide(768), wide(1280)], verdicts({ 'P-14': 'ok', 'D-115': 'ok' }))).toEqual([]);
  });

  it('refuses P-14 ok when the menu did not open, change to close, or close on Escape', () => {
    const m = { ...probe().menu!, opened: false, linksAfter: 1, linksBefore: 1, labelChanged: false, escapeCloses: false };
    const [error] = probeContradictions([probe({ menu: m })], verdicts({ 'P-14': 'ok' }));
    expect(error).toMatch(/P-14 is "ok", but probe-360\.json operated the menu: tapping it showed no more links \(1 → 1\); its label and icon did not change to close; Escape did not close it/);
  });

  it('refuses P-14 ok when the phone has neither links nor a menu', () => {
    expect(probeContradictions([probe({ menu: null, navLinksVisible: 0 })], verdicts({ 'P-14': 'ok' }))[0]).toMatch(/no visible navigation links and no menu control/);
  });

  it('leaves a P-14 finding alone — it already says what the probe says', () => {
    const m = { ...probe().menu!, opened: false };
    expect(probeContradictions([probe({ menu: m })], verdicts({ 'P-14': 'finding' }))).toEqual([]);
  });

  // Arm test 3 at 1280px: css-2 and tw-2 hid five links behind a hamburger,
  // tw-1 showed its links and a menu button too, css-1 had no navigation.
  it('refuses a clean nav verdict when a wide screen hides links that fit, shows a dead menu, or has no navigation', () => {
    const wide = (over: Partial<ProbeResult>) => probe({ width: 1280, ...over });
    const hidden = wide({ navLinksVisible: 0, menu: { ...probe().menu!, linksBefore: 3, linksAfter: 8 } });
    const redundant = wide({ navLinksVisible: 5, menu: { ...probe().menu!, opened: false, linksBefore: 8, linksAfter: 8 } });
    const none = wide({ navLinksVisible: 0, menu: null });
    const v = verdicts({ 'P-14': 'ok', 'E-61': 'ok' });
    expect(probeContradictions([hidden], v)[0]).toMatch(/at 1280px .* behind a menu — 5 link\(s\) that fit/);
    expect(probeContradictions([redundant], v)[0]).toMatch(/menu button beside navigation links that already show — it opens nothing/);
    // tw-1: links showing, and a menu that opens a second copy.
    const duplicate = wide({ navLinksVisible: 6, menu: { ...probe().menu!, linksBefore: 13, linksAfter: 18 } });
    expect(probeContradictions([duplicate], v)[0]).toMatch(/it opens a second copy of them/);
    expect(probeContradictions([none], v)[0]).toMatch(/no visible navigation links and no menu/);
    expect(probeContradictions([wide({ menu: null, navLinksVisible: 5 })], v)).toEqual([]);
  });

  // H-119: a screen reader and a keyboard user take the page in markup order.
  // A column moved with CSS is not an inversion; a block lifted above the one
  // that precedes it in the markup is.
  it('reports markup order that is not the reading order, whatever the verdicts say', () => {
    const errors = probeContradictions(
      [probe({ orderInversions: [{ markupFirst: 'main Products', seenFirst: 'aside Filters' }] })],
      verdicts({}),
    );
    expect(errors[0]).toMatch(/"aside Filters" is read first on screen but comes after "main Products" in the markup/);
    expect(errors[0]).toMatch(/H-119/);
  });

  it('says nothing when markup order and reading order agree', () => {
    expect(probeContradictions([probe({ orderInversions: [] })], verdicts({ 'P-14': 'ok' }))).toEqual([]);
  });

  it('refuses D-115 ok when the page scrolls sideways', () => {
    expect(probeContradictions([probe({ width: 768, sidewaysScroll: true, scrollWidth: 900, clientWidth: 768 })], verdicts({ 'D-115': 'ok' }))[0]).toMatch(/900px wide in a 768px viewport/);
  });

  it('fails an unstyled page, undefined tokens and leaked template text whatever the verdicts say', () => {
    const errors = probeContradictions([probe({ defaultFont: true, bodyFont: '"Times New Roman"', unresolvedTokens: ['--font-body'], junkText: ['${'] })], verdicts({}));
    expect(errors.join('\n')).toMatch(/default font/);
    expect(errors.join('\n')).toMatch(/--font-body/);
    expect(errors.join('\n')).toMatch(/"\$\{"/);
  });
});

describe('jig verdicts reads the probes', () => {
  let project: string;
  const dir = () => join(project, '.jig', 'critique', 'pricing');
  const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
  const ids = (pass: string) => index.filter((r) => r.bucket === 'judgment' && r.pass === pass).map((r) => ({ id: r.id, verdict: 'ok', reason: `${r.id} holds on this page` }));
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'jig-probe-'));
    mkdirSync(dir(), { recursive: true });
    writeFileSync(join(dir(), '360.png'), 'png');
    writeFileSync(join(dir(), 'screen.json'), JSON.stringify({ rendered: true, artefacts: ['.jig/critique/pricing/360.png'], verdicts: ids('screen') }));
    writeFileSync(join(dir(), 'code.json'), JSON.stringify({ verdicts: ids('code') }));
  });
  const run = () => verifyVerdicts({ projectRoot: project, surface: 'pricing', packageRoot: repoRoot });

  it('does not accept rendered: true without a probe at every width', () => {
    const r = run();
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/no probe at 360, 768, 1280px/);
    expect(r.rendered).toBe(false);
  });

  it('passes with agreeing probes, and fails when one contradicts a verdict', () => {
    // Recorded through the CLI, as a real critique does: a hand-written file is
    // refused outright now (see the --save tests below).
    const page = join(project, 'pricing.html');
    writeFileSync(page, '<html><body><a href="/">home</a></body></html>');
    const record = (over: Partial<ProbeResult>) =>
      saveProbe({ projectRoot: project, surface: 'pricing', json: JSON.stringify({ ...probe(), url: `file://${page}`, ...over }) });
    record({});
    for (const width of [768, 1280]) record({ width, menu: null, navLinksVisible: 5 });
    expect(run().errors).toEqual([]);
    record({ width: 768, menu: null, navLinksVisible: 5, sidewaysScroll: true, scrollWidth: 800, clientWidth: 768 });
    expect(run().errors.join('\n')).toMatch(/D-115 is "ok"/);
  });

  it('counts a screen pass with no render as skipped, not run', () => {
    writeFileSync(join(dir(), 'screen.json'), JSON.stringify({ rendered: false, verdicts: ids('screen') }));
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.screen.state).toBe('skipped');
    expect(r.line).toMatch(/screen=skipped:\d+/);
  });

  it('rejects a probe file that is not probe output', () => {
    for (const w of [360, 768, 1280]) writeFileSync(join(dir(), `probe-${w}.json`), JSON.stringify({ width: w, ok: true }));
    expect(run().errors.join('\n')).toMatch(/is not output of `jig probe`/);
  });

  it('rejects probe files nothing stamped, so a review cannot invent its measurements', () => {
    for (const w of [360, 768, 1280]) writeFileSync(join(dir(), `probe-${w}.json`), JSON.stringify(probe({ width: w })));
    expect(run().errors.join('\n')).toMatch(/was not written by `jig probe --save`/);
  });
});

describe('critique tells the screen arm to probe', () => {
  it('runs the probe at each width and never writes a probe file by hand', () => {
    const t = readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');
    expect(t).toMatch(/A rendered review is measured, not only described/);
    expect(t).toMatch(/\{\{scripts_path\}\} probe > \.jig\/probe\.js/);
    expect(t).toMatch(/Never write a probe file yourself/);
  });
});

/**
 * A live run wrote its own probe file: five links and Escape closing a menu
 * that really has thirteen links and no Escape handler. The shape was right,
 * so the review passed on numbers nobody measured.
 */
describe('jig probe --save stamps the page it measured', () => {
  let project: string;
  const dir = () => join(project, '.jig', 'critique', 'pricing');
  const pagePath = () => join(project, 'pricing.html');
  const output = (over: Partial<ProbeResult> = {}) => JSON.stringify({ ...probe(), url: `file://${pagePath()}`, ...over });

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'jig-save-'));
    writeFileSync(join(project, 'pricing.html'), '<html><body><a href="/">home</a></body></html>');
  });

  it('records the file, and verdicts accepts it', () => {
    const saved = saveProbe({ projectRoot: project, surface: 'pricing', json: output() });
    expect(saved.path).toBe('.jig/critique/pricing/probe-360.json');
    const written = JSON.parse(readFileSync(join(dir(), 'probe-360.json'), 'utf8'));
    expect(written.pageFile).toBe('pricing.html');
    expect(written.pageChecksum).toMatch(/^sha256:/);
    expect(readProbes(project, dir(), [])).toHaveLength(1);
  });

  it('rejects output that is not a probe, and a page outside the project', () => {
    expect(() => saveProbe({ projectRoot: project, surface: 'pricing', json: '{"menu":null}' })).toThrow(/not version 3 probe output/);
    expect(() => saveProbe({ projectRoot: project, surface: 'pricing', json: output({ url: 'file:///etc/hosts' }) })).toThrow(/not a file in this project/);
  });

  it('refuses a hand-written probe file, and one taken before the page changed', () => {
    mkdirSync(dir(), { recursive: true });
    writeFileSync(join(dir(), 'probe-360.json'), output());
    const byHand: string[] = [];
    expect(readProbes(project, dir(), byHand)).toHaveLength(0);
    expect(byHand[0]).toMatch(/was not written by `jig probe --save`/);

    saveProbe({ projectRoot: project, surface: 'pricing', json: output() });
    writeFileSync(pagePath(), '<html><body><a href="/">home</a><a href="/docs">docs</a></body></html>');
    const stale: string[] = [];
    expect(readProbes(project, dir(), stale)).toHaveLength(0);
    expect(stale[0]).toMatch(/taken on an older pricing\.html/);
  });
});
