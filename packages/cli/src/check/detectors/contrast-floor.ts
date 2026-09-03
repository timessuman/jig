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
// `var(--x, fallback)` (the fallback only applies on the branch that does
// NOT run when the property is defined, and Jig never reads the consumer's
// `:root` to know which branch is live — see `resolveOpaqueColor`), a
// colour set in a different rule, or a value that doesn't parse — is
// skipped rather than guessed at. The floor itself is a fixed 4.5:1 (WCAG
// AA normal text; the file's own "Floor: WCAG 2.1 level AA" statement).
const FLOOR = 4.5;
// WCAG AA relaxes to 3:1 for large text — >=24px at normal weight, or
// >=18.66px at bold. Reporting conformant large text as an error at the
// stricter floor would contradict the rule this detector cites.
const LARGE_FLOOR = 3;
// `px` and `rem` (converted at the standard 16px root) are the only units
// resolved to a number. `em`/`%` are relative to a context this scanner
// doesn't have (the parent's computed size, unknown here), and `clamp()`
// resolves to a range, not a point — so none of those can be converted with
// any confidence. A modern codebase sizes type in `rem` far more often than
// `px`; recognising only `px` (as this once did) meant the large-text
// exemption almost never applied in practice.
const REM_TO_PX = 16;
const FONT_SIZE_DECL_RE = /(?<![-\w])font-size\s*:\s*([^;]+?)(?:;|$)/i;
const FONT_SIZE_PX_RE = /^(-?\d*\.?\d+)px$/i;
const FONT_SIZE_REM_RE = /^(-?\d*\.?\d+)rem$/i;
const BOLD_RE = /(?<![-\w])font-weight\s*:\s*(bold|[6-9]\d\d)/i;

/**
 * The floor for this block: the strict 4.5:1 by default, relaxed to 3:1
 * when the text is confidently large. A `font-size` declared in a unit this
 * cannot resolve (`em`, `%`, `clamp()`, ...) falls back to the LENIENT
 * floor rather than the strict one — an unknown size must not produce a
 * confident error. No `font-size` at all keeps the strict floor: the
 * browser default (16px) is normal-size text.
 */
function resolveFloor(body: string): number {
  const m = FONT_SIZE_DECL_RE.exec(body);
  if (!m) return FLOOR;

  const raw = m[1].trim();
  const pxMatch = FONT_SIZE_PX_RE.exec(raw);
  const remMatch = FONT_SIZE_REM_RE.exec(raw);
  let px: number;
  if (pxMatch) px = parseFloat(pxMatch[1]);
  else if (remMatch) px = parseFloat(remMatch[1]) * REM_TO_PX;
  else return LARGE_FLOOR; // unresolvable unit — do not guess at the strict floor

  const large = BOLD_RE.test(body) ? px >= 18.66 : px >= 24;
  return large ? LARGE_FLOOR : FLOOR;
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
      const floor = resolveFloor(block.body);

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
