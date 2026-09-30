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
    renameWithRetry(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // Already gone, or never created — nothing to clean up.
    }
    throw err;
  }
}

/**
 * `rename`, retried briefly on Windows.
 *
 * Windows refuses to rename over a file another process has open (EPERM,
 * EACCES or EBUSY), where Linux and macOS replace it. Two `jig` runs at once,
 * one reading the manifest while the other writes it, failed there and nowhere
 * else. The file is free again within milliseconds, so wait and try again, as
 * graceful-fs does, for up to about two seconds.
 */
function renameWithRetry(from: string, to: string): void {
  const retryable = new Set(['EPERM', 'EACCES', 'EBUSY']);
  for (let waited = 0, delay = 10; ; waited += delay, delay = Math.min(delay * 2, 200)) {
    try {
      renameSync(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? '';
      if (process.platform !== 'win32' || !retryable.has(code) || waited > 2000) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }
}

