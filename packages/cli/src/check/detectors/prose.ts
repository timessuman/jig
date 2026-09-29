import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { hasExtension, isReaderText, isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';
import { readerSpans } from './em-dash.js';
import { EMOJI_RE, TEXTUAL } from './emoji-icon.js';

// I-150: formula openers, closers and signposts.
// ❌ "In today's rapidly changing world…", "It is important to note that…"
// ✅ start with the point; end when it has been made
//
// The judgment half of the rule covers the habit in any words. This half is a
// short list of phrases a page almost never needs, so a hit is worth a look
// and rarely wrong. Longer lists reward swapping in a synonym, which is the
// same habit in new words, so the list stays short on purpose.
//
// A quotation keeps its own words (`<blockquote>`, `<q>`, a Markdown `>`
// line), as with I-118: the page is quoting, not writing.
const FORMULA = new RegExp(
  [
    String.raw`in today['’]s (?:fast[- ]paced|rapidly|ever[- ]|increasingly|digital|modern|busy)`,
    String.raw`in an (?:increasingly|ever[- ](?:changing|evolving)) \w+ (?:world|landscape|age|marketplace|era)`,
    String.raw`as technology continues to evolve`,
    String.raw`it(?: is|['’]s) (?:important|worth) (?:to note|noting)`,
    String.raw`let['’]s (?:dive|delve)\b`,
    String.raw`here['’]s the thing\b`,
    String.raw`without further ado`,
    String.raw`in conclusion\b`,
    String.raw`only time will tell`,
    String.raw`the future (?:looks|is) (?:bright|incredibly promising)`,
  ].map((p) => `\\b${p}`).join('|'),
  'gi',
);

/** Blanks quotations, keeping every character position. */
function maskQuotations(raw: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return raw
    .replace(/<blockquote\b[\s\S]*?<\/blockquote\s*>/gi, blank)
    .replace(/<q\b[\s\S]*?<\/q\s*>/gi, blank)
    .replace(/^ {0,3}>[^\n]*/gm, blank);
}

export const formulaPhrase: Detector = {
  name: 'formula-phrase',
  appliesTo: (file) => isReaderText(file),
  run(_source, file, ctx) {
    const starts = buildLineIndex(ctx.raw);
    const findings: Finding[] = [];
    const seen = new Set<number>();
    for (const span of readerSpans(file, maskQuotations(ctx.raw))) {
      for (const hit of span.text.matchAll(FORMULA)) {
        const line = lineForOffset(starts, span.index + hit.index!);
        if (seen.has(line)) continue;
        seen.add(line);
        findings.push(
          mkFinding(ctx, 'formula-phrase', file, line,
            `a formula phrase ("${hit[0]}"): start with the point, and end when it has been made`,
            sourceLine(ctx.raw, line)),
        );
      }
    }
    return findings.sort((a, b) => a.line - b.line);
  },
};

// I-155: emoji in headings.
// ❌ ## 🚀 Getting started
// ✅ ## Getting started
//
// In markup `A-05` already reports every emoji, headings included, so this
// reads what `A-05` does not: a Markdown page's headings. An `.mdx` file is
// markup to `A-05` too, and is left to it, so one glyph is one finding.
const HEADING = /^ {0,3}#{1,6}[ \t]+(.+)$/gm;
const FENCE = /^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\1[^\n]*$/gm;

export const headingEmoji: Detector = {
  name: 'heading-emoji',
  appliesTo: (file) => isReaderText(file) && hasExtension(file, ['.md', '.markdown']) && !isStyleBearing(file),
  run(_source, file, ctx) {
    const masked = ctx.raw.replace(FENCE, (m) => m.replace(/[^\n]/g, ' '));
    const starts = buildLineIndex(ctx.raw);
    const findings: Finding[] = [];
    for (const heading of masked.matchAll(HEADING)) {
      const glyph = [...heading[1]!.matchAll(EMOJI_RE)].find((m) => !TEXTUAL.has(m[0]));
      if (!glyph) continue;
      const line = lineForOffset(starts, heading.index!);
      findings.push(
        mkFinding(ctx, 'heading-emoji', file, line,
          `an emoji in a heading ("${glyph[0]}"): let the words carry it; a screen reader reads the emoji's name first`,
          sourceLine(ctx.raw, line)),
      );
    }
    return findings;
  },
};
