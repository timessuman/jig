import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, sep } from 'node:path';
import { checksum } from '../install/manifest.js';
import { PROBE_VERSION } from './script.js';
import { findChrome, runProbe } from './browser.js';
import { serveDirectory } from './serve.js';

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

export function saveProbe(opts: { projectRoot: string; surface: string; json: string; page?: string; serveRoot?: string }): SaveResult {
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
  // A served page is named by the command that served it, never read from the
  // URL: a local port says nothing about which file answered.
  const page = opts.page ? projectFile(opts.projectRoot, opts.page) : pageFile(opts.projectRoot, url);
  if (!page) {
    throw new Error(`The probe ran at ${url || 'no url'}, which is not a file in this project. Open the page you built, as a file:// URL under the project, or let \`jig probe --run <page> --serve <dir>\` serve it.`);
  }
  probe.pageFile = relative(opts.projectRoot, page).split('\\').join('/');
  if (opts.serveRoot) probe.serveRoot = relative(opts.projectRoot, resolve(opts.projectRoot, opts.serveRoot)).split('\\').join('/') || '.';
  probe.pageChecksum = checksum(readFileSync(page, 'utf8'));
  probe.recordedAt = new Date().toISOString();

  const dir = join(opts.projectRoot, '.jig', 'critique', opts.surface);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `probe-${width}.json`);
  writeFileSync(path, JSON.stringify(probe), 'utf8');
  return { path: `.jig/critique/${opts.surface}/probe-${width}.json`, width, page: probe.pageFile as string };
}

/** A path inside the project that exists, resolved; otherwise nothing. */
export function projectFile(projectRoot: string, path: string): string | undefined {
  const abs = resolve(projectRoot, path);
  if (abs !== resolve(projectRoot) && !abs.startsWith(resolve(projectRoot) + sep)) return undefined;
  return existsSync(abs) ? abs : undefined;
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

/**
 * The widths every screen pass is judged at.
 *
 * 1600 is not a breakpoint: it is where a layout with no upper bound shows
 * itself. Two pages built from the same brief differed exactly there — one
 * locked its content at 1200, the other let `main` span the full viewport.
 * Judging only to 1280 never sees it.
 *
 * A fifth width, 900, is judged only when a spec says the composition changes
 * between tablet and desktop. Required everywhere, it would cost a composition,
 * a frame, a render and a row of verdicts on every page to settle a question
 * 768 and 1280 already answer.
 */
export const PROBE_WIDTHS = [360, 768, 1280, 1600];

/**
 * Runs the probe here and records it, for every width, against a page in this
 * project. This is what lets the Stop hook stop asking: when a browser exists,
 * the render is not a step an agent can skip.
 */
export async function runAndSaveProbes(opts: { projectRoot: string; surface: string; page: string; serve?: string; widths?: number[] }): Promise<SaveResult[]> {
  const abs = resolve(opts.projectRoot, opts.page);
  if (!existsSync(abs)) throw new Error(`${opts.page} does not exist, so there is nothing to render.`);
  const saved: SaveResult[] = [];
  await withPageUrl(opts.projectRoot, abs, opts.serve, async (url) => {
    for (const width of opts.widths ?? PROBE_WIDTHS) {
      const json = await runProbe({ url, width });
      saved.push(saveProbe({ projectRoot: opts.projectRoot, surface: opts.surface, json, page: abs, serveRoot: opts.serve }));
    }
  });
  return saved;
}

/** The URL a browser should load `abs` at: served from `serve` when given, as a file otherwise. */
async function withPageUrl(projectRoot: string, abs: string, serve: string | undefined, use: (url: string) => Promise<void>): Promise<void> {
  if (!serve) return use(`file://${abs}`);
  const root = resolve(projectRoot, serve);
  if (!existsSync(root)) throw new Error(`${serve} does not exist, so there is nothing to serve.`);
  if (!abs.startsWith(root + sep)) throw new Error(`The page is not inside ${serve}, so serving ${serve} cannot show it.`);
  const server = await serveDirectory(root);
  try {
    const path = relative(root, abs).split(sep).join('/');
    await use(`${server.origin}/${path}`);
  } finally {
    await server.close();
  }
}

/**
 * Renders and records what a critique's screen pass needs, when this machine
 * can: every width that has no probe, and every probe taken on an older
 * version of the page.
 *
 * This is the difference between a gate that asks and a gate that knows. The
 * probe was always the measurement; the render was the step an agent could
 * quietly skip, and in live runs it skipped it. Where a browser exists nobody
 * is asked any more.
 */
export async function ensureProbes(opts: { projectRoot: string; surface: string; page: string }): Promise<{ recorded: number[]; reason?: string }> {
  const dir = join(opts.projectRoot, '.jig', 'critique', opts.surface);
  const abs = resolve(opts.projectRoot, opts.page);
  let current: string;
  try {
    current = checksum(readFileSync(abs, 'utf8'));
  } catch {
    return { recorded: [], reason: `${opts.page} could not be read` };
  }
  const missing = PROBE_WIDTHS.filter((width) => {
    try {
      const probe = JSON.parse(readFileSync(join(dir, `probe-${width}.json`), 'utf8')) as { pageChecksum?: string; jigProbe?: number };
      return probe.jigProbe !== PROBE_VERSION || probe.pageChecksum !== current;
    } catch {
      return true;
    }
  });
  if (missing.length === 0) return { recorded: [] };
  if (!findChrome()) return { recorded: [], reason: 'no browser on this machine' };
  // Re-render the way it was first rendered: a page probed from a served
  // directory is served again.
  let serve: string | undefined;
  for (const width of PROBE_WIDTHS) {
    try {
      const probe = JSON.parse(readFileSync(join(dir, `probe-${width}.json`), 'utf8')) as { serveRoot?: string };
      if (probe.serveRoot) { serve = probe.serveRoot; break; }
    } catch { /* no probe at this width */ }
  }
  await withPageUrl(opts.projectRoot, abs, serve, async (url) => {
    for (const width of missing) {
      saveProbe({ projectRoot: opts.projectRoot, surface: opts.surface, json: await runProbe({ url, width }), page: abs, serveRoot: serve });
    }
  });
  return { recorded: missing };
}

/** Surfaces whose critique has written verdicts. */
export function critiquedSurfaces(projectRoot: string): string[] {
  const root = join(projectRoot, '.jig', 'critique');
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((surface) => !surface.startsWith('_') &&
    (existsSync(join(root, surface, 'screen.json')) || existsSync(join(root, surface, 'code.json'))));
}
