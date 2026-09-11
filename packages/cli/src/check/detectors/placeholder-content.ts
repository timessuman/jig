import { isStyleBearing } from '../ext.js';
import { maskProseComments } from './text-scan.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

/**
 * A-10: placeholder content shipped.
 *
 * Scans `ctx.raw`: this is content, not styling. Comments are masked here for
 * the same reason as in `emoji-icon` — a TODO mentioning example.com is a note,
 * not shipped placeholder text.
 *
 * False-positive story: each pattern requires the placeholder *form*, not the
 * word. "For example, a button" does not fire; `https://example.com` does.
 * "Acme" fires only with a company suffix, so a real company called Acme
 * Robotics is not caught by the word alone.
 */
const PATTERNS: Array<{ re: RegExp; what: string }> = [
  { re: /\blorem\s+ipsum\b/gi, what: 'lorem ipsum' },
  { re: /https?:\/\/(?:www\.)?example\.(?:com|org|net)\b/gi, what: 'an example.com URL' },
  { re: /\b(?:someone|user|test|foo|bar)@example\.(?:com|org|net)\b/gi, what: 'a placeholder email' },
  { re: /\bAcme\s+(?:Inc\.?|Corp\.?|Co\.?|Ltd\.?|LLC|Company)\b/gi, what: 'a placeholder company' },
  { re: /\byour\s+(?:company|brand|product)\s+name\b/gi, what: 'a placeholder name' },
];

export const placeholderContent: Detector = {
  name: 'placeholder-content',
  appliesTo: (file) => isStyleBearing(file),
  run(_source, file, ctx) {
    const findings: Finding[] = [];
    const masked = maskProseComments(ctx.raw);
    const lines = masked.split('\n');
    const seen = new Set<number>();

    for (const { re, what } of PATTERNS) {
      re.lastIndex = 0;
      for (const m of masked.matchAll(re)) {
        const line = masked.slice(0, m.index).split('\n').length;
        if (seen.has(line)) continue;
        seen.add(line);
        findings.push(
          mkFinding(
            ctx,
            'placeholder-content',
            file,
            line,
            `Placeholder content shipped — ${what} ("${m[0]}"). Real content changes ` +
              `layout: names are longer, copy wraps, images are the wrong ratio.`,
            lines[line - 1] ?? '',
          ),
        );
      }
    }
    return findings;
  },
};
