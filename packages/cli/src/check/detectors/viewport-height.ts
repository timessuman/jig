import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// D-112: a full-height element sized with 100vh.
// ❌ min-height: 100vh on a hero or an app shell
// ✅ min-height: 100svh — or dvh for an element that must follow the browser
//    bars — with 100vh kept only as the fallback line before it
//
// On a phone, 100vh is the height with the browser's bars hidden. With them
// showing, the bottom of a "full-height" section sits under the toolbar, so the
// call to action placed at its foot is the thing that cannot be seen.
//
// Conservative in two ways. A block that also declares a small, dynamic or large
// viewport unit is the correct fallback pattern, not a violation. And a file
// that uses those units anywhere is assumed to have handled it — `@supports`
// blocks put the modern declaration in a different block from the fallback, and
// flagging the fallback there would punish the correct pattern.

const VH_DECL_RE = /(?<![-\w])((?:min-|max-)?height)\s*:\s*([^;}]*\b100vh\b[^;}]*)/gi;
const MODERN_UNIT_RE = /\b\d*\.?\d+(?:dvh|svh|lvh)\b/i;

export const viewportHeight: Detector = {
  name: 'viewport-height',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    if (MODERN_UNIT_RE.test(source)) return [];
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      VH_DECL_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = VH_DECL_RE.exec(block.body))) {
        const line = lineOfOffset(block, m.index);
        findings.push(
          mkFinding(ctx, 'viewport-height', file, line,
            `${m[1]} uses 100vh, which is taller than the visible area on a phone while its browser bars show`,
            sourceLine(source, line)),
        );
      }
    }
    return findings;
  },
};
