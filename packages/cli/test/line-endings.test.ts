import { describe, it, expect } from 'vitest';
import { matchLineEndings, dominantEnding } from '../src/install/line-endings.js';

/**
 * `checksum()` normalises CRLF before hashing, so edit-detection is
 * ending-agnostic — a file checked out with `core.autocrlf` still matches its
 * recorded checksum. The writes never normalised anything, though, so LF
 * content spliced into a CRLF file (which is exactly what `upsertBlock` does to
 * a co-owned `AGENTS.md`) produced a file with mixed endings whose checksum
 * still "matched".
 */
describe('dominantEnding', () => {
  it('detects CRLF', () => expect(dominantEnding('a\r\nb\r\n')).toBe('\r\n'));
  it('detects LF', () => expect(dominantEnding('a\nb\n')).toBe('\n'));
  it('defaults to LF for a file with no newline at all', () =>
    expect(dominantEnding('a')).toBe('\n'));
  it('goes with the majority when a file is already mixed', () => {
    expect(dominantEnding('a\r\nb\r\nc\n')).toBe('\r\n');
    expect(dominantEnding('a\nb\nc\r\n')).toBe('\n');
  });
});

describe('matchLineEndings', () => {
  it('rewrites LF content to CRLF for a CRLF file', () => {
    expect(matchLineEndings('x\ny\n', 'old\r\n')).toBe('x\r\ny\r\n');
  });

  it('leaves LF content alone for an LF file', () => {
    expect(matchLineEndings('x\ny\n', 'old\n')).toBe('x\ny\n');
  });

  it('normalises mixed content to the target ending, not just the missing half', () => {
    // The bug being fixed: content that is ALREADY mixed must come out
    // consistent, or the fix would preserve the very thing it exists to remove.
    expect(matchLineEndings('a\r\nb\nc\r\n', 'old\n')).toBe('a\nb\nc\n');
    expect(matchLineEndings('a\r\nb\nc\r\n', 'old\r\n')).toBe('a\r\nb\r\nc\r\n');
  });

  it('uses LF when there is no existing file to match', () => {
    expect(matchLineEndings('x\r\ny\r\n', undefined)).toBe('x\ny\n');
  });

  it('never leaves a lone CR behind', () => {
    expect(matchLineEndings('a\r\nb\n', 'old\r\n')).not.toMatch(/\r(?!\n)/);
    expect(matchLineEndings('a\r\nb\n', 'old\n')).not.toMatch(/\r/);
  });
});
