import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitRuleBlocks } from '../check/css.js';
import { extractColorComponents, type HSLColor } from '../check/color.js';

export type DerivationSource = 'css-custom-property' | 'tailwind-config' | 'literal-frequency' | 'default';

export interface ColorProposal extends HSLColor {
  source: DerivationSource;
  /** One-line, human-readable statement of where this came from — printed
   *  verbatim so the inference is never silent (see step 2 of the init
   *  brief: "propose ... state the inference"). */
  detail: string;
}

/** Jig's own unbranded default (`tokens/brand.default.css`). Used as the
 *  last-resort fallback when nothing in the project yields a colour — this
 *  is what "falls back cleanly" means: no invented hue, the same near-black
 *  the vendored default already ships (A-01-safe by construction). */
export const DEFAULT_PROPOSAL: ColorProposal = {
  h: 264,
  s: 0,
  l: 15,
  source: 'default',
  detail: 'no colour found in the project; using the unbranded default (near-black, matches tokens/brand.default.css)',
};

const NAME_PRIORITY_RE = /brand|primary|accent/i;
/** I6: an exact custom-property name outranks a compound one that merely
 *  contains it (`--accent-border` vs `--accent`) among named candidates. */
const EXACT_NAMES = new Set(['brand', 'primary', 'accent']);
/** Anything this desaturated reads as a neutral (grey), not a colour choice
 *  — mirrors the threshold `violet-band-hue` uses for the same reason. */
const MIN_CHROMATIC_SATURATION = 15;

interface Candidate {
  value: string;
  hsl: HSLColor;
  name?: string;
  file: string;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function toProposal(c: Candidate, source: DerivationSource, why: string): ColorProposal {
  return { h: round(c.hsl.h), s: round(c.hsl.s), l: round(c.hsl.l), source, detail: why };
}

/** Groups candidates by their resolved hsl (rounded) and returns the one
 *  that occurs most often, preferring a more saturated colour on a tie —
 *  a frequent near-grey is more likely incidental than a deliberate brand
 *  pick. Returns `undefined` on an empty input rather than throwing — every
 *  call site is responsible for falling back to a non-empty pool (see C1:
 *  a call site that forgets this guard must degrade, not crash). */
function mostFrequent(candidates: Candidate[]): Candidate | undefined {
  if (candidates.length === 0) return undefined;
  const counts = new Map<string, { count: number; candidate: Candidate }>();
  for (const c of candidates) {
    const key = `${Math.round(c.hsl.h)}|${Math.round(c.hsl.s)}|${Math.round(c.hsl.l)}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { count: 1, candidate: c });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || b.candidate.hsl.s - a.candidate.hsl.s)[0]
    .candidate;
}

/**
 * Priority 1: CSS custom properties already declared in the project's own
 * stylesheets. A `:root`-level `--name: value` whose value parses as a
 * literal colour is a candidate; a name containing `brand`/`primary`/`accent`
 * wins outright, otherwise the most frequently repeated chromatic value is
 * proposed.
 */
export function fromCssCustomProperties(projectRoot: string, cssFiles: string[]): ColorProposal | null {
  const candidates: Candidate[] = [];
  for (const file of cssFiles) {
    let source: string;
    try {
      source = readFileSync(join(projectRoot, file), 'utf8');
    } catch {
      continue;
    }
    for (const block of splitRuleBlocks(source)) {
      if (block.body.includes('{')) continue;
      const re = /--([\w-]+)\s*:\s*([^;]+);/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(block.body))) {
        const [, name, rawValue] = m;
        const value = rawValue.trim();
        const comps = extractColorComponents(value, {});
        if (!comps || comps.alpha < 0.999) continue;
        candidates.push({ value, hsl: comps.hsl, name, file });
      }
    }
  }
  if (candidates.length === 0) return null;

  // I6: a name match alone isn't enough — `--accent-border: #eee` (a
  // near-grey border colour that merely has "accent" in its name) must not
  // beat a real brand colour two lines below just because it comes first in
  // file order. Named candidates are filtered by the same chromaticity
  // guard as everything else, and among what's left, an exact name
  // (`--brand`, `--primary`, `--accent`) outranks a compound one
  // (`--accent-border`, `--brand-color`, ...) — a person naming a variable
  // exactly `--brand` is stating the brand colour on purpose.
  const namedChromatic = candidates.filter(
    (c) => c.name && NAME_PRIORITY_RE.test(c.name) && c.hsl.s >= MIN_CHROMATIC_SATURATION,
  );
  if (namedChromatic.length > 0) {
    const exact = namedChromatic.find((c) => EXACT_NAMES.has(c.name!.toLowerCase()));
    const named = exact ?? namedChromatic[0];
    return toProposal(named, 'css-custom-property', `--${named.name}: ${named.value} in ${named.file}`);
  }

  const chromatic = candidates.filter((c) => c.hsl.s >= MIN_CHROMATIC_SATURATION);
  const pool = chromatic.length > 0 ? chromatic : candidates;
  const chosen = mostFrequent(pool) ?? pool[0];
  return toProposal(
    chosen,
    'css-custom-property',
    `--${chosen.name}: ${chosen.value} in ${chosen.file} (most repeated custom-property colour)`,
  );
}

/**
 * Returns the substring between the `{` at `openIdx` and its matching `}`,
 * or `null` if unbalanced. A small brace counter — not a JS parser, and
 * deliberately so: this never evaluates the config file, only reads text out
 * of it, so a config with side-effecting code at import time is never run.
 */
function balancedBraceBody(source: string, openIdx: number): string | null {
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openIdx + 1, i);
    }
  }
  return null;
}

/**
 * Priority 2: a Tailwind v3 config's `theme.extend.colors` (or `theme.colors`
 * as a fallback). Text-only extraction via a brace counter and a
 * `key: 'value'` regex — the config is never `require`d or evaluated, so a
 * config that imports other modules or runs code at load time is inert here.
 */
export function fromTailwindConfig(projectRoot: string, tailwindConfigFile: string): ColorProposal | null {
  let source: string;
  try {
    source = readFileSync(join(projectRoot, tailwindConfigFile), 'utf8');
  } catch {
    return null;
  }

  const colorsBlock = (() => {
    const extendIdx = source.search(/\bextend\s*:\s*\{/);
    if (extendIdx !== -1) {
      const extendBraceIdx = source.indexOf('{', extendIdx);
      const extendBody = balancedBraceBody(source, extendBraceIdx);
      if (extendBody) {
        const colorsIdx = extendBody.search(/\bcolors\s*:\s*\{/);
        if (colorsIdx !== -1) {
          const braceIdx = extendBody.indexOf('{', colorsIdx);
          const body = balancedBraceBody(extendBody, braceIdx);
          if (body) return body;
        }
      }
    }
    const colorsIdx = source.search(/\bcolors\s*:\s*\{/);
    if (colorsIdx !== -1) {
      const braceIdx = source.indexOf('{', colorsIdx);
      return balancedBraceBody(source, braceIdx);
    }
    return null;
  })();
  if (!colorsBlock) return null;

  const candidates: Candidate[] = [];
  const re = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(colorsBlock))) {
    const [, name, value] = m;
    const comps = extractColorComponents(value, {});
    if (!comps || comps.alpha < 0.999) continue;
    candidates.push({ value, hsl: comps.hsl, name, file: tailwindConfigFile });
  }
  if (candidates.length === 0) return null;

  // I6: same guard as the CSS custom-property path — a named key only wins
  // outright when it's also chromatic, and an exact name (`brand`) outranks
  // a compound one (`brand-muted`) among what qualifies.
  const namedChromatic = candidates.filter(
    (c) => NAME_PRIORITY_RE.test(c.name!) && c.hsl.s >= MIN_CHROMATIC_SATURATION,
  );
  const named = namedChromatic.length > 0
    ? (namedChromatic.find((c) => EXACT_NAMES.has(c.name!.toLowerCase())) ?? namedChromatic[0])
    : undefined;
  const chromatic = candidates.filter((c) => c.hsl.s >= MIN_CHROMATIC_SATURATION);
  const pool = chromatic.length > 0 ? chromatic : candidates;
  const chosen = named ?? mostFrequent(pool) ?? pool[0];
  return toProposal(
    chosen,
    'tailwind-config',
    `theme.extend.colors.${chosen.name}: '${chosen.value}' in ${tailwindConfigFile}`,
  );
}

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_HSL_RE = /(?:rgb|hsl)a?\([^)]*\)/g;

/**
 * Priority 3: literal colours anywhere in the project's stylesheets, by
 * frequency — the fallback when neither custom properties nor a Tailwind
 * config yielded anything. Greys and near-black/white are excluded so a
 * page full of `#000`/`#fff`/`#eee` utility colours doesn't win by volume.
 */
export function fromLiteralFrequency(projectRoot: string, cssFiles: string[]): ColorProposal | null {
  const candidates: Candidate[] = [];
  for (const file of cssFiles) {
    let source: string;
    try {
      source = readFileSync(join(projectRoot, file), 'utf8');
    } catch {
      continue;
    }
    for (const re of [HEX_RE, RGB_HSL_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(source))) {
        const comps = extractColorComponents(m[0], {});
        if (!comps || comps.alpha < 0.999) continue;
        if (comps.hsl.s < MIN_CHROMATIC_SATURATION) continue;
        candidates.push({ value: m[0], hsl: comps.hsl, file });
      }
    }
  }
  if (candidates.length === 0) return null;

  const chosen = mostFrequent(candidates) ?? candidates[0];
  return toProposal(
    chosen,
    'literal-frequency',
    `${chosen.value} — the most frequent literal chromatic colour across ${cssFiles.length} stylesheet(s), in ${chosen.file}`,
  );
}

/**
 * Runs the three derivation strategies in priority order and falls back to
 * `DEFAULT_PROPOSAL` when none of them find anything — see step 2 of the
 * init brief ("derive, don't interrogate").
 */
export function deriveBrandColor(
  projectRoot: string,
  cssFiles: string[],
  tailwindConfigFile: string | undefined,
): ColorProposal {
  return (
    fromCssCustomProperties(projectRoot, cssFiles) ??
    (tailwindConfigFile ? fromTailwindConfig(projectRoot, tailwindConfigFile) : null) ??
    fromLiteralFrequency(projectRoot, cssFiles) ??
    DEFAULT_PROPOSAL
  );
}
