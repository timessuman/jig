import { CSS_EXTENSIONS, STYLE_HOST_EXTENSIONS, hasExtension } from './ext.js';

/**
 * Host-language files that can carry CSS. Everything here is masked down to its
 * style regions before the detectors see it; anything not listed is not scanned
 * at all.
 */

export function isStyleHost(file: string): boolean {
  return hasExtension(file, STYLE_HOST_EXTENSIONS);
}

/**
 * Hosts that contain markup, and so can carry `<style>` blocks and `style="..."`
 * attributes. Pure script files cannot: a `<style>` there is a string literal —
 * a template being assembled, a test fixture — not a stylesheet, and treating it
 * as one lets application data be read as CSS.
 */
const MARKUP_HOSTS = [
  '.html', '.htm', '.vue', '.svelte', '.astro',
  '.php', '.erb', '.twig', '.hbs', '.mdx', '.jsx', '.tsx',
];

/**
 * A [start, end) span of `source` that holds CSS.
 *
 * `braced` marks a span whose body is a bare declaration list rather than a
 * full rule — a styled-components template, a `style` attribute, a style
 * object. The detectors read rule blocks, so the span's own delimiters (the
 * backticks, the quotes, the outer braces) are rewritten as `{` and `}`. They
 * are single characters at known positions, so the body becomes a block
 * without shifting a single offset.
 */
interface Span {
  start: number;
  end: number;
  braced?: boolean;
}

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
/** `style="..."` / `style='...'` — HTML, Vue, Svelte, PHP, ERB, Django. */
const STYLE_ATTR = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi;
/**
 * A tagged template that holds CSS: `styled.button`, `styled(Link)`,
 * `styled.button.attrs(...)`, `css`, `createGlobalStyle`, `keyframes`, and the
 * `.withConfig(...)` form. Matches the tag, then the backtick body is taken by
 * `readTemplate` so nested `${}` cannot end it early.
 */
const CSS_TAG = /\b(?:styled(?:\.\w+|\([^)]*\))(?:\s*\.\w+\([^)]*\))*|css|createGlobalStyle|keyframes|injectGlobal)\s*`/g;

/**
 * The body of a template literal starting at `openBacktick` (the index OF the
 * backtick), honouring escapes and nested `${ ... }` — which may themselves
 * contain backticks. Returns the span between the delimiters, or null if
 * unterminated.
 */
function readTemplate(source: string, openBacktick: number): Span | null {
  let i = openBacktick + 1;
  const start = i;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '`') return { start, end: i };
    if (ch === '$' && source[i + 1] === '{') {
      // Skip the interpolation, tracking brace depth so a `}` inside a nested
      // object or string does not end it early.
      let depth = 1;
      i += 2;
      while (i < source.length && depth > 0) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '{') depth++;
        else if (source[i] === '}') depth--;
        else if (source[i] === '`') {
          const inner = readTemplate(source, i);
          if (!inner) return null;
          i = inner.end;
        }
        i++;
      }
      continue;
    }
    i++;
  }
  return null;
}

/**
 * A JSX/JS style object — `style={{ color: '#d97706', height: 32 }}`. The
 * declarations are camelCase and quoted rather than CSS syntax, so the span is
 * normalised into `prop: value;` pairs by `styleObjectToCss` before masking.
 */
const STYLE_OBJECT = /\bstyle\s*=\s*\{\{/g;

/** Matching `}}` for a `style={{` whose braces start at `open`. */
function readObject(source: string, open: number): Span | null {
  let depth = 0;
  let i = open;
  const start = open + 2;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end: i };
    }
    i++;
  }
  return null;
}

/**
 * Rewrites a JS style-object body into CSS-shaped text of the SAME LENGTH, so
 * the surrounding position map is unaffected: `color: '#d97706'` becomes
 * `color:  #d97706 `, and `height: 32` becomes `height: 32`. Quotes become
 * spaces and camelCase keys are left alone — the detectors care about the
 * values, and a `fontSize` key that never matches a CSS property simply never
 * matches a property-specific rule.
 */
function styleObjectToCss(body: string): string {
  let out = '';
  for (const ch of body) {
    if (ch === '"' || ch === "'" || ch === '`') out += ' ';
    else if (ch === ',') out += ';';
    else out += ch;
  }
  return out;
}

/**
 * Blanks everything in `source` that is not CSS, preserving every character
 * position and newline so a finding's line number still points at the host
 * file's real line.
 *
 * A plain stylesheet is returned unchanged. A file with no style regions comes
 * back as whitespace, which every detector correctly finds nothing in.
 */
export function maskNonStyleRegions(source: string, file: string): string {
  if (hasExtension(file, CSS_EXTENSIONS)) return source;
  if (!isStyleHost(file)) return blank(source);

  const spans: (Span & { transform?: (s: string) => string })[] = [];

  if (hasExtension(file, MARKUP_HOSTS)) {
    for (const m of source.matchAll(STYLE_BLOCK)) {
      const bodyStart = m.index! + m[0].indexOf('>') + 1;
      spans.push({ start: bodyStart, end: bodyStart + m[1].length });
    }
    for (const m of source.matchAll(STYLE_ATTR)) {
      // `style={{` is a JSX object, handled below — not a quoted attribute.
      const valueStart = m.index! + m[0].indexOf(m[1]) + 1;
      spans.push({ start: valueStart, end: valueStart + m[2].length, braced: true });
    }
  }
  for (const m of source.matchAll(CSS_TAG)) {
    const backtick = m.index! + m[0].length - 1;
    const span = readTemplate(source, backtick);
    if (span) spans.push({ ...span, braced: true });
  }
  for (const m of source.matchAll(STYLE_OBJECT)) {
    const span = readObject(source, m.index! + m[0].length - 2);
    if (span) spans.push({ ...span, transform: styleObjectToCss, braced: true });
  }

  if (spans.length === 0) return blank(source);

  const out = blank(source).split('');
  for (const span of spans) {
    const text = source.slice(span.start, span.end);
    const rendered = span.transform ? span.transform(text) : text;
    for (let i = 0; i < rendered.length; i++) {
      out[span.start + i] = rendered[i];
    }
    if (span.braced && span.start > 0 && span.end < out.length) {
      out[span.start - 1] = '{';
      out[span.end] = '}';
    }
  }
  return out.join('');
}

/** Same length and newlines, no content. */
function blank(source: string): string {
  let out = '';
  for (const ch of source) out += ch === '\n' ? '\n' : ' ';
  return out;
}
