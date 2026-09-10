import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeFileAtomic } from './atomic.js';
import { matchLineEndings } from './line-endings.js';
import { checksum } from './manifest.js';

/**
 * One writer for every file Jig installs, and one enumerator for the bundle it
 * installs them from.
 *
 * `install` and `update` had grown three near-copies of the same eight lines —
 * mkdir, read what is there, match its line endings, write, checksum into a
 * files map. Near-copies, not copies: the third (`updateInitFiles`) had lost
 * `matchLineEndings` somewhere along the way, so a token file checked out under
 * `core.autocrlf` came back LF-only after `jig update` while the rule files
 * beside it kept their CRLF. Nobody chose that; it is what duplication does.
 *
 * The same drift is what let the C3 root-resolution bug diverge from
 * `install`'s guarded version, and what made the C2 fix need applying twice.
 */

/** Manifest keys are always `/`-joined, on every platform — a manifest written
 *  on Windows with `.claude\a.md` keys would not match a POSIX checkout, and
 *  manifests are committed to shared repositories. Disk access still goes
 *  through `path.join`, which is platform-correct. */
export function relKey(...parts: string[]): string {
  return parts.join('/');
}

export interface BundleWriter {
  /** Writes `content` at `key` (relative to the writer's root) and records its
   *  checksum. Returns the key, so callers can push it onto a result list. */
  write(key: string, content: string): string;
  /** The accumulating manifest `files` map. */
  readonly files: Record<string, string>;
}

/**
 * A writer rooted at `root`, seeded with any checksums already recorded.
 *
 * Writes are atomic. They were not before: a crash or a full disk mid-write
 * left a truncated rule file whose checksum no longer matched its manifest
 * entry, and `update` reads a checksum mismatch as "the user edited this" —
 * so the damaged file would be skipped from then on, silently, forever. The
 * manifest itself was already written atomically for the same reason; the
 * files it indexes deserve it no less.
 */
export function createWriter(root: string, seed: Record<string, string> = {}): BundleWriter {
  const files: Record<string, string> = { ...seed };

  return {
    files,
    write(key, content) {
      const abs = join(root, ...key.split('/'));
      mkdirSync(dirname(abs), { recursive: true });
      // Match the endings already on disk. `checksum` normalises CRLF, so a
      // file checked out under `core.autocrlf` still matches its recorded
      // checksum — but writing LF over it, or splicing an LF block into it,
      // left mixed endings the checksum could not see.
      const existing = existsSync(abs) ? readFileSync(abs, 'utf8') : undefined;
      const toWrite = matchLineEndings(content, existing);
      writeFileAtomic(abs, toWrite);
      files[key] = checksum(toWrite);
      return key;
    },
  };
}

/**
 * The bundle files of one kind, in a stable order.
 *
 * Sorted because the order reaches the user: it is the order `install` and
 * `update` print their file lists in, and an unsorted `readdirSync` differs
 * between filesystems.
 */
export function bundleFiles(packageRoot: string, dir: 'rules' | 'tokens'): string[] {
  const ext = dir === 'rules' ? '.md' : '.css';
  return readdirSync(join(packageRoot, dir))
    .filter((f) => f.endsWith(ext))
    .sort();
}
