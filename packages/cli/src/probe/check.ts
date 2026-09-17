import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROBE_VERSION } from './script.js';

export interface ProbeResult {
  jigProbe: number;
  width: number;
  sidewaysScroll: boolean;
  scrollWidth: number;
  clientWidth: number;
  defaultFont: boolean;
  bodyFont?: string;
  unresolvedTokens: string[];
  junkText: string[];
  brokenImages: number;
  navLinksVisible: number;
  menu: null | {
    opened: boolean; labelChanged: boolean; escapeCloses: boolean; focusReturned: boolean;
    expandedBefore: string | null; expandedAfter: string | null; linksBefore: number; linksAfter: number;
  };
}

export function readProbes(dir: string, errors: string[]): ProbeResult[] {
  if (!existsSync(dir)) return [];
  const probes: ProbeResult[] = [];
  for (const f of readdirSync(dir).filter((n) => /^probe-\d+\.json$/.test(n)).sort()) {
    try {
      const p = JSON.parse(readFileSync(join(dir, f), 'utf8')) as ProbeResult;
      if (p.jigProbe !== PROBE_VERSION || typeof p.width !== 'number') {
        errors.push(`${f} is not output of \`jig probe\` (version ${PROBE_VERSION}). Re-run the probe; do not write it by hand.`);
        continue;
      }
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
    if (p.junkText.length) {
      errors.push(`${at(p)}: the rendered text contains ${p.junkText.map((j) => `"${j}"`).join(', ')} — template code or a failed value is showing to readers.`);
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
