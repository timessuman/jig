import { BLOCK_START, BLOCK_END } from '../adapters/types.js';

/**
 * Comment syntax for the attribution header. Markdown tolerates HTML
 * comments; CSS does not, so a vendored `.css` file must use block comments
 * or the first three lines are a parse error.
 */
export type CommentStyle = 'html' | 'css';

const DELIMITERS: Record<CommentStyle, readonly [string, string]> = {
  html: ['<!--', '-->'],
  css: ['/*', '*/'],
};

export function vendorHeader(
  file: string,
  version: string,
  style: CommentStyle = 'html',
): string {
  const [open, close] = DELIMITERS[style];
  return [
    `${open} ${file} — vendored from Jig v${version}.`,
    '     Licensed Apache-2.0. See .jig/LICENSE and .jig/NOTICE.',
    `     Edit freely: \`jig update\` will not overwrite a file you have changed. ${close}`,
    '',
    '',
  ].join('\n');
}

interface MarkerRegion {
  start: number;
  end: number;
}

/**
 * Scans `existing` for every `BLOCK_START`/`BLOCK_END` marker and returns the
 * regions that must be removed before a fresh block is inserted:
 *
 * - a complete `start...end` pair is removed in full (markers and content);
 * - an orphan `BLOCK_START` with no following `BLOCK_END` consumes everything
 *   from that marker to the end of the string — there is no way to know
 *   where the broken block was meant to stop, so the rest of the document is
 *   treated as its (corrupted) content;
 * - an orphan `BLOCK_END` with no preceding open `BLOCK_START` is removed on
 *   its own (just the marker text — there is nothing before it that belongs
 *   to a block);
 * - if a second `BLOCK_START` opens before the first one ever closed, the
 *   earlier marker is dropped (just the marker text) and scanning resumes
 *   from the newer one.
 *
 * This best-effort cleanup is what lets `upsertBlock` guarantee exactly one
 * well-formed block afterwards, even against a document some editor, merge,
 * or manual edit has left with a stray, unterminated, or duplicated marker.
 */
function findMarkerRegions(existing: string): MarkerRegion[] {
  const regions: MarkerRegion[] = [];
  let searchFrom = 0;
  let openStart: number | null = null;

  while (true) {
    const nextStart = existing.indexOf(BLOCK_START, searchFrom);
    const nextEnd = existing.indexOf(BLOCK_END, searchFrom);
    if (nextStart === -1 && nextEnd === -1) break;

    const endIsNext = nextEnd !== -1 && (nextStart === -1 || nextEnd < nextStart);
    if (endIsNext) {
      if (openStart !== null) {
        regions.push({ start: openStart, end: nextEnd + BLOCK_END.length });
        openStart = null;
      } else {
        regions.push({ start: nextEnd, end: nextEnd + BLOCK_END.length });
      }
      searchFrom = nextEnd + BLOCK_END.length;
    } else {
      if (openStart !== null) {
        regions.push({ start: openStart, end: openStart + BLOCK_START.length });
      }
      openStart = nextStart;
      searchFrom = nextStart + BLOCK_START.length;
    }
  }

  if (openStart !== null) {
    regions.push({ start: openStart, end: existing.length });
  }

  regions.sort((a, b) => a.start - b.start);
  return regions;
}

/**
 * Removes every region `findMarkerRegions` identifies from `existing`. When
 * nothing was found, `removed` is false and `text` is `existing` unchanged.
 * Otherwise `insertAt` gives the offset (into the returned `text`) of the
 * earliest removed region, so a well-formed replacement lands exactly where
 * the old block was.
 */
function stripMarkerRegions(existing: string): { text: string; insertAt: number; removed: boolean } {
  const regions = findMarkerRegions(existing);
  if (regions.length === 0) {
    return { text: existing, insertAt: existing.length, removed: false };
  }

  let text = '';
  let cursor = 0;
  let insertAt = -1;
  regions.forEach((region, i) => {
    let chunk = existing.slice(cursor, region.start);
    // A chunk that immediately follows a removed region would otherwise
    // leave a blank line where the marker used to be; strip one leading
    // newline to match the spacing a well-formed replace produces.
    if (i > 0) chunk = chunk.replace(/^\n/, '');
    text += chunk;
    if (insertAt === -1) insertAt = text.length;
    cursor = region.end;
  });

  const tail = existing.slice(cursor).replace(/^\n/, '');
  text += tail;

  return { text, insertAt, removed: true };
}

/**
 * Replaces the content between `BLOCK_START`/`BLOCK_END` with `block` when a
 * well-formed pair is present, and otherwise appends `block` to the end of
 * `existing`. Handles a malformed pre-existing block deterministically (see
 * `findMarkerRegions`) so the result always contains exactly one
 * `BLOCK_START` and one `BLOCK_END`, in that order, with any text outside
 * the block preserved. Applying it twice in a row is a no-op after the first
 * application.
 */
export function upsertBlock(existing: string, block: string): string {
  const { text, insertAt, removed } = stripMarkerRegions(existing);
  if (!removed) {
    const separator = text.length && !text.endsWith('\n') ? '\n\n' : text.length ? '\n' : '';
    return `${text}${separator}${block}`;
  }
  return `${text.slice(0, insertAt)}${block}${text.slice(insertAt)}`;
}
