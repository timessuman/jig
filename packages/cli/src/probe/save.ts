import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';
import { checksum } from '../install/manifest.js';
import { PROBE_VERSION } from './script.js';

/**
 * `jig probe --save <surface>` — the CLI writes the probe file, not the agent.
 *
 * In a live run an agent produced a probe file by hand: it claimed the menu
 * showed five links and that Escape closed it, on a page where the real probe
 * measures thirteen links and no Escape handler. The shape was right, so
 * `verdicts` accepted it. A verdict backed by a measurement nobody took is
 * worth less than an honest "I did not look".
 *
 * So the file carries a stamp this command computes: the page's own checksum,
 * read from disk here, and the moment it was recorded. `verdicts` recomputes
 * the checksum, which fails both a hand-written file (no stamp it could know)
 * and a stale one (the page changed after the probe). It does not make lying
 * impossible — nothing does — it makes it forgery rather than typing.
 */
export interface SaveResult {
  path: string;
  width: number;
  page: string;
}

export function saveProbe(opts: { projectRoot: string; surface: string; json: string }): SaveResult {
  let probe: Record<string, unknown>;
  try {
    probe = JSON.parse(opts.json) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`That is not the probe's output: ${(e as Error).message}. Evaluate \`jig probe\` in the browser and pipe what it returns straight in.`);
  }
  if (probe.jigProbe !== PROBE_VERSION) {
    throw new Error(`That JSON is not version ${PROBE_VERSION} probe output (jigProbe: ${JSON.stringify(probe.jigProbe)}). Re-read \`jig probe\` and evaluate it; do not write the file yourself.`);
  }
  const width = typeof probe.width === 'number' ? probe.width : NaN;
  if (!Number.isFinite(width)) throw new Error('The probe output has no width. Evaluate it in a browser, at the width you are judging.');

  const url = typeof probe.url === 'string' ? probe.url : '';
  const page = pageFile(opts.projectRoot, url);
  if (!page) {
    throw new Error(`The probe ran at ${url || 'no url'}, which is not a file in this project. Open the page you built — a file:// URL under the project — and probe that.`);
  }
  probe.pageFile = relative(opts.projectRoot, page).split('\\').join('/');
  probe.pageChecksum = checksum(readFileSync(page, 'utf8'));
  probe.recordedAt = new Date().toISOString();

  const dir = join(opts.projectRoot, '.jig', 'critique', opts.surface);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `probe-${width}.json`);
  writeFileSync(path, JSON.stringify(probe), 'utf8');
  return { path: `.jig/critique/${opts.surface}/probe-${width}.json`, width, page: probe.pageFile as string };
}

/** The local file a probe's `url` names, when it is one inside the project. */
export function pageFile(projectRoot: string, url: string): string | undefined {
  if (!url.startsWith('file://')) return undefined;
  let path: string;
  try {
    path = fileURLToPath(url.split('#')[0]!.split('?')[0]!);
  } catch {
    return undefined;
  }
  const abs = resolve(path);
  if (!abs.startsWith(resolve(projectRoot))) return undefined;
  return existsSync(abs) ? abs : undefined;
}
