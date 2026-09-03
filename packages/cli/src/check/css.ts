/**
 * A minimal, regex/brace-based CSS scanner — not a full parser. It exists
 * to give the mechanical detectors two things: rule blocks (a selector and
 * its declaration body, for detectors that need two declarations to agree
 * with each other, like `contrast-floor`) and stable line numbers for
 * whatever offset a detector's own regex lands on.
 */

export interface CssBlock {
  selector: string;
  body: string;
  bodyStartLine: number;
}

/**
 * Splits `source` into every `selector { body }` region, including nested
 * ones (an `@media` or `@supports` wrapper's body is itself a block whose
 * body contains further blocks). Use `leafBlocks` to get only the
 * declaration-bearing ones.
 */
/**
 * Blanks the contents of every CSS comment while preserving newlines, so
 * line numbers survive. Without this the brace scanner treats a leading
 * comment as part of the following selector — which meant a vendored token
 * file, whose first bytes are an attribution comment, never yielded a
 * `:root` block and `loadTokenMap` returned nothing at all.
 *
 * Walks character by character rather than using a regex, because a regex is
 * string-unaware: `content: "/*"` would open a comment that runs to the next
 * `*` + `/` anywhere in the file, blanking every real declaration in between.
 * That is the same failure this function exists to prevent — a detector that
 * is silently dead and reports "no findings" — arriving through another door.
 *
 * An unterminated comment is masked to end of input rather than left intact,
 * so it cannot leak into the following selector.
 */
export function maskComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i++;
      while (i < source.length) {
        if (source[i] === '\\' && i + 1 < source.length) {
          out += source[i] + source[i + 1];
          i += 2;
          continue;
        }
        out += source[i];
        if (source[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }

    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (let j = i; j < stop; j++) out += source[j] === '\n' ? '\n' : ' ';
      i = stop;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

export function splitRuleBlocks(source: string): CssBlock[] {
  source = maskComments(source);
  const blocks: CssBlock[] = [];
  const stack: { selectorStart: number; bodyStart: number; bodyStartLine: number }[] = [];
  let line = 1;
  let lastBoundary = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\n') line++;
    if (ch === '{') {
      stack.push({ selectorStart: lastBoundary, bodyStart: i + 1, bodyStartLine: line });
      lastBoundary = i + 1;
    } else if (ch === '}') {
      const top = stack.pop();
      if (top) {
        blocks.push({
          selector: cleanSelector(source.slice(top.selectorStart, top.bodyStart - 1)),
          body: source.slice(top.bodyStart, i),
          bodyStartLine: top.bodyStartLine,
        });
      }
      lastBoundary = i + 1;
    }
  }
  return blocks;
}

/**
 * Blanks nested `{...}` regions out of a block body, preserving length and
 * newlines so `lineOfOffset` still reports the right line.
 *
 * A block whose body contains braces used to be discarded whole, on the
 * reasoning that it is a wrapper (`@media`, `@keyframes`) whose declarations
 * are scanned as their own leaf blocks. That holds for wrappers and fails for
 * CSS nesting, where the parent carries declarations of its own:
 *
 *   .card { color: red; .heading { color: blue } }
 *
 * `.card`'s `color: red` belonged to no leaf block and was invisible to every
 * detector. Native nesting is baseline, and `.scss` / `.less` are in
 * `CSS_EXTENSIONS` where nesting is the whole point, so on a Sass codebase
 * most declarations were never scanned.
 */
function blankNested(body: string): string {
  const out = body.split('');
  const blank = (from: number, to: number): void => {
    for (let j = from; j < to; j++) if (out[j] !== '\n') out[j] = ' ';
  };

  let depth = 0;
  let segmentStart = 0; // start of the current top-level segment
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') {
      // The nested rule's SELECTOR sits outside its braces, so blank back to
      // the last declaration boundary too. Without this a wrapper's body kept
      // its children's selectors and never read as empty.
      if (depth === 0) blank(segmentStart, i);
      depth++;
      out[i] = ' ';
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      out[i] = ' ';
      if (depth === 0) segmentStart = i + 1;
    } else if (depth > 0) {
      if (ch !== '\n') out[i] = ' ';
    } else if (ch === ';') {
      segmentStart = i + 1;
    }
  }
  return out.join('');
}

/**
 * A nested rule's raw selector slice starts at the previous boundary, which
 * inside a parent block is the parent's own declarations — so `.h` in
 * `.card { color: red; .h { ... } }` arrived as `color: red; .h`. Keep only
 * the text after the last declaration terminator.
 */
function cleanSelector(raw: string): string {
  const cut = Math.max(raw.lastIndexOf(';'), raw.lastIndexOf('}'));
  return (cut === -1 ? raw : raw.slice(cut + 1)).trim();
}

/**
 * Every block, with any nested `{...}` regions blanked out of its body, so a
 * block's declarations are scanned exactly once — as its own — and never
 * again as text inside an ancestor's body. A wrapper (`@media`, `@supports`,
 * `@keyframes`) blanks to whitespace and contributes nothing, which is what
 * it should contribute; a nested rule's parent keeps its own declarations.
 */
export function leafBlocks(source: string): CssBlock[] {
  return splitRuleBlocks(source)
    .map((b) => (b.body.includes('{') ? { ...b, body: blankNested(b.body) } : b))
    // A pure wrapper (`@media`, `@supports`, `@keyframes`) blanks to nothing.
    // Drop it: it carries no declarations of its own, and its children are
    // already present as their own blocks.
    .filter((b) => b.body.trim() !== '');
}

/** Converts a character offset into `block.body` to a 1-indexed line number
 * in the original source. */
export function lineOfOffset(block: CssBlock, offsetInBody: number): number {
  let n = 0;
  const end = Math.min(offsetInBody, block.body.length);
  for (let i = 0; i < end; i++) {
    if (block.body[i] === '\n') n++;
  }
  return block.bodyStartLine + n;
}

/** Precomputes the start offset of every line in `source`, for repeated
 * `lineForOffset` lookups against the whole file (as opposed to a single
 * block's body). */
export function buildLineIndex(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

export function lineForOffset(starts: number[], offset: number): number {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

export function sourceLine(source: string, line: number): string {
  const lines = source.split('\n');
  return (lines[line - 1] ?? '').trim();
}
