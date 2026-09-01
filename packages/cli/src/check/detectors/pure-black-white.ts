import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
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
// compliant correction — does not match the exact-literal regexes at all.
const BLACK_RE = /(?<![-\w])color\s*:\s*#(000|000000)\b/i;
const WHITE_RE = /(?<![-\w])background(?:-color)?\s*:\s*#(fff|ffffff)\b/i;

export const pureBlackWhite: Detector = {
  name: 'pure-black-white',
  appliesTo: (file) => hasExtension(file, CSS_EXTENSIONS),
  run(source, file, ctx) {
    const findings: Finding[] = [];
    for (const block of leafBlocks(source)) {
      const blackMatch = BLACK_RE.exec(block.body);
      if (!blackMatch) continue;
      if (!WHITE_RE.test(block.body)) continue;
      const line = lineOfOffset(block, blackMatch.index);
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
