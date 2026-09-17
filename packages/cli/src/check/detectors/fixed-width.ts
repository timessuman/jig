import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// D-111: a page that never adapts to the viewport.
// ❌ Side-by-side layout, and nothing anywhere in the project that changes it
//    at a narrow width
// ✅ Compose for the phone first; add columns as width allows — a breakpoint,
//    a container query, or an intrinsic grid
//
// Two conditions, both required, and the first is a property of the project:
//
// 1. Nothing in the project adapts to the viewport (`ctx.projectResponsive`).
//    Computed across every style region by `isResponsive`, because the grid
//    and the query that collapses it routinely live in different files.
//    `undefined` means it was never computed, and the detector stays silent
//    rather than guessing — the same contract `mode` follows.
//
// 2. This file lays something out side by side. A single column of text with a
//    `max-width` works on a phone with no media query at all; there is nothing
//    to break, so there is nothing to report. Only three things are flagged: a
//    multi-track grid, a row of flex items, and a fixed width wider than a
//    phone.
//
// It fires in the ten-rule mechanical bucket on purpose. A judgment rule about
// mobile would be skipped by exactly the agent that skips judgment rules, and a
// page with no narrow-width handling went through the whole command chain —
// check, the self-check, and critique — without a single instrument objecting.

const PHONE_WIDTH_PX = 480;

const GRID_COLUMNS_RE = /\bgrid-template-columns\s*:\s*([^;}]+)/i;
const FLEX_RE = /\bdisplay\s*:\s*(?:inline-)?flex\b/i;
const COLUMN_DIRECTION_RE = /\bflex-direction\s*:\s*column(?:-reverse)?\b|\bflex-flow\s*:\s*column\b/i;
const FIXED_WIDTH_RE = /(?<![-\w])(?:min-)?width\s*:\s*(\d+(?:\.\d+)?)px\b/i;

/** More than one column track. `1fr`, `100%`, `none` are one column. */
function isMultiTrack(value: string): boolean {
  const v = value.trim();
  const repeat = /repeat\s*\(\s*(\d+)\s*,/i.exec(v);
  if (repeat) return Number(repeat[1]) > 1;
  // Strip function arguments so `minmax(0, 1fr)` counts as one track.
  const tracks = v.replace(/\([^)]*\)/g, '()').split(/\s+/).filter(Boolean);
  return tracks.length > 1;
}

export const fixedWidth: Detector = {
  name: 'fixed-width',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    if (ctx.projectResponsive !== false) return [];

    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      const body = block.body;
      let offset = -1;
      let message = '';

      const grid = GRID_COLUMNS_RE.exec(body);
      const width = FIXED_WIDTH_RE.exec(body);
      if (grid && isMultiTrack(grid[1])) {
        offset = grid.index;
        message = 'multi-column grid, and nothing in the project changes it at a narrow width';
      } else if (FLEX_RE.test(body) && !COLUMN_DIRECTION_RE.test(body)) {
        offset = FLEX_RE.exec(body)!.index;
        message = 'row of flex items with no wrap, and nothing in the project changes it at a narrow width';
      } else if (width && Number(width[1]) > PHONE_WIDTH_PX) {
        offset = width.index;
        message = `fixed ${width[1]}px width, wider than a phone, and nothing in the project adapts it`;
      }
      if (offset < 0) continue;

      const line = lineOfOffset(block, offset);
      findings.push(mkFinding(ctx, 'fixed-width', file, line, message, sourceLine(source, line)));
    }
    return findings;
  },
};
