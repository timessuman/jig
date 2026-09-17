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
export function modeWiringProblems(projectRoot: string): ModeWiringProblem[] {
  let config: { brand?: unknown; surfaces?: { mode?: unknown }[] };
  try {
    config = JSON.parse(readFileSync(join(projectRoot, 'jig.config.json'), 'utf8'));
  } catch {
    return [];
  }
  if (typeof config.brand !== 'string' || !Array.isArray(config.surfaces)) return [];
  const modes = [...new Set(config.surfaces.map((s) => s?.mode).filter((m): m is string => typeof m === 'string'))];
  if (modes.length === 0) return [];

  const dir = dirname(config.brand);
  const rel = (f: string) => (dir === '.' ? f : `${dir}/${f}`);
  if (!existsSync(join(projectRoot, rel('theme.css')))) return [];

  const problems: ModeWiringProblem[] = [];
  modes.forEach((mode, i) => {
    const barrel = rel(i === 0 ? 'theme.css' : `theme.${mode}.css`);
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
