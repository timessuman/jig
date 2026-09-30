import { readFileSync } from 'node:fs';

/**
 * Text with its line endings as Jig parses them: `\n`.
 *
 * Git on Windows checks files out with CRLF, and `git show` returns them as
 * stored. Read raw, a spec written on one machine parsed as having no regions
 * on another, and every "changed since" comparison between a working file and
 * its committed copy said yes. Every text file Jig parses or compares is read
 * through here.
 */
export function lf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** A text file, read as {@link lf} gives it. */
export function readText(path: string): string {
  return lf(readFileSync(path, 'utf8'));
}
