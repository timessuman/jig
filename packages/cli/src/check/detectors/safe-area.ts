import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// D-114: a bar pinned to the screen edge, under the notch or the home indicator.
// ❌ position: fixed; bottom: 0 on a page that extends edge to edge
// ✅ pad the pinned edge with env(safe-area-inset-bottom) — and the matching
//    inset for any other edge it touches
//
// Only fires when the project declares `viewport-fit=cover` (or Next's
// `viewportFit: 'cover'`). Without it, the browser letterboxes the page inside
// the safe area and a pinned bar is already clear. With it, the page runs under
// the notch and the home indicator, and a tab bar at bottom: 0 has its labels
// sitting beneath the gesture bar.
//
// A project fact, like `projectResponsive`: the meta tag lives in the markup and
// the bar lives in a stylesheet. `undefined` means never computed — silent.

const PINNED_RE = /\bposition\s*:\s*(?:fixed|sticky)\b/i;
const EDGE_RE = /(?<![-\w])(top|bottom|left|right|inset(?:-block|-inline)?(?:-start|-end)?)\s*:\s*0(?:px|rem|em)?\s*(?:[;}]|$)/i;
const INSET_RE = /\b(?:env|constant)\(\s*safe-area-inset-/i;

export const safeArea: Detector = {
  name: 'safe-area',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    if (ctx.viewportFitCover !== true) return [];
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      const body = block.body;
      if (!PINNED_RE.test(body) || INSET_RE.test(body)) continue;
      const edge = EDGE_RE.exec(body);
      if (!edge) continue;
      const line = lineOfOffset(block, PINNED_RE.exec(body)!.index);
      findings.push(
        mkFinding(ctx, 'safe-area', file, line,
          `pinned to the ${edge[1]} edge of a page that extends under the notch, with no safe-area inset`,
          sourceLine(source, line)),
      );
    }
    return findings;
  },
};
