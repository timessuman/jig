import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check } from './check.js';
import { seo } from './seo.js';
import { verifyVerdicts } from './verdicts.js';
import { checksum } from '../install/manifest.js';

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

export type PageState = 'judged' | 'never' | 'changed' | 'deferred' | 'incomplete' | 'findings' | 'in-progress';

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

/** The page a critique's lock says it judged, and whether that page has changed since. */
function changedSinceLock(projectRoot: string, dir: string): string | undefined {
  let lock: { page?: { file?: string; checksum?: string } };
  try { lock = JSON.parse(readFileSync(join(dir, 'verdicts.lock'), 'utf8')); } catch { return undefined; }
  const file = lock.page?.file;
  if (!file || !lock.page?.checksum) return undefined;
  try {
    return checksum(readFileSync(join(projectRoot, file), 'utf8')) !== lock.page.checksum ? file : undefined;
  } catch {
    return undefined;
  }
}

export function pageStatus(projectRoot: string, surface: string): PageStatus {
  const spec = readFileSync(join(projectRoot, '.jig', 'specs', `${surface}.spec.md`), 'utf8');
  const front = spec.split(/^---\s*$/m)[1] ?? '';
  if (!/^\s*confirmed\s*:\s*true\b/im.test(front)) {
    return { surface, state: 'in-progress', detail: 'its spec is not confirmed, so nothing of it is built to ship' };
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
  if (stale) return { surface, state: 'changed', detail: 'the page changed after its probes were taken' };
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
  const owed = pages.filter((p) => p.state !== 'judged' && p.state !== 'in-progress');
  const ready = mechanicalErrors === 0 && seoErrors === 0 && owed.length === 0;

  const count = (state: PageState) => pages.filter((p) => p.state === state).length;
  const line =
    `JIG_SHIP: ready=${ready ? 'yes' : 'no'} mechanical=${mechanicalErrors} seo=${seoErrors} pages=${pages.length} ` +
    `judged=${count('judged')} owed=${owed.length} in-progress=${count('in-progress')}`;
  const mark: Record<PageState, string> = { judged: '✓', never: '✗', changed: '✗', deferred: '✗', incomplete: '✗', findings: '✗', 'in-progress': '·' };
  const report = [
    `  ${mechanicalErrors === 0 ? '✓' : '✗'} check --all --ci: ${mechanicalErrors} mechanical error${mechanicalErrors === 1 ? '' : 's'}`,
    `  ${seoErrors === 0 ? '✓' : '✗'} seo: ${seoErrors} error${seoErrors === 1 ? '' : 's'}`,
    ...pages.map((p) => `  ${mark[p.state]} ${p.surface}: ${p.detail}`),
    owed.length ? `  Critique each page marked ✗ (\`/jig critique <page>\`); fix what it finds, or record the owner's ruling, and run \`jig ship\` again.` : '',
    `  Not checked by Jig, here or anywhere: ${NOT_COVERED}.`,
    `  ${line}`,
  ].filter(Boolean).join('\n');
  return { ready, mechanicalErrors, seoErrors, pages, line, report };
}
