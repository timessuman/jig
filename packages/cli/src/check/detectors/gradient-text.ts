import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { CSS_EXTENSIONS, hasExtension } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// A-02: gradient text on headings.
// ❌ background-clip: text with a gradient fill and transparent text colour
// ✅ solid --color-text-strong
//
// False-positive story: `background-clip: text` alone (a solid colour
// clipped to text, an unusual but legitimate pattern) does NOT fire — only
// when the same rule block also sets a gradient background/background-image
// does this match, which is the exact pattern the rule describes. A
// decorative gradient elsewhere in the file (A-03's concern, not this
// detector's) never touches `background-clip`, so it never fires here
// either.
const CLIP_RE = /(?:-webkit-)?background-clip\s*:\s*text\b/i;
const GRADIENT_RE = /(?:background|background-image)\s*:[^;]*(?:linear|radial|conic)-gradient\s*\(/i;

export const gradientText: Detector = {
  name: 'gradient-text',
  appliesTo: (file) => hasExtension(file, CSS_EXTENSIONS),
  run(source, file, ctx) {
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      const clipMatch = CLIP_RE.exec(block.body);
      if (!clipMatch) continue;
      if (!GRADIENT_RE.test(block.body)) continue;
      const line = lineOfOffset(block, clipMatch.index);
      findings.push(
        mkFinding(
          ctx,
          'gradient-text',
          file,
          line,
          'Gradient text via background-clip: text — use solid --color-text-strong instead',
          sourceLine(source, line),
        ),
      );
    }
    return findings;
  },
};
