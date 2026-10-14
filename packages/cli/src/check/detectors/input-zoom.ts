import { leafBlocks, lineOfOffset, sourceLine, splitRuleBlocks } from '../css.js';
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
// operator only, and the caption token everywhere. Operator's own tokens raise
// --text-body to 16px under a coarse pointer, and a project carrying that is
// fine with the body token.
//
// A control that writes `font: inherit` takes the body's size, which is how the
// 14px usually arrives: read through to the `body` rule in the same file.
//
// Conservative: only a selector that names a form control is read (a label at
// 12px never zooms); a value that cannot be resolved to pixels is skipped; and
// a touch query that sets a form control's size is assumed to have handled it.
// A touch query that does something else (raises a row's height) is not.

const SELECTOR_RE = /(?:^|[\s,>+~(])(?:input|select|textarea)\b(?![-\w])|\[contenteditable/i;
const SIZE_RE = /(?<![-\w])font(?:-size)?\s*:\s*([^;}]+)/gi;
const TOUCH_QUERY_RE = /^@media[^{]*\b(?:pointer\s*:\s*coarse|hover\s*:\s*none)\b/i;
const BODY_SELECTOR_RE = /(?:^|,)\s*(?:html\s*,\s*)?body\s*(?:,|$)/i;
const ROOT_PX = 16;

/** What a touch-screen query in this source raises: the body token, a form control's own size. */
export interface TouchFormText {
  body: boolean;
  control: boolean;
}

export function touchFormText(source: string): TouchFormText {
  const out = { body: false, control: false };
  for (const media of splitRuleBlocks(source)) {
    if (!TOUCH_QUERY_RE.test(media.selector.trim())) continue;
    for (const block of leafBlocks(media.body)) {
      const body = /--text-body\s*:\s*([^;}]+)/i.exec(block.body);
      if (body && (pixels(body[1]!, undefined) ?? 0) >= ROOT_PX) out.body = true;
      if (SELECTOR_RE.test(block.selector) && /(?<![-\w])font(?:-size)?\s*:/i.test(block.body)) out.control = true;
    }
  }
  return out;
}

function pixels(value: string, mode: string | undefined): number | undefined {
  const v = value.trim().replace(/\s*!important$/i, '');
  const unit = /^(\d*\.?\d+)(px|rem|em)$/i.exec(v);
  if (unit) return unit[2]!.toLowerCase() === 'px' ? Number(unit[1]) : Number(unit[1]) * ROOT_PX;
  if (/^var\(\s*--text-caption\s*\)$/i.test(v)) return 14;
  if (/^var\(\s*--text-body\s*\)$/i.test(v) && mode === 'operator') return 14;
  return undefined;
}

/** The size in a `font` shorthand (`600 14px/1.5 Inter`), or the value itself for `font-size`. */
function sizeOf(property: string, value: string): string {
  if (!/^font\s*:/i.test(property)) return value;
  const m = /(?:^|\s)((?:\d*\.?\d+(?:px|rem|em))|var\(\s*--text-[\w-]+\s*\))\s*(?:\/|\s|$)/i.exec(value.trim());
  return m ? m[1]! : value.trim();
}

/** The `body` rule's font size in this source, as written. */
function bodySize(source: string): string | undefined {
  for (const block of leafBlocks(source)) {
    if (block.atRuleDepth !== 0 || !BODY_SELECTOR_RE.test(block.selector.trim())) continue;
    const m = /(?<![-\w])font-size\s*:\s*([^;}]+)/i.exec(block.body);
    if (m) return m[1]!;
  }
  return undefined;
}

export const inputZoom: Detector = {
  name: 'input-zoom',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const own = touchFormText(source);
    if (own.control || ctx.touchFormText?.control) return [];
    // The body token is 16px on a touch screen when the project's tokens say so.
    const mode = own.body || ctx.touchFormText?.body ? undefined : ctx.mode;
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      if (!SELECTOR_RE.test(block.selector)) continue;
      SIZE_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SIZE_RE.exec(block.body))) {
        let value = sizeOf(m[0], m[1]!);
        const inherited = /^inherit\b/i.test(value.trim());
        if (inherited) value = bodySize(source) ?? '';
        const px = pixels(value, mode);
        if (px === undefined || px >= ROOT_PX) continue;
        const line = lineOfOffset(block, m.index);
        findings.push(
          mkFinding(ctx, 'input-zoom', file, line,
            inherited
              ? `form control inherits the body's ${px}px; iOS zooms the page on focus below 16px`
              : `form control text resolves to ${px}px; iOS zooms the page on focus below 16px`,
            sourceLine(source, line)),
        );
      }
    }
    return findings;
  },
};
