import { isStyleBearing } from '../ext.js';
import { maskProseComments } from './text-scan.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

/**
 * A-09: marketing voice in an application.
 *
 * The first mode-gated detector. "Supercharge your workflow" is the correct
 * register on a landing page and wrong on an internal dashboard, so this fires
 * only in `product` and `operator` — and stays silent when no mode is declared
 * rather than guessing, because a detector that is wrong half the time is one
 * people switch off, taking the rest of the suite with it.
 *
 * False-positive story: the list is short and deliberately consists of words
 * that are almost never literal. "Powerful" and "simple" are excluded — they
 * describe real things. "Supercharge" and "unleash" describe nothing; they are
 * register. Severity stays `warning`, because a word list cannot know that a
 * data product's dashboard legitimately says "turbocharge".
 */
const PHRASES = [
  'supercharge', 'unleash', 'revolutioni', 'game-chang', 'effortlessly',
  'seamlessly', 'blazing fast', 'take it to the next level', 'unlock the power',
  'elevate your', 'transform your workflow', 'delight your users',
];
const RE = new RegExp(`\\b(${PHRASES.join('|')})`, 'gi');

/** Modes where this register is out of place. `editorial` is where it belongs. */
const APPLIES_IN = new Set(['product', 'operator']);

export const marketingVoice: Detector = {
  name: 'marketing-voice',
  appliesTo: (file) => isStyleBearing(file),
  run(_source, file, ctx) {
    if (!ctx.mode || !APPLIES_IN.has(ctx.mode)) return [];

    const findings: Finding[] = [];
    const masked = maskProseComments(ctx.raw);
    const lines = masked.split('\n');
    const seen = new Set<number>();

    for (const m of masked.matchAll(RE)) {
      const line = masked.slice(0, m.index).split('\n').length;
      if (seen.has(line)) continue;
      seen.add(line);
      findings.push(
        mkFinding(
          ctx,
          'marketing-voice',
          file,
          line,
          `Marketing voice in a \`${ctx.mode}\` surface ("${m[0]}"). Someone using ` +
            `this every day wants to know what it does, not how it feels.`,
          lines[line - 1] ?? '',
        ),
      );
    }
    return findings;
  },
};
