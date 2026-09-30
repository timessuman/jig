import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check } from './check.js';
import { seo } from './seo.js';
import { verifyVerdicts } from './verdicts.js';
import { checksum } from '../install/manifest.js';
import { lf, readText } from '../text.js';
import { agentFileProblems } from '../install/agent-files.js';

/**
 * Whether the project is ready to ship, by everything Jig can check.
 *
 * A critique can wait: on jig-site a tweak cost $6-9, most of it the re-judge,
 * and a page judged after every small change is judged again before anyone
 * sees it. Judged once, as it stands, it gets the same verdicts. What must not
 * happen is a critique that waited and was forgotten, so `ship` is where
 * nothing is optional: the mechanical errors `check --ci` fails on, the errors
 * `seo` fails on, and for every confirmed spec a critique that is complete, is
 * of the page as it is now, and leaves no finding the owner has not ruled on.
 *
 * It says what Jig does not cover, every time, so a pass is not read as more
 * than it is.
 */

/** Every state `ship` reports a page in. The procedure describes each (tested). */
export const PAGE_STATES = ['judged', 'never', 'changed', 'reprobe', 'deferred', 'incomplete', 'findings', 'in-progress', 'superseded'] as const;
export type PageState = (typeof PAGE_STATES)[number];

export interface PageStatus {
  surface: string;
  state: PageState;
  detail: string;
}

export interface ShipResult {
  ready: boolean;
  mechanicalErrors: number;
  seoErrors: number;
  pages: PageStatus[];
  line: string;
  report: string;
}

export const NOT_COVERED = 'security, performance, what a screen reader or a real device does, and deployment itself';

/** A spec's own `critique:` (`each` or `at-ship`), when it states one. */
export function specCritique(specBody: string | undefined): 'each' | 'at-ship' | undefined {
  const front = specBody?.split(/^---\s*$/m)[1] ?? '';
  const value = /^\s*critique\s*:\s*([\w-]+)/im.exec(front)?.[1]?.toLowerCase();
  return value === 'each' || value === 'at-ship' ? value : undefined;
}

/**
 * Whether a page's critiques wait for `ship`. The page's spec says so first
 * (`critique: at-ship`, or `critique: each` for a page others reuse, judged
 * now), and `"critique": "at-ship"` in jig.config.json says it for every page
 * whose spec is silent. Either way the owner can critique any page at any time,
 * and `ship` judges every one.
 */
export function critiqueAtShip(projectRoot: string, specBody?: string): boolean {
  const own = specCritique(specBody);
  if (own) return own === 'at-ship';
  try {
    return JSON.parse(readFileSync(join(projectRoot, 'jig.config.json'), 'utf8')).critique === 'at-ship';
  } catch {
    return false;
  }
}

/** A tweak that deferred its re-judge, and that no critique has judged since. */
function tweakDeferred(dir: string): boolean {
  let t: { deferred?: unknown; at?: unknown };
  try { t = JSON.parse(readFileSync(join(dir, 'tweak.json'), 'utf8')); } catch { return false; }
  if (t.deferred === undefined || t.deferred === false) return false;
  let judged: unknown;
  try { judged = JSON.parse(readFileSync(join(dir, 'verdicts.lock'), 'utf8')).tweak; } catch { /* no lock */ }
  return judged !== t.at;
}

/**
 * A page's checksum, with the names of the stylesheets and scripts it loads
 * left out. A bundler names them by their contents, so on jig-site one page's
 * new classes renamed the shared stylesheet and every page on the site read as
 * changed since it was judged. Which assets a page loads still counts; what
 * they are called does not. A change to them is a re-probe, not a critique.
 */
export function pageChecksum(html: string): string {
  return checksum(html.replace(/(href|src)="[^"]*\.(css|js|mjs)(\?[^"]*)?"/g, '$1="asset.$2"'));
}

/** The page a critique's lock says it judged, and whether that page has changed since. */
function changedSinceLock(projectRoot: string, dir: string): string | undefined {
  let lock: { page?: { file?: string; checksum?: string } };
  try { lock = JSON.parse(readFileSync(join(dir, 'verdicts.lock'), 'utf8')); } catch { return undefined; }
  const file = lock.page?.file;
  if (!file || !lock.page?.checksum) return undefined;
  try {
    const html = readFileSync(join(projectRoot, file), 'utf8');
    // A lock written before asset names were left out holds the raw checksum.
    const seen = [pageChecksum(html), checksum(html)];
    return seen.includes(lock.page.checksum) ? undefined : file;
  } catch {
    return undefined;
  }
}

/** The spec a `superseded_by:` line names, if the spec has one. */
export function supersededBy(front: string): string | undefined {
  const named = /^\s*superseded_by\s*:\s*(.*)$/im.exec(front)?.[1]?.replace(/\s+#.*$/, '').trim();
  return named ? named : undefined;
}

export function pageStatus(projectRoot: string, surface: string): PageStatus {
  const spec = readText(join(projectRoot, '.jig', 'specs', `${surface}.spec.md`));
  const front = spec.split(/^---\s*$/m)[1] ?? '';
  if (!/^\s*confirmed\s*:\s*true\b/im.test(front)) {
    return { surface, state: 'in-progress', detail: 'its spec is not confirmed, so nothing of it is built to ship' };
  }
  // A spec another replaced: its page is the successor's, and the successor's
  // critique judges it. On jig-site two replaced specs were listed as never
  // critiqued at every `ship`, and agents marked them each their own way.
  const successor = supersededBy(front);
  if (successor !== undefined) {
    const file = successor.replace(/(\.spec\.md)?$/, '.spec.md');
    return existsSync(join(projectRoot, '.jig', 'specs', file))
      ? { surface, state: 'superseded', detail: `superseded by ${file}, whose critique judges its page` }
      : { surface, state: 'incomplete', detail: `\`superseded_by: ${successor}\` names a spec that does not exist in .jig/specs` };
  }
  const dir = join(projectRoot, '.jig', 'critique', surface);
  if (!existsSync(join(dir, 'screen.json')) && !existsSync(join(dir, 'code.json'))) {
    return { surface, state: 'never', detail: 'never critiqued' };
  }
  if (tweakDeferred(dir)) return { surface, state: 'deferred', detail: 'a tweak deferred its re-judge' };
  const changed = changedSinceLock(projectRoot, dir);
  if (changed) return { surface, state: 'changed', detail: `${changed} changed after it was judged` };
  const v = verifyVerdicts({ projectRoot, surface });
  const stale = v.errors.find((e) => /was taken (on|by) an older/.test(e));
  let judgedPage = false;
  try { judgedPage = !!JSON.parse(readFileSync(join(dir, 'verdicts.lock'), 'utf8')).page?.checksum; } catch { /* no lock */ }
  if (stale && !judgedPage) return { surface, state: 'changed', detail: 'the page changed after its probes were taken' };
  if (stale) return { surface, state: 'reprobe', detail: `its page is as judged, but the styles or scripts it loads changed: re-probe it (\`jig verdicts ${surface} --reprobe\`)` };
  if (!v.ok) return { surface, state: 'incomplete', detail: `its critique is not complete: ${v.errors[0]}` };
  const findings = v.screen.findings + v.code.findings + v.decisions.findings;
  if (findings > 0) return { surface, state: 'findings', detail: `${findings} finding${findings === 1 ? '' : 's'} the owner has not ruled on` };
  return { surface, state: 'judged', detail: 'judged as it stands, nothing open' };
}

export function ship(opts: { projectRoot: string; version: string }): ShipResult {
  const root = opts.projectRoot;
  const mechanical = check({ projectRoot: root, homeDir: '', version: opts.version, all: true, ci: true });
  const mechanicalErrors = mechanical.findings.filter((f) => f.bucket === 'mechanical' && f.severity === 'error').length;
  const seoResult = seo({ projectRoot: root });
  const seoErrors = seoResult.findings.filter((f) => f.severity === 'error').length;

  const specsDir = join(root, '.jig', 'specs');
  const surfaces = existsSync(specsDir)
    ? readdirSync(specsDir).filter((f) => f.endsWith('.spec.md') && !f.startsWith('_')).map((f) => f.replace(/\.spec\.md$/, '')).sort()
    : [];
  const pages = surfaces.map((s) => pageStatus(root, s));
  const owed = pages.filter((p) => p.state !== 'judged' && p.state !== 'in-progress' && p.state !== 'superseded');
  // The instructions every agent starts from are part of what ships.
  const agentFiles = agentFileProblems(root);
  const ready = mechanicalErrors === 0 && seoErrors === 0 && owed.length === 0 && agentFiles.length === 0;

  const count = (state: PageState) => pages.filter((p) => p.state === state).length;
  const line =
    `JIG_SHIP: ready=${ready ? 'yes' : 'no'} mechanical=${mechanicalErrors} seo=${seoErrors} pages=${pages.length} ` +
    `judged=${count('judged')} owed=${owed.length} in-progress=${count('in-progress')} superseded=${count('superseded')}`;
  const mark: Record<PageState, string> = { judged: '✓', never: '✗', changed: '✗', reprobe: '✗', deferred: '✗', incomplete: '✗', findings: '✗', 'in-progress': '·', superseded: '·' };
  const report = [
    `  ${mechanicalErrors === 0 ? '✓' : '✗'} check --all --ci: ${mechanicalErrors} mechanical error${mechanicalErrors === 1 ? '' : 's'}`,
    `  ${seoErrors === 0 ? '✓' : '✗'} seo: ${seoErrors} error${seoErrors === 1 ? '' : 's'}`,
    ...agentFiles.map((p) => `  ✗ ${p}`),
    ...pages.map((p) => `  ${mark[p.state]} ${p.surface}: ${p.detail}`),
    owed.length ? `  Critique each page marked ✗ (\`/jig critique <page>\`); fix what it finds, or record the owner's ruling, and run \`jig ship\` again.` : '',
    `  Not checked by Jig, here or anywhere: ${NOT_COVERED}.`,
    `  ${line}`,
  ].filter(Boolean).join('\n');
  return { ready, mechanicalErrors, seoErrors, pages, line, report };
}
