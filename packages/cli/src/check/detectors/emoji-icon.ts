import { isStyleBearing } from '../ext.js';
import { maskProseComments } from './text-scan.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

/**
 * A-05: emoji as interface iconography.
 *
 * Scans `ctx.raw` rather than `source`, because this lives in markup and not in
 * a style region — the only detector that needs the whole file. Every other one
 * reads the masked style view.
 *
 * The rule was `judgment` with no detector until Jig's own documentation site
 * shipped `<span aria-hidden="true">❌</span> Don't` in its page chrome and
 * `check --all` reported nothing. `aria-hidden` makes a glyph invisible to a
 * screen reader; it does not make it not an emoji icon.
 *
 * False-positive story: only pictographic ranges fire. Currency, typographic
 * punctuation (— – …), arrows, section marks and mathematical symbols are all
 * excluded, because they are text and appear in ordinary prose. Comments are
 * masked here rather than relied on from `source`, so a rule file quoting ❌ in
 * a comment does not fire — and the mask happens inside this detector only
 * because `raw` is deliberately unmasked for everyone.
 */
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

/** Kept out: these live in the ranges above but are typographic rather than
 *  pictographic, and appear in real prose and in code. */
const TEXTUAL = new Set(['→', '←', '↑', '↓', '↔', '⇒', '⇐', '™', '✓', '✗', '−', '∗', '⌘', '⌥', '⏎']);

export const emojiIcon: Detector = {
  name: 'emoji-icon',
  appliesTo: (file) => isStyleBearing(file),
  run(_source, file, ctx) {
    const findings: Finding[] = [];
    const masked = maskProseComments(ctx.raw);
    const lines = masked.split('\n');
    const seen = new Set<number>();

    for (const m of masked.matchAll(EMOJI_RE)) {
      if (TEXTUAL.has(m[0])) continue;
      const line = masked.slice(0, m.index).split('\n').length;
      if (seen.has(line)) continue; // one finding per line, not one per glyph
      seen.add(line);
      findings.push(
        mkFinding(
          ctx,
          'emoji-icon',
          file,
          line,
          `Emoji used as interface iconography (${m[0]}). Emoji render differently ` +
            `on every platform, carry no consistent weight or colour, and cannot be ` +
            `styled — use an icon set, or words.`,
          lines[line - 1] ?? '',
        ),
      );
    }
    return findings;
  },
};
