/**
 * `checksum()` normalises CRLF before hashing, so edit-detection is
 * ending-agnostic: a file checked out under `core.autocrlf` still matches the
 * checksum recorded for its LF original. The writes normalised nothing, so LF
 * content written over — or spliced into — a CRLF file produced mixed endings
 * in a file whose checksum still "matched", and nothing downstream could see it.
 *
 * The rule here is: match whatever the file on disk already uses, and default
 * to LF when there is no file yet. Forcing LF everywhere would be simpler, but
 * would rewrite every line of a Windows user's file and show up as a
 * whole-file diff they did not ask for.
 */
export type LineEnding = '\n' | '\r\n';

/** The ending `existing` predominantly uses. LF when it has no newlines. */
export function dominantEnding(existing: string): LineEnding {
  const crlf = (existing.match(/\r\n/g) ?? []).length;
  // Count LF that are NOT part of a CRLF pair.
  const lf = (existing.match(/(?<!\r)\n/g) ?? []).length;
  if (crlf === 0 && lf === 0) return '\n';
  return crlf >= lf ? '\r\n' : '\n';
}

/**
 * `content` rewritten to use the line ending of `existing` — or LF when there
 * is no existing file.
 *
 * Content is normalised to LF first, so input that is already mixed comes out
 * consistent rather than half-converted. A lone CR is normalised too: it is not
 * a realistic ending for a file git wrote, but leaving one behind while
 * claiming to fix line endings would be worse than not trying.
 */
export function matchLineEndings(content: string, existing: string | undefined): string {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const target = existing === undefined ? '\n' : dominantEnding(existing);
  return target === '\n' ? normalized : normalized.replace(/\n/g, '\r\n');
}
