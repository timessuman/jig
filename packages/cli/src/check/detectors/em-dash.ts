import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { isReaderText } from '../ext.js';
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

const MARKDOWN = /\.(md|markdown|mdx)$/i;
// Indentation-delimited templates carry their text on the line, with no tags
// to sit between: `p Some text`. See `INDENTED_SYNTAXES` in styles.ts.
const INDENTED = /\.(pug|jade|haml|slim)$/i;
// A file that is code first and markup only where it says so: a string, a
// tagged template, JSX. Its ordinary lines are program text, not copy — a
// build script logging "done — 3 files" is not an interface.
const SCRIPT = /\.(js|mjs|cjs|ts|mts|cts)$/i;
// Code shapes that no interface string contains. In a script file a "tag" can
// be a regex literal — `/<meta name="description" content="([^"]*)"/` — and the
// statements after it are not the page's copy. A JSX child never holds a
// semicolon, a brace, a backtick or an interpolation.
const CODEY = /[;{}`]|\$\{|=>/;
const TEXT_ATTRS = /\b(aria-label|aria-description|aria-placeholder|title|placeholder|alt|label|value|content)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const EM_DASH = /—/;
// A real tag: `<` then a letter or `/`, never `a < b` and never an arrow `=>`.
// The loose version read the code between two operators as page text, and
// reported a build script's log line.
const TAG = /<\/?[A-Za-z][\w.:-]*(?:\s[^<>]*)?\/?>/g;

/** Blanks what a reader never sees, keeping every character position. */
function maskNonProse(source: string): string {
  const blank = (m: string) => ' '.repeat(m.length);
  return source
    // Astro puts a file's code in a leading `---` fence. It is code, and a
    // string built there is not read here (see the rule's own note).
    .replace(/^---\n[\s\S]*?\n---/, blank)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, blank)
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
}

/** Markdown a framework renders as a page. Code is not prose: a fenced block
 *  or a span between backticks is a sample, and the punctuation in it is the
 *  sample's. A link's URL is not read aloud either. */
function markdownProse(source: string): string {
  const blank = (m: string) => ' '.repeat(m.length);
  return source
    .replace(/^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\1[^\n]*$/gm, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\]\([^)\s]*/g, blank);
}

/**
 * Element content and the attributes a reader hears or sees.
 *
 * `edges` is false for a file that is code first (`.ts`, `.mjs`): there, only
 * the text BETWEEN two tags is markup — a JSX child, a lit-html template — and
 * whatever sits before the first tag or after the last is program text. Read as
 * prose it produced a finding on every build script that logs a sentence.
 */
function proseSpans(masked: string, edges: boolean): Array<{ index: number; text: string }> {
  const spans: Array<{ index: number; text: string }> = [];
  const tags = [...masked.matchAll(TAG)];
  let last = 0;
  tags.forEach((tag, i) => {
    const between = masked.slice(last, tag.index!);
    if (between.trim() && (edges || i > 0)) spans.push({ index: last, text: between });
    for (const attr of tag[0].matchAll(TEXT_ATTRS)) {
      const value = attr[3] ?? attr[4] ?? '';
      spans.push({ index: tag.index! + attr.index! + attr[0].indexOf(value), text: value });
    }
    last = tag.index! + tag[0].length;
  });
  const tail = masked.slice(last);
  if (tail.trim() && edges && tags.length > 0) spans.push({ index: last, text: tail });
  return spans;
}

/** A template whose text is the line itself, minus the lines that are code:
 *  `- const x = 1`, a `//` comment, an attribute-only line. */
function indentedProse(source: string): string {
  const blank = (m: string) => ' '.repeat(m.length);
  return source
    .split('\n')
    .map((line) => (/^\s*(-|\/\/|#(?!\w)|=)/.test(line) ? blank(line) : line))
    .join('\n');
}

export const emDash: Detector = {
  name: 'em-dash',
  appliesTo: (file) => isReaderText(file),
  run(_source, file, ctx) {
    const markdown = MARKDOWN.test(file);
    const indented = INDENTED.test(file);
    const masked = markdown
      ? markdownProse(ctx.raw)
      : indented
        ? indentedProse(maskNonProse(ctx.raw))
        : maskNonProse(ctx.raw);
    const starts = buildLineIndex(ctx.raw);
    const findings: Finding[] = [];
    const seen = new Set<number>();
    // Markdown IS the prose. Markup keeps its text between tags and in a few
    // attributes, so only those parts of it are read.
    const script = SCRIPT.test(file);
    const spans = markdown || indented
      ? [{ index: 0, text: masked }]
      : proseSpans(masked, !script).filter((span) => !script || !CODEY.test(span.text));
    for (const span of spans) {
      if (!EM_DASH.test(span.text)) continue;
      for (const hit of span.text.matchAll(/\u2014/g)) {
        const line = lineForOffset(starts, span.index + hit.index!);
        if (seen.has(line)) continue;
        seen.add(line);
        findings.push(
          mkFinding(ctx, 'em-dash', file, line,
            'an em dash in interface text: use a full stop, a comma, a colon, or a second element',
            sourceLine(ctx.raw, line)),
        );
      }
    }
    return findings.sort((a, b) => a.line - b.line);
  },
};
