import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checksum } from '../install/manifest.js';
import { pageFile, projectFile } from './save.js';
import { PROBE_VERSION } from './script.js';

export interface ProbeResult {
  jigProbe: number;
  url?: string;
  pageFile?: string;
  pageChecksum?: string;
  serveRoot?: string;
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
  head?: { title: string; description: string; canonical: string; robots: string; ogTitle: string; ogImage: string };
  contentWidth?: number;
  contentMaxWidth?: string;
  longestLine?: { width: number; chars: number; text: string } | null;
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
  // A served page is named by `pageFile`, which the CLI wrote; its URL is a
  // local port and says nothing about which file answered.
  const page = p.serveRoot ? projectFile(projectRoot, p.pageFile) : pageFile(projectRoot, p.url ?? '');
  if (!page) return `${file} names a page outside this project (${p.serveRoot ? p.pageFile : p.url ?? 'no url'}).`;
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
      // An older Jig's probe is a real measurement taken by a probe that has
      // since changed. Called "not output of jig probe", an agent took it for a
      // forged file and stopped work over it.
      if (typeof p.jigProbe === 'number' && p.jigProbe < PROBE_VERSION && typeof p.width === 'number') {
        errors.push(`${f} was taken by an older \`jig probe\` (version ${p.jigProbe}; this Jig reads version ${PROBE_VERSION}). Record it again with \`jig probe --run\`.`);
        continue;
      }
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

/** Budgets, in the one place they are true: what the browser was served. */
const TITLE_BUDGET = 60;
const DESCRIPTION_BUDGET = 155;

/**
 * Verdicts the measurement contradicts, plus failures no verdict may excuse.
 *
 * Only `ok` (and `n/a`) can be contradicted: a `finding` already says what the
 * probe says. Everything here was a false pass in arm test 3.
 */
export function probeContradictions(probes: ProbeResult[], verdictOf: VerdictOf, indexable = true): string[] {
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
    // B-11 at the width that shows it. A line past 90 characters is beyond
    // every mode's measure (68ch editorial, 60 product, 72 operator) with room
    // for the approximation, and it is a wide screen that produces it.
    const line = p.longestLine;
    if (line && line.chars > 90 && clean('B-11')) {
      errors.push(`B-11 is "${verdictOf('B-11')}", but ${at(p)} measured a line of about ${line.chars} characters ("${line.text}…") — past every mode's measure. Cap prose at \`--measure-prose\`.`);
    }
    // J-121 / J-122 / J-123 against what was served, not what a file declares.
    // Most frameworks build the head, so this is the only place the answer is
    // certain — and `indexable` is the spec's word, defaulting from the mode.
    const head = p.head;
    if (head && p.width === probes[0]?.width) {
      const noindex = /noindex/i.test(head.robots);
      if (indexable && !noindex) {
        if (!head.title) errors.push(`${at(p)}: the page served no <title> (J-121) — a search result then shows a truncated URL.`);
        else if (head.title.length > TITLE_BUDGET) errors.push(`${at(p)}: the title served is ${head.title.length} characters, past the ${TITLE_BUDGET} a search result shows (J-122): "${head.title}".`);
        if (!head.description) errors.push(`${at(p)}: the page served no meta description (J-121) — the search engine writes one from whatever text it finds first, usually the navigation.`);
        else if (head.description.length > DESCRIPTION_BUDGET) errors.push(`${at(p)}: the description served is ${head.description.length} characters, past the ${DESCRIPTION_BUDGET} (J-122).`);
      }
      if (!indexable && !noindex) {
        errors.push(`${at(p)}: this page is not indexable, and the page served no noindex (J-123). robots.txt is public and advisory, and is not this.`);
      }
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
