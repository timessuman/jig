import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitRuleBlocks } from './css.js';
import { extractColorComponents, contrastRatio, type RGB } from './color.js';

/**
 * Validates the token layer's own declarations.
 *
 * `init` checks a brand colour once, at write time. After that nothing looked
 * again: `check` validates how tokens are USED in a project's stylesheets, and
 * `.jig/tokens/` is not in the scanned set, so the tokens themselves were never
 * read back. A brand file edited afterwards — by a person or an agent — went
 * unexamined. `--color-text-weak` dropped to 22% opacity and `check` reported
 * "No findings".
 *
 * That is the real hole under the question of who should author tokens. It is
 * not that one author is more careless than another; it is that nothing checked
 * the result either way. With this, instruct-then-verify becomes available: a
 * generated token layer and a hand-written one are held to the same floors.
 *
 * Only floors are checked, never density. `--size-control` at 28px is a
 * deliberate `operator` choice; `--size-touch-target` at 32px is an
 * accessibility failure. Reporting the first would teach people to ignore the
 * second.
 */

/** WCAG 2.1 AA: normal text. */
const TEXT_FLOOR = 4.5;
/** WCAG 2.1 AA: interface components and graphical objects. */
const UI_FLOOR = 3;

/** Foreground roles and the floor each is held to. Matched by prefix so a
 *  project's own `--color-text-*` additions are covered too. */
const FOREGROUNDS: Array<{ prefix: string; floor: number }> = [
  { prefix: '--color-text-', floor: TEXT_FLOOR },
  { prefix: '--color-stroke-', floor: UI_FLOOR },
  { prefix: '--color-focus', floor: UI_FLOOR },
];

/** Surfaces a foreground can land on. `--color-fill` is the tightest and the
 *  easiest to forget — a tinted row or a badge is still a background. */
const SURFACES = ['--color-bg-base', '--color-bg-raised', '--color-bg-overlay', '--color-fill'];

/** Values that are accessibility limits rather than density decisions. A mode
 *  may set any control height it likes; it may not put sustained reading below
 *  18px or a hit area below 48px. */
const NUMERIC_FLOORS: Array<{ token: string; min: number; why: string }> = [
  { token: '--text-prose', min: 18, why: 'sustained reading (B-75)' },
  { token: '--size-touch-target', min: 48, why: 'hit area, unchanged in every mode' },
];

export type Theme = 'light' | 'dark';

export interface TokenProblem {
  token: string;
  /** The surface it fails against, for a contrast problem. */
  surface?: string;
  theme: Theme;
  ratio?: number;
  /** The value found, for a numeric problem. */
  value?: number;
  floor: number;
  file: string;
  line: number;
  message: string;
}

interface Declaration {
  value: string;
  line: number;
  file: string;
}

type Scope = Record<string, Declaration>;

/** `rgb(0 0 0 / 60%)` over a surface. Jig's foregrounds are alpha by design —
 *  it is how one ramp reads correctly on every surface — so a contrast figure
 *  for one is meaningless until it is composited. */
function composite(fg: RGB, alpha: number, bg: RGB): RGB {
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  };
}

function isDarkBlock(selector: string, atRuleDepth: number): boolean {
  return /data-theme\s*=\s*["']?dark/.test(selector) || atRuleDepth > 0;
}

/** Collects `:root` declarations per theme across every token file.
 *  Light is the unconditional `:root`; dark is light with the dark blocks
 *  applied over it, which is what the cascade actually produces. */
function collectScopes(files: Array<{ path: string; source: string }>): Record<Theme, Scope> {
  const light: Scope = {};
  const darkOverrides: Scope = {};

  for (const { path, source } of files) {
    for (const block of splitRuleBlocks(source)) {
      if (block.body.includes('{')) continue; // a wrapper, not a leaf
      if (!/^:root/.test(block.selector.trim())) continue;
      const target = isDarkBlock(block.selector, block.atRuleDepth) ? darkOverrides : light;
      for (const m of block.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        const offsetInBody = m.index ?? 0;
        target[m[1]] = {
          value: m[2].trim(),
          file: path,
          // `bodyStartLine` is where the block's body begins; add the newlines
          // before this declaration inside it.
          line: block.bodyStartLine + block.body.slice(0, offsetInBody).split('\n').length - 1,
        };
      }
    }
  }

  return { light, dark: { ...light, ...darkOverrides } };
}

/** A scope as the flat `name -> value` map the colour resolver expects. */
const asTokenMap = (scope: Scope): Record<string, string> =>
  Object.fromEntries(Object.entries(scope).map(([k, v]) => [k.replace(/^--/, ''), v.value]));

function floorFor(token: string): number | null {
  // `-weak` strokes are decorative dividers, not interface components: WCAG
  // does not hold a hairline separator to 3:1, and reporting one would be
  // reporting a value that is correct.
  if (/^--color-stroke-.*-weak$/.test(token) || token === '--color-stroke-weak') return null;
  for (const { prefix, floor } of FOREGROUNDS) {
    if (token.startsWith(prefix)) return floor;
  }
  return null;
}

/**
 * The token layer's CSS files, wherever this project keeps them.
 *
 * Located from `.jig/state.json`, which records every file `init` wrote, rather
 * than from a fixed directory. This read `.jig/tokens/` directly for exactly as
 * long as that was the only possible answer — and the moment the token layer
 * began following the project's own layout, it found nothing and reported
 * nothing. A check that goes quiet when its subject moves is worse than one
 * that was never written, because the silence reads as a pass.
 *
 * `.jig/tokens/` remains the fallback for a project that has a token layer but
 * no sidecar — one vendored by hand, or by a version that predates it.
 */
function tokenFiles(projectRoot: string): Array<{ path: string; source: string }> {
  const read = (rel: string) => {
    try {
      return readFileSync(join(projectRoot, ...rel.split('/')), 'utf8');
    } catch {
      return null;
    }
  };

  const statePath = join(projectRoot, '.jig', 'state.json');
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, 'utf8')) as { files?: Record<string, string> };
      const recorded = Object.keys(state.files ?? {})
        .filter((f) => f.endsWith('.css'))
        .sort();
      const out = recorded
        .map((path) => ({ path, source: read(path) }))
        .filter((f): f is { path: string; source: string } => f.source !== null);
      if (out.length > 0) return out;
    } catch {
      // fall through to the legacy directory
    }
  }

  const legacy = join(projectRoot, '.jig', 'tokens');
  if (!existsSync(legacy)) return [];
  return readdirSync(legacy)
    .filter((f) => f.endsWith('.css'))
    .sort()
    .map((f) => ({ path: `.jig/tokens/${f}`, source: readFileSync(join(legacy, f), 'utf8') }));
}

export function auditTokenLayer(projectRoot: string): TokenProblem[] {
  const files = tokenFiles(projectRoot);
  if (files.length === 0) return [];

  const scopes = collectScopes(files);
  const problems: TokenProblem[] = [];

  for (const theme of ['light', 'dark'] as const) {
    const scope = scopes[theme];
    const map = asTokenMap(scope);

    // Resolve the surfaces once. A surface that is itself translucent
    // (`--color-fill` is an alpha of black) composites over the base.
    const base = extractColorComponents(scope['--color-bg-base']?.value ?? '', map);
    const surfaces: Array<{ name: string; rgb: RGB }> = [];
    for (const name of SURFACES) {
      const decl = scope[name];
      if (!decl) continue;
      const c = extractColorComponents(decl.value, map);
      if (!c) continue;
      if (c.alpha >= 0.999) surfaces.push({ name, rgb: c.rgb });
      else if (base && base.alpha >= 0.999) {
        surfaces.push({ name, rgb: composite(c.rgb, c.alpha, base.rgb) });
      }
    }
    if (surfaces.length === 0) continue;

    for (const [token, decl] of Object.entries(scope)) {
      const floor = floorFor(token);
      if (floor === null) continue;
      const fg = extractColorComponents(decl.value, map);
      if (!fg) continue; // unresolvable — skipped rather than guessed at

      // ONE problem per token per theme, naming the worst surface it fails
      // against and how many others it also fails. A token that is simply too
      // pale fails on every surface, and reporting it four times turns one
      // defect into four errors — which is how an error count stops meaning
      // anything. Which surfaces still matters, because the common real case
      // is a token that clears `--color-bg-base` and fails on `--color-fill`.
      const failures = surfaces
        .map((surface) => {
          const solid = fg.alpha >= 0.999 ? fg.rgb : composite(fg.rgb, fg.alpha, surface.rgb);
          return { surface: surface.name, ratio: contrastRatio(solid, surface.rgb) };
        })
        .filter((f) => f.ratio < floor)
        .sort((a, b) => a.ratio - b.ratio);

      if (failures.length === 0) continue;
      const worst = failures[0];
      const others = failures.length - 1;
      problems.push({
        token,
        surface: worst.surface,
        theme,
        ratio: Math.round(worst.ratio * 100) / 100,
        floor,
        file: decl.file,
        line: decl.line,
        message:
          `${token} is ${worst.ratio.toFixed(2)}:1 against ${worst.surface} in ${theme} mode, ` +
          `below the ${floor}:1 floor the token layer states for this role` +
          (others > 0 ? ` (and below it on ${others} other surface${others > 1 ? 's' : ''})` : '') +
          '.',
      });
    }

    for (const { token, min, why } of NUMERIC_FLOORS) {
      const decl = scope[token];
      if (!decl) continue;
      const px = /^([\d.]+)px$/.exec(decl.value.trim());
      if (!px) continue; // a clamp() or a var() — a range, not a point
      const value = Number(px[1]);
      if (value >= min) continue;
      problems.push({
        token,
        theme,
        value,
        floor: min,
        file: decl.file,
        line: decl.line,
        message:
          `${token} is ${value}px, below the ${min}px floor for ${why}. ` +
          `This is an accessibility limit, not a density setting.`,
      });
    }
  }

  return problems;
}
