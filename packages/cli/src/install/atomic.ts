import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Writes `content` to `path` atomically: to a temporary file in the same
 * directory, then `rename` over the target.
 *
 * `rename` within a filesystem is atomic, so a concurrent reader sees either
 * the old file or the new one — never a half-written prefix. That matters most
 * for the manifests: a torn read makes `readManifest` throw, which is treated
 * as "no manifest", which makes a re-install lose every "I own this file"
 * record it should have honoured.
 *
 * This does NOT make concurrent runs safe in general. Two runs that both read a
 * manifest and then both write it still lose one set of updates — the last
 * writer wins. That is a narrower and much less damaging failure than a torn
 * file (the lost entries make `update` treat those files as user-edited and
 * leave them alone, which is the safe direction), and fixing it properly means
 * a lock protocol with stale-lock recovery. Recorded rather than half-built.
 *
 * The temp file is placed beside the target, not in the system temp directory,
 * so the rename never crosses a filesystem boundary — which would fail with
 * EXDEV.
 */
export function writeFileAtomic(path: string, content: string): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${process.pid}-${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, content, 'utf8');
    renameSync(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // Already gone, or never created — nothing to clean up.
    }
    throw err;
  }
}
