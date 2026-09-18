import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { hasExtension } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// I-118: an em dash in interface text.
// ❌ <p>Free — forever</p>, aria-label="Delete — permanent"
// ✅ a full stop, a comma, a colon, or a second element
//
// The reader has to work out which punctuation mark the dash is standing in
// for, and it is the clearest tell of machine-written copy. The en dash is a
// different mark with one unambiguous job (`2–10 seats`) and is untouched.
//
// Only text a reader sees: element content, and the attributes that are read
// aloud or displayed. Script, style, comments, class names, URLs and imports
// are not interface text, and a `.md` file is documentation, not an interface.

const MARKUP = ['.html', '.htm', '.vue', '.svelte', '.astro', '.jsx', '.tsx', '.php', '.erb', '.twig', '.hbs'];
const TEXT_ATTRS = /\b(aria-label|aria-description|aria-placeholder|title|placeholder|alt|label|value|content)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const EM_DASH = /—/;

/** Blanks what a reader never sees, keeping every character position. */
function maskNonProse(source: string): string {
  const blank = (m: string) => ' '.repeat(m.length);
  return source
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, blank)
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
}

/** Element content and the attributes a reader hears or sees. */
function proseSpans(masked: string): Array<{ index: number; text: string }> {
  const spans: Array<{ index: number; text: string }> = [];
  let last = 0;
  for (const tag of masked.matchAll(/<[^>]*>/g)) {
    const between = masked.slice(last, tag.index!);
    if (between.trim()) spans.push({ index: last, text: between });
    for (const attr of tag[0].matchAll(TEXT_ATTRS)) {
      const value = attr[3] ?? attr[4] ?? '';
      spans.push({ index: tag.index! + attr.index! + attr[0].indexOf(value), text: value });
    }
    last = tag.index! + tag[0].length;
  }
  const tail = masked.slice(last);
  if (tail.trim()) spans.push({ index: last, text: tail });
  return spans;
}

export const emDash: Detector = {
  name: 'em-dash',
  appliesTo: (file) => hasExtension(file, MARKUP),
  run(_source, file, ctx) {
    const masked = maskNonProse(ctx.raw);
    const starts = buildLineIndex(ctx.raw);
    const findings: Finding[] = [];
    const seen = new Set<number>();
    for (const span of proseSpans(masked)) {
      if (!EM_DASH.test(span.text)) continue;
      const offset = span.index + span.text.indexOf('—');
      const line = lineForOffset(starts, offset);
      if (seen.has(line)) continue;
      seen.add(line);
      findings.push(
        mkFinding(ctx, 'em-dash', file, line,
          'an em dash in interface text: use a full stop, a comma, a colon, or a second element',
          sourceLine(ctx.raw, line)),
      );
    }
    return findings;
  },
};
