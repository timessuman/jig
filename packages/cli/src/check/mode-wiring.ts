import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface ModeWiringProblem {
  mode: string;
  /** Repo-relative path of the barrel that should carry this mode. */
  barrel: string;
  message: string;
}

/**
 * Modes `jig.config.json` declares that the token layer does not deliver.
 *
 * `init --yes` declares no surfaces, so it writes the token layer at `product`.
 * Declaring `editorial` in the config afterwards changes what every agent reads
 * — mode-gated rules, the procedures — and changes nothing the browser reads:
 * `theme.css` still imports `mode.product.css`. A live run built an editorial
 * page on product density that way, and nothing said so. Only `init` rewrites
 * the barrels, so the fix is to run it again.
 *
 * Mirrors init's layout: the first surface's mode is in `theme.css`, every other
 * mode in `theme.<mode>.css`, all beside the brand file. A project with no
 * config, no surfaces, or no token layer on disk yet has nothing to compare.
 */
const MODES = ['editorial', 'product', 'operator'];

/**
 * A `jig.config.json` that exists but cannot be read the way `init` wrote it.
 *
 * In arm test 3 an agent rewrote it by hand — `"brand": "jig"` (a directory) in
 * one run, `"surfaces": {"pricing": "editorial"}` (an object) in another. Both
 * were accepted in silence: the mode came out `unknown`, mode-gated rules went
 * quiet, and the wiring check above could not find the token files to compare.
 */
function configProblems(config: { brand?: unknown; surfaces?: unknown }): ModeWiringProblem[] {
  const problems: ModeWiringProblem[] = [];
  const at = 'jig.config.json';
  if (config.brand !== undefined) {
    // Shape only, not existence: the procedure writes the config before `init`
    // creates the file it names.
    if (typeof config.brand !== 'string' || !config.brand.endsWith('.css')) {
      problems.push({ mode: '', barrel: at, message: `jig.config.json "brand" is ${JSON.stringify(config.brand)}, which is not a brand .css file in this project` });
    }
  }
  if (config.surfaces !== undefined) {
    const ok = Array.isArray(config.surfaces) && config.surfaces.every(
      (x) => x && typeof x === 'object' && typeof (x as { match?: unknown }).match === 'string' && MODES.includes((x as { mode?: string }).mode ?? ''),
    );
    if (!ok) {
      problems.push({ mode: '', barrel: at, message: `jig.config.json "surfaces" must be a list of {"match": "/", "mode": "${MODES.join('|')}"} — as written, no mode applies and mode-gated rules are silent` });
    }
  }
  return problems;
}

export function modeWiringProblems(projectRoot: string): ModeWiringProblem[] {
  let config: { brand?: unknown; surfaces?: { mode?: unknown }[] };
  const path = join(projectRoot, 'jig.config.json');
  if (!existsSync(path)) return [];
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [{ mode: '', barrel: 'jig.config.json', message: 'jig.config.json is not valid JSON, so nothing in it applies' }];
  }
  const invalid = configProblems(config);
  if (invalid.length > 0) return invalid;
  if (typeof config.brand !== 'string' || !Array.isArray(config.surfaces)) return [];
  const modes = [...new Set(config.surfaces.map((s) => s?.mode).filter((m): m is string => typeof m === 'string'))];
  if (modes.length === 0) return [];

  const dir = dirname(config.brand);
  const rel = (f: string) => (dir === '.' ? f : `${dir}/${f}`);
  // One mode: `theme.css`. Two or more: every barrel names its mode, and the
  // single-mode barrel should be gone (see `barrelBody` in commands/init.ts).
  const multi = modes.length > 1;
  const barrelOf = (mode: string) => (multi ? `theme.${mode}.css` : 'theme.css');
  const anyBarrel = ['theme.css', ...modes.map((m) => `theme.${m}.css`)].some((f) => existsSync(join(projectRoot, rel(f))));
  if (!anyBarrel) return [];

  const problems: ModeWiringProblem[] = [];
  if (multi && existsSync(join(projectRoot, rel('theme.css')))) {
    problems.push({
      mode: modes[0]!, barrel: rel('theme.css'),
      message: `jig.config.json declares ${modes.length} modes, so each barrel names its mode: ${rel('theme.css')} should be ${rel(barrelOf(modes[0]!))}, imported by the layouts that serve it and not by the global stylesheet`,
    });
  }
  modes.forEach((mode) => {
    const barrel = rel(barrelOf(mode));
    const modeFile = `mode.${mode}.css`;
    let body: string;
    try {
      body = readFileSync(join(projectRoot, barrel), 'utf8');
    } catch {
      problems.push({ mode, barrel, message: `jig.config.json declares ${mode}, but ${barrel} does not exist` });
      return;
    }
    const imported = /@import\s+["'][^"']*mode\.(\w+)\.css["']/.exec(body)?.[1];
    if (imported !== mode) {
      problems.push({
        mode, barrel,
        message: `jig.config.json declares ${mode}, but ${barrel} imports ${imported ? `mode.${imported}.css` : 'no mode file'} — the page is styled at ${imported ?? 'no'} density`,
      });
    } else if (!existsSync(join(projectRoot, rel(modeFile)))) {
      problems.push({ mode, barrel, message: `jig.config.json declares ${mode}, but ${rel(modeFile)} does not exist` });
    }
  });
  return problems;
}
