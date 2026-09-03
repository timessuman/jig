import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { CSS_EXTENSIONS, hasExtension } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// E-29: focus removed without replacement.
// ❌ outline: none with nothing in its place
// ✅ a :focus-visible rule with a visible indicator built on --color-focus
//
// False-positive story: this deliberately only fires when the WHOLE file
// has no `:focus-visible` rule anywhere — not just the same block as the
// `outline: none`. A file that removes the default outline in one place
// and supplies a `:focus-visible` replacement anywhere else (a shared
// base-button rule, a different selector entirely) is treated as
// compliant. Being conservative here — under-flagging rather than
// over-flagging — matters more than catching every case, per the task
// brief: this is the most common accessibility failure in generated code,
// so a false negative here is far less costly than teaching a user to
// ignore the detector.
// Terminator is `;` OR end-of-body — `.a { outline: none }` is legal CSS and
// was previously invisible, as was every minified stylesheet.
// Terminator is `;`, the closing brace, or end of input. This detector scans
// raw source rather than block bodies, so the last declaration in a rule is
// followed by `}` — requiring `;` made `.a { outline: none }` invisible, as
// was every minified stylesheet.
const OUTLINE_NONE_RE = /(?<![-\w])outline\s*:\s*(none|0(?:px)?)\s*(?:!important)?\s*(?:;|\}|$)/gi;
const FOCUS_VISIBLE_RE = /:focus-visible\b/i;

export const focusRemoved: Detector = {
  name: 'focus-removed',
  appliesTo: (file) => hasExtension(file, CSS_EXTENSIONS),
  run(source, file, ctx) {
    if (FOCUS_VISIBLE_RE.test(source)) return [];

    const findings: Finding[] = [];
    const starts = buildLineIndex(source);
    OUTLINE_NONE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = OUTLINE_NONE_RE.exec(source))) {
      const line = lineForOffset(starts, m.index);
      findings.push(
        mkFinding(
          ctx,
          'focus-removed',
          file,
          line,
          'outline removed with no :focus-visible replacement anywhere in this file',
          sourceLine(source, line),
        ),
      );
    }
    return findings;
  },
};
