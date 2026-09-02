import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { contrastRatio, resolveOpaqueColor } from '../color.js';
import { CSS_EXTENSIONS, hasExtension } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// C-19: grey text below contrast floor.
// ❌ a mid-grey used for secondary text, placeholders or timestamps
// ✅ --color-text-weak (see the contrast contract in 02-tokens.md)
//
// False-positive story: this only fires for a foreground/background pair it
// can fully resolve to opaque RGB — both a literal colour (hex/rgb()/hsl(),
// no alpha) or a `var(--token)` that itself resolves to one, in the SAME
// rule block. Anything else — a translucent colour (most of Jig's own
// foreground tokens are intentionally alpha-based and mix with whatever
// they sit on), `oklch()` (several background tokens), `currentColor`, a
// colour set in a different rule, or a value that doesn't parse — is
// skipped rather than guessed at. The floor itself is a fixed 4.5:1 (WCAG
// AA normal text; the file's own "Floor: WCAG 2.1 level AA" statement).
const FLOOR = 4.5;
// WCAG AA relaxes to 3:1 for large text — >=24px at normal weight, or
// >=18.66px at bold. Reporting conformant large text as an error at the
// stricter floor would contradict the rule this detector cites.
const LARGE_FLOOR = 3;
const FONT_SIZE_RE = /(?<![-\w])font-size\s*:\s*(-?\d*\.?\d+)px/i;
const BOLD_RE = /(?<![-\w])font-weight\s*:\s*(bold|[6-9]\d\d)/i;

function isLargeText(body: string): boolean {
  const m = FONT_SIZE_RE.exec(body);
  if (!m) return false;
  const px = parseFloat(m[1]);
  return BOLD_RE.test(body) ? px >= 18.66 : px >= 24;
}
// Terminator is `;` OR end-of-body — the last declaration in a rule may omit
// its semicolon, and minified CSS always does.
const DECL_RE = /(?<![-\w])(color|background(?:-color)?)\s*:\s*([^;]+)(?:;|$)/gi;

export const contrastFloor: Detector = {
  name: 'contrast-floor',
  appliesTo: (file) => hasExtension(file, CSS_EXTENSIONS),
  run(source, file, ctx) {
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      let fgValue: string | null = null;
      let fgOffset = -1;
      let bgValue: string | null = null;

      DECL_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = DECL_RE.exec(block.body))) {
        const prop = m[1].toLowerCase();
        if (prop === 'color') {
          fgValue = m[2].trim();
          fgOffset = m.index;
        } else {
          bgValue = m[2].trim();
        }
      }
      if (!fgValue || !bgValue) continue;

      const fg = resolveOpaqueColor(fgValue, ctx.tokens);
      const bg = resolveOpaqueColor(bgValue, ctx.tokens);
      if (!fg || !bg) continue; // cannot resolve — skip, do not guess

      // WCAG AA has two floors, and applying the stricter one to large text
      // reports conformant CSS as an error. C-19's own correction makes the
      // same distinction. Large is >=24px regular, or >=18.66px bold.
      const floor = isLargeText(block.body) ? LARGE_FLOOR : FLOOR;

      const ratio = contrastRatio(fg, bg);
      if (ratio >= floor) continue;

      const line = lineOfOffset(block, fgOffset);
      findings.push(
        mkFinding(
          ctx,
          'contrast-floor',
          file,
          line,
          `Foreground/background contrast is ${ratio.toFixed(2)}:1, below the ${floor}:1 floor`,
          sourceLine(source, line),
        ),
      );
    }
    return findings;
  },
};
