import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { extractColorComponents } from '../color.js';
import { CSS_EXTENSIONS, hasExtension } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// A-04: trend styles that fight legibility (glassmorphism half of the rule).
// ❌ translucent fill + backdrop-filter: blur()
// ✅ opaque --color-surface with a --color-stroke-weak edge; translucency
//    only over media, verified against the worst frame
//
// False-positive story: `backdrop-filter: blur()` over an OPAQUE background
// does NOT fire — an opaque fill behind a blur is inert (nothing shows
// through to blur), so it isn't the glassmorphism pattern the rule bans,
// and it does not carry the legibility risk. This also means blur applied
// directly to a video/image element (the rule's explicit "translucency
// only over media" exception) is silent as long as the element's own
// declared background isn't itself translucent.
const BLUR_RE = /(?:-webkit-)?backdrop-filter\s*:[^;]*blur\s*\(/i;
const BG_DECL_RE = /(?<![-\w])background(?:-color)?\s*:\s*([^;]+);?/gi;

function hasTranslucentBackground(body: string, tokens: Record<string, string>): boolean {
  BG_DECL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BG_DECL_RE.exec(body))) {
    const c = extractColorComponents(m[1].trim(), tokens);
    if (c && c.alpha < 0.999) return true;
  }
  return false;
}

export const backdropBlur: Detector = {
  name: 'backdrop-blur',
  appliesTo: (file) => hasExtension(file, CSS_EXTENSIONS),
  run(source, file, ctx) {
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      const blurMatch = BLUR_RE.exec(block.body);
      if (!blurMatch) continue;
      if (!hasTranslucentBackground(block.body, ctx.tokens)) continue;
      const line = lineOfOffset(block, blurMatch.index);
      findings.push(
        mkFinding(
          ctx,
          'backdrop-blur',
          file,
          line,
          'Glassmorphism — translucent fill + backdrop-filter: blur() fights legibility; use an opaque surface with a --color-stroke-weak edge',
          sourceLine(source, line),
        ),
      );
    }
    return findings;
  },
};
