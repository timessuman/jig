import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checksum } from '../install/manifest.js';
import { pageFile } from './save.js';
import { PROBE_VERSION } from './script.js';

export interface ProbeResult {
  jigProbe: number;
  url?: string;
  pageFile?: string;
  pageChecksum?: string;
  recordedAt?: string;
  width: number;
  sidewaysScroll: boolean;
  scrollWidth: number;
  clientWidth: number;
  defaultFont: boolean;
  bodyFont?: string;
  unresolvedTokens: string[];
  junkText: string[];
  emDashes?: string[];
  brokenImages: number;
  navLinksVisible: number;
  landmarks?: string[];
  orderInversions?: Array<{ markupFirst: string; seenFirst: string }>;
  menu: null | {
    opened: boolean; labelChanged: boolean; escapeCloses: boolean; focusReturned: boolean;
    expandedBefore: string | null; expandedAfter: string | null; linksBefore: number; linksAfter: number;
  };
}

/**
 * A probe file the CLI did not write, or wrote for a page that has changed
 * since, is not a measurement of what is on disk now. Both were real: one agent
 * hand-wrote a probe file whose numbers contradicted the page it named.
 */
function stampProblem(projectRoot: string, file: string, p: ProbeResult): string | undefined {
  if (!p.pageChecksum || !p.pageFile) {
    return `${file} was not written by \`jig probe --save\`, so nothing measured it. Evaluate \`jig probe\` in the browser and pipe its output into \`jig probe --save <surface>\`.`;
  }
  const page = pageFile(projectRoot, p.url ?? '');
  if (!page) return `${file} names a page outside this project (${p.url ?? 'no url'}).`;
  let current: string;
  try {
    current = readFileSync(page, 'utf8');
  } catch {
    return `${file} was taken on ${p.pageFile}, which no longer exists.`;
  }
  if (checksum(current) !== p.pageChecksum) {
    return `${file} was taken on an older ${p.pageFile} — the page changed after it. Render and probe again at that width.`;
  }
  return undefined;
}

export function readProbes(projectRoot: string, dir: string, errors: string[]): ProbeResult[] {
  if (!existsSync(dir)) return [];
  const probes: ProbeResult[] = [];
  for (const f of readdirSync(dir).filter((n) => /^probe-\d+\.json$/.test(n)).sort()) {
    try {
      const p = JSON.parse(readFileSync(join(dir, f), 'utf8')) as ProbeResult;
      if (p.jigProbe !== PROBE_VERSION || typeof p.width !== 'number') {
        errors.push(`${f} is not output of \`jig probe\` (version ${PROBE_VERSION}). Re-run the probe; do not write it by hand.`);
        continue;
      }
      const stale = stampProblem(projectRoot, f, p);
      if (stale) { errors.push(stale); continue; }
      probes.push(p);
    } catch (e) {
      errors.push(`${f}: not valid JSON (${(e as Error).message}).`);
    }
  }
  return probes;
}

type VerdictOf = (id: string) => string | undefined;

/**
 * Verdicts the measurement contradicts, plus failures no verdict may excuse.
 *
 * Only `ok` (and `n/a`) can be contradicted: a `finding` already says what the
 * probe says. Everything here was a false pass in arm test 3.
 */
export function probeContradictions(probes: ProbeResult[], verdictOf: VerdictOf): string[] {
  const errors: string[] = [];
  const clean = (id: string) => ['ok', 'n/a'].includes(verdictOf(id) ?? '');
  const at = (p: ProbeResult) => `probe-${p.width}.json`;

  for (const p of probes) {
    if (p.sidewaysScroll && clean('D-115')) {
      errors.push(`D-115 is "${verdictOf('D-115')}", but ${at(p)} measured the page ${p.scrollWidth}px wide in a ${p.clientWidth}px viewport — it scrolls sideways.`);
    }
    if (p.defaultFont) {
      errors.push(`${at(p)}: the page renders in the browser's default font (${p.bodyFont ?? 'unknown'}) — its styles are not applying. No review of this page can pass until they do.`);
    }
    if (p.unresolvedTokens.length) {
      errors.push(`${at(p)}: ${p.unresolvedTokens.length} token(s) have no value in the browser (${p.unresolvedTokens.slice(0, 6).join(', ')}) — every property using them is dropped (H-117).`);
    }
    // H-119: the markup is the document, and its order is the reading order.
    // A screen reader, a reader-mode button and a keyboard user all take the
    // page in markup order; when that is not what the page shows, one of the
    // two is wrong and only a person can say which.
    for (const inv of p.orderInversions ?? []) {
      errors.push(`${at(p)}: "${inv.seenFirst}" is read first on screen but comes after "${inv.markupFirst}" in the markup. At this width the markup order is not the reading order (H-119) — reorder the document, or move it with CSS that leaves the order intact.`);
    }
    // I-118 where the source cannot reach: a string assembled in code — a
    // description built in a framework's frontmatter, a label from a script —
    // arrives on the page having passed no file check. The render is where
    // every route ends, whatever built the string.
    if (p.emDashes?.length) {
      errors.push(`${at(p)}: the rendered page shows an em dash in ${p.emDashes.map((t) => `"${t}"`).join(', ')} (I-118) — use a full stop, a comma, a colon, or a second element.`);
    }
    if (p.junkText.length) {
      errors.push(`${at(p)}: the rendered text contains ${p.junkText.map((j) => `"${j}"`).join(', ')} — template code or a failed value is showing to readers.`);
    }
  }

  // Wide screens. Arm test 3: three of four pages hid five links behind a menu
  // at 1280px, where they fit with room to spare, and the fourth showed its
  // links AND a menu button that opened nothing. P-14's first row — every
  // destination fits, show them all — is measurable here, so it is measured.
  const navClean = clean('P-14') || clean('E-61');
  const cite = [clean('P-14') && `P-14 is "${verdictOf('P-14')}"`, clean('E-61') && `E-61 is "${verdictOf('E-61')}"`].filter(Boolean).join(' and ');
  for (const p of probes.filter((x) => x.width >= 768)) {
    if (!navClean) continue;
    const m = p.menu;
    if (m && p.navLinksVisible > 0) {
      errors.push(`${cite}, but at ${p.width}px ${at(p)} found a menu button beside navigation links that already show — ${m.opened ? 'it opens a second copy of them' : 'it opens nothing'}. At a width where the links show, there is no menu button.`);
    } else if (m && m.opened && m.linksAfter - m.linksBefore <= 8) {
      errors.push(`${cite}, but at ${p.width}px ${at(p)} found the navigation behind a menu — ${m.linksAfter - m.linksBefore} link(s) that fit on one row at this width. Show them.`);
    } else if (p.navLinksVisible === 0 && !(m && m.opened)) {
      errors.push(`${cite}, but at ${p.width}px ${at(p)} found no visible navigation links and no menu that opens.`);
    }
  }

  const phone = probes.filter((p) => p.width <= 480).sort((a, b) => a.width - b.width)[0];
  if (phone && clean('P-14')) {
    const m = phone.menu;
    if (!m && phone.navLinksVisible === 0) {
      errors.push(`P-14 is "${verdictOf('P-14')}", but ${at(phone)} found no visible navigation links and no menu control.`);
    } else if (m) {
      const broken = [
        !m.opened && `tapping it showed no more links (${m.linksBefore} → ${m.linksAfter})`,
        m.expandedAfter !== 'true' && `aria-expanded was ${JSON.stringify(m.expandedAfter)} after opening`,
        !m.labelChanged && 'its label and icon did not change to close',
        !m.escapeCloses && 'Escape did not close it',
      ].filter(Boolean);
      if (broken.length) errors.push(`P-14 is "${verdictOf('P-14')}", but ${at(phone)} operated the menu: ${broken.join('; ')}.`);
    }
  }
  return errors;
}
