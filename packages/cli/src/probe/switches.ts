import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wholeRepoFiles } from '../check/files.js';

/**
 * The widths where this project's layout switches, from its `--breakpoint-*`
 * declarations (02-tokens.md, "Where a layout switches").
 *
 * The four probe widths are where a page is judged, and a switch falls between
 * them by design: it is placed where the content needs it. On a real site the
 * three-column frame appeared at 1216px, and 1024 to 1215 still got the phone
 * arrangement; the required widths could not have seen it. So a probe run also
 * measures one pixel either side of every width the project declares.
 */
export interface Switch { name: string; px: number }

const DECLARATION = /--breakpoint-([a-z0-9-]+)\s*:\s*(\d+(?:\.\d+)?)(px|rem)\b/g;

export function declaredSwitches(projectRoot: string): Switch[] {
  // Every distinct width, keyed by name and value: two files declaring one name
  // differently are two places the layout switches, and both are measured.
  const found = new Map<string, Switch>();
  for (const file of wholeRepoFiles(projectRoot)) {
    if (!/\.(css|scss|astro|vue|svelte|html)$/i.test(file)) continue;
    let text: string;
    try { text = readFileSync(join(projectRoot, file), 'utf8'); } catch { continue; }
    for (const m of text.matchAll(DECLARATION)) {
      const px = Math.round(m[3] === 'rem' ? Number(m[2]) * 16 : Number(m[2]));
      if (px > 0) found.set(`${m[1]}:${px}`, { name: m[1], px });
    }
  }
  return [...found.values()].sort((a, b) => a.px - b.px);
}

/** The judged widths, plus the last width before and the first width at each switch. */
export function probeWidths(base: number[], switches: Switch[]): number[] {
  return [...new Set([...base, ...switches.flatMap((s) => [s.px - 1, s.px])])].sort((a, b) => a - b);
}
