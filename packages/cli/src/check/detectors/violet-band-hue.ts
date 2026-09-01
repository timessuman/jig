import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { extractColorComponents } from '../color.js';
import { CSS_EXTENSIONS, hasExtension } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// A-01: purple/violet as the unspecified default. Hybrid — this narrows,
// it does not decide. A literal colour in the violet/indigo band is
// reported as a question ("is this chosen?"), always at `warning`, never
// `error`.
//
// False-positive story: only LITERAL colour values (hex / rgb() / hsl())
// are scanned — a `var(--color-brand)` reference is not, so Jig's own
// unbranded default (near-black, hue is irrelevant at 0% saturation) never
// fires just for being used. Within literal colours: anything with
// saturation below 15% is skipped (a "violet-tinted" grey reads as neutral,
// not as a colour choice), and anything with lightness below 8% or above
// 92% is skipped (hue is not perceptible that close to black or white).
// Only hues roughly 250–290° (violet through indigo) in what's left fire.
const COLOR_TOKEN_RE = /#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/g;
const HUE_MIN = 250;
const HUE_MAX = 290;
const MIN_SATURATION = 15;
const MIN_LIGHTNESS = 8;
const MAX_LIGHTNESS = 92;

export const violetBandHue: Detector = {
  name: 'violet-band-hue',
  appliesTo: (file) => hasExtension(file, CSS_EXTENSIONS),
  run(source, file, ctx) {
    const findings: Finding[] = [];
    const starts = buildLineIndex(source);
    COLOR_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = COLOR_TOKEN_RE.exec(source))) {
      const c = extractColorComponents(m[0], ctx.tokens);
      if (!c) continue;
      const { h, s, l } = c.hsl;
      if (s < MIN_SATURATION || l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue;
      if (h < HUE_MIN || h > HUE_MAX) continue;

      const line = lineForOffset(starts, m.index);
      findings.push(
        mkFinding(
          ctx,
          'violet-band-hue',
          file,
          line,
          `Violet/indigo hue (~${Math.round(h)}°) — is this a deliberate brand choice, or the unspecified default?`,
          sourceLine(source, line),
        ),
      );
    }
    return findings;
  },
};
