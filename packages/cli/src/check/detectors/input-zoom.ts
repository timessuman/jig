import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// F-113: form text small enough to make the phone zoom.
// ❌ an input, select or textarea whose text is below 16px
// ✅ 16px or larger on touch screens — `font-size: max(16px, var(--text-body))`
//    inside `@media (pointer: coarse)` keeps a dense desktop size
//
// iOS Safari zooms the whole page when a field with text below 16px takes
// focus, and does not zoom back out. The form the user was filling in is now
// wider than the screen.
//
// Jig's own tokens trip it: `operator` sets --text-body to 14px, and
// --text-caption is below 16px in every mode. So the body token is flagged in
// operator only, and the caption token everywhere.
//
// Conservative: only a selector that names a form control is read (a label at
// 12px never zooms); a value that cannot be resolved to pixels is skipped; and
// a file with a coarse-pointer or no-hover query is assumed to have handled it.

const SELECTOR_RE = /(?:^|[\s,>+~(])(?:input|select|textarea)\b(?![-\w])|\[contenteditable/i;
const SIZE_RE = /(?<![-\w])font-size\s*:\s*([^;}]+)/gi;
const TOUCH_QUERY_RE = /@media[^{]*\b(?:pointer\s*:\s*coarse|hover\s*:\s*none)\b/i;
const ROOT_PX = 16;

function pixels(value: string, mode: string | undefined): number | undefined {
  const v = value.trim().replace(/\s*!important$/i, '');
  const unit = /^(\d*\.?\d+)(px|rem|em)$/i.exec(v);
  if (unit) return unit[2].toLowerCase() === 'px' ? Number(unit[1]) : Number(unit[1]) * ROOT_PX;
  if (/^var\(\s*--text-caption\s*\)$/i.test(v)) return 14;
  if (/^var\(\s*--text-body\s*\)$/i.test(v) && mode === 'operator') return 14;
  return undefined;
}

export const inputZoom: Detector = {
  name: 'input-zoom',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    if (TOUCH_QUERY_RE.test(source)) return [];
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      if (!SELECTOR_RE.test(block.selector)) continue;
      SIZE_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SIZE_RE.exec(block.body))) {
        const px = pixels(m[1], ctx.mode);
        if (px === undefined || px >= ROOT_PX) continue;
        const line = lineOfOffset(block, m.index);
        findings.push(
          mkFinding(ctx, 'input-zoom', file, line,
            `form control text resolves to ${px}px; iOS zooms the page on focus below 16px`,
            sourceLine(source, line)),
        );
      }
    }
    return findings;
  },
};
