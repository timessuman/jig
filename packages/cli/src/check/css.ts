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
 */
export function maskComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
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
          selector: source.slice(top.selectorStart, top.bodyStart - 1).trim(),
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
 * Only "leaf" blocks — no nested `{` in their body — carry real
 * declarations. A block that contains braces is a wrapper (`@media`,
 * `@supports`, `@keyframes`, or CSS nesting) and is excluded so its
 * declarations aren't scanned twice: once here (as text inside the
 * wrapper's own body) and once as their own leaf block.
 */
export function leafBlocks(source: string): CssBlock[] {
  return splitRuleBlocks(source).filter((b) => !b.body.includes('{'));
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

/**
 * Blanks the interior of every `@media (...) { ... }` block — replacing
 * every non-newline character with a space, so line numbers are unaffected
 * — leaving the `@media (...)` prelude itself untouched. Breakpoints are
 * not design tokens, so `hardcoded-value` runs against this masked source
 * to avoid flagging px values that exist only to satisfy one.
 */
export function maskMediaQueries(source: string): string {
  let result = '';
  let i = 0;
  const n = source.length;
  let depth = 0;
  const mediaDepths: number[] = [];
  while (i < n) {
    if (source.startsWith('@media', i) && !/[\w-]/.test(source[i + 6] ?? '')) {
      const braceIdx = source.indexOf('{', i);
      if (braceIdx !== -1) {
        result += source.slice(i, braceIdx + 1);
        i = braceIdx + 1;
        depth += 1;
        mediaDepths.push(depth);
        continue;
      }
    }
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      if (mediaDepths.length && mediaDepths[mediaDepths.length - 1] === depth) mediaDepths.pop();
      depth -= 1;
    }
    const insideMedia = mediaDepths.length > 0;
    result += insideMedia && ch !== '\n' ? ' ' : ch;
    i += 1;
  }
  return result;
}
