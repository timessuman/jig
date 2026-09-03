import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { extractColorComponents, type RGB } from '../color.js';
import { CSS_EXTENSIONS, hasExtension } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// C-18: pure black on pure white.
// ❌ #000 text on #fff
// ✅ near-black on off-white
//
// False-positive story: only the exact combination of pure-black `color`
// AND pure-white `background`/`background-color` in the SAME rule block
// fires. `color: #000` alone (e.g. a value later composited over some
// other surface) does not fire, `background: #fff` alone does not fire,
// and any near-black/near-white value (`#111`, `#fefefe`, ...) — the
// compliant correction — does not match at all. Colour parsing is shared
// with `contrast-floor` (`color.ts`), so every opaque form it recognises —
// hex, the `black`/`white` keywords, `rgb()`/`hsl()`, and a `var(--token)`
// that resolves to one — is caught here too, not just `#000`/`#fff` hex
// literals.
const COLOR_DECL_RE = /(?<![-\w])color\s*:\s*([^;]+)(?:;|$)/i;
const BG_DECL_RE = /(?<![-\w])background(?:-color)?\s*:\s*([^;]+)(?:;|$)/gi;

function isPure(rgb: RGB, target: 0 | 255): boolean {
  return rgb.r === target && rgb.g === target && rgb.b === target;
}

export const pureBlackWhite: Detector = {
  name: 'pure-black-white',
  appliesTo: (file) => hasExtension(file, CSS_EXTENSIONS),
  run(source, file, ctx) {
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      const colorMatch = COLOR_DECL_RE.exec(block.body);
      if (!colorMatch) continue;
      const fg = extractColorComponents(colorMatch[1].trim(), ctx.tokens);
      if (!fg || fg.alpha < 0.999 || !isPure(fg.rgb, 0)) continue;

      BG_DECL_RE.lastIndex = 0;
      let hasWhiteBackground = false;
      let m: RegExpExecArray | null;
      while ((m = BG_DECL_RE.exec(block.body))) {
        const bg = extractColorComponents(m[1].trim(), ctx.tokens);
        if (bg && bg.alpha >= 0.999 && isPure(bg.rgb, 255)) {
          hasWhiteBackground = true;
          break;
        }
      }
      if (!hasWhiteBackground) continue;

      const line = lineOfOffset(block, colorMatch.index);
      findings.push(
        mkFinding(
          ctx,
          'pure-black-white',
          file,
          line,
          'Pure #000 on pure #fff — use near-black text on an off-white background instead',
          sourceLine(source, line),
        ),
      );
    }
    return findings;
  },
};
