import { contrastRatio, extractColorComponents, type RGB } from '../check/color.js';

/**
 * Validates a proposed brand colour against the contract stated in
 * `tokens/brand.default.css` itself, so `init` never asks the user to do
 * arithmetic it can do for them:
 *
 *   - contrast: >= 4.5:1 against BOTH `--color-bg-raised` and `--color-fill`.
 *   - A-01: a violet/indigo hue is the unspecified-default band — flagged as
 *     "confirm this was deliberate", not a failure.
 *   - E-64: a red/amber/green hue collides with the system colours (error /
 *     warning / success) and must not be used for interactive elements.
 *
 * Reuses `check/color.ts` for all colour parsing and contrast maths — no
 * second implementation of either lives here.
 */

// --color-bg-raised: oklch(1 0 0) — pure white in any colour space, so no
// oklch parser is needed for this one.
const BG_RAISED: RGB = { r: 255, g: 255, b: 255 };

// --color-fill: rgb(0 0 0 / 4%), composited onto --color-bg-base
// (oklch(0.980 0.004 95)). check/color.ts has no oklch parser; the chroma
// there (0.004) is negligible, so the base is approximated as a near-white
// grey — accurate to well under 1 contrast-ratio unit, which is what matters
// for a pass/fail check against a 4.5:1 floor.
const BG_BASE_APPROX: RGB = { r: 250, g: 250, b: 248 };

function compositeOver(fg: RGB, alpha: number, bg: RGB): RGB {
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  };
}

const FILL_COMPOSITED: RGB = compositeOver({ r: 0, g: 0, b: 0 }, 0.04, BG_BASE_APPROX);

const CONTRAST_FLOOR = 4.5;

function toRgb(h: number, s: number, l: number): RGB {
  const comps = extractColorComponents(`hsl(${h} ${s}% ${l}%)`, {});
  if (!comps) throw new Error(`validate: could not resolve hsl(${h} ${s}% ${l}%) — this should never happen`);
  return comps.rgb;
}

function worstRatio(h: number, s: number, l: number): { vsRaised: number; vsFill: number; worst: number } {
  const rgb = toRgb(h, s, l);
  const vsRaised = contrastRatio(rgb, BG_RAISED);
  const vsFill = contrastRatio(rgb, FILL_COMPOSITED);
  return { vsRaised, vsFill, worst: Math.min(vsRaised, vsFill) };
}

/**
 * The dark-mode contract from `brand.default.css`: the brand keeps its hue and
 * saturation, lightness is overridden to `DARK_BRAND_L`, and the surfaces
 * become `hsl(h 6% 15%)` raised over `hsl(h 6% 10%)` base. The backgrounds
 * track the brand hue, so they are computed rather than constant.
 */
const DARK_BRAND_L = 88;
const DARK_SURFACE_S = 6;
const DARK_RAISED_L = 15;
const DARK_BASE_L = 10;
/** `--color-fill: rgb(255 255 255 / 6%)` in the dark block. */
const DARK_FILL_ALPHA = 0.06;

function darkWorstRatio(h: number, s: number): { vsRaised: number; vsFill: number; worst: number } {
  const brand = toRgb(h, s, DARK_BRAND_L);
  const raised = toRgb(h, DARK_SURFACE_S, DARK_RAISED_L);
  const base = toRgb(h, DARK_SURFACE_S, DARK_BASE_L);
  const fill = compositeOver({ r: 255, g: 255, b: 255 }, DARK_FILL_ALPHA, base);
  const vsRaised = contrastRatio(brand, raised);
  const vsFill = contrastRatio(brand, fill);
  return { vsRaised, vsFill, worst: Math.min(vsRaised, vsFill) };
}

/**
 * Searches lightness only (h and s fixed) for the nearest value that clears
 * the contrast floor, checking outward from `l` one step at a time so the
 * first hit is the nearest in either direction. `null` if nothing in
 * [0, 100] passes (only possible at very low saturation combined with a hue
 * that never gets dark or light enough — practically unreachable, but the
 * caller must not assume a passing value always exists).
 */
export function nearestPassingLightness(h: number, s: number, l: number): number | null {
  if (worstRatio(h, s, l).worst >= CONTRAST_FLOOR) return l;
  for (let delta = 1; delta <= 100; delta++) {
    for (const candidate of [l - delta, l + delta]) {
      if (candidate < 0 || candidate > 100) continue;
      if (worstRatio(h, s, candidate).worst >= CONTRAST_FLOOR) return candidate;
    }
  }
  return null;
}

// Mirrors the thresholds `check/detectors/violet-band-hue.ts` uses for A-01
// (not imported: those constants aren't exported, and touching src/check/ is
// off-limits on this branch — see the init task brief). Kept in sync by
// citing the same rule and the same numbers; this file's job is validating
// ONE proposed colour, not scanning source, so the duplication is a few
// numeric thresholds, not a second colour engine.
const VIOLET_HUE_MIN = 235;
const VIOLET_HUE_MAX = 290;
const HUE_MIN_SATURATION = 15;
const HUE_MIN_LIGHTNESS = 8;
const HUE_MAX_LIGHTNESS = 92;

function isHueVisible(s: number, l: number): boolean {
  return s >= HUE_MIN_SATURATION && l >= HUE_MIN_LIGHTNESS && l <= HUE_MAX_LIGHTNESS;
}

function isInVioletBand(h: number, s: number, l: number): boolean {
  return isHueVisible(s, l) && h >= VIOLET_HUE_MIN && h <= VIOLET_HUE_MAX;
}

// E-64 bands, centred on the system-colour hues declared in
// tokens/brand.default.css (--error-h: 0, --warning-h: 42, --success-h: 162),
// wide enough to catch the common named colours in that family (Tailwind
// red/orange/amber, amber/yellow, green/emerald) without reaching into an
// adjacent, visually distinct hue (blue, cyan, violet).
function systemCollision(h: number, s: number, l: number): 'red' | 'amber' | 'green' | null {
  if (!isHueVisible(s, l)) return null;
  if (h <= 20 || h >= 340) return 'red';
  if (h >= 25 && h <= 65) return 'amber';
  if (h >= 100 && h <= 170) return 'green';
  return null;
}

export interface ValidationResult {
  /** Light mode, kept under the original names so existing callers still work. */
  ratioVsRaised: number;
  ratioVsFill: number;
  /** Explicit aliases, so a reader does not have to know which mode is implied. */
  lightRatioVsRaised: number;
  lightRatioVsFill: number;
  lightWorstRatio: number;
  /**
   * Dark mode. `brand.default.css` ships a dark block that keeps the brand's
   * hue and saturation but overrides lightness to 88% against a
   * `hsl(h 6% 15%)` surface — values validation never looked at, so a colour
   * could be accepted and then fail the contract the generated brand file
   * itself states, in a mode the user finds by switching their OS theme.
   */
  darkRatioVsRaised: number;
  darkRatioVsFill: number;
  darkWorstRatio: number;
  /** The worse of the two modes. A brand has to work in both. */
  worstRatio: number;
  passesContrast: boolean;
  /** Only set when `passesContrast` is false and a passing lightness exists. */
  nearestPassingLightness?: number;
  /** A-01: hue falls in the unspecified-default violet/indigo band. */
  violetBand: boolean;
  /** E-64: hue collides with a system colour meaning. */
  systemCollision: 'red' | 'amber' | 'green' | null;
}

export function validateBrandColor(h: number, s: number, l: number): ValidationResult {
  const light = worstRatio(h, s, l);
  const dark = darkWorstRatio(h, s);
  const worst = Math.min(light.worst, dark.worst);
  const passesContrast = worst >= CONTRAST_FLOOR;
  return {
    ratioVsRaised: light.vsRaised,
    ratioVsFill: light.vsFill,
    lightRatioVsRaised: light.vsRaised,
    lightRatioVsFill: light.vsFill,
    lightWorstRatio: light.worst,
    darkRatioVsRaised: dark.vsRaised,
    darkRatioVsFill: dark.vsFill,
    darkWorstRatio: dark.worst,
    worstRatio: worst,
    passesContrast,
    nearestPassingLightness: passesContrast ? undefined : (nearestPassingLightness(h, s, l) ?? undefined),
    violetBand: isInVioletBand(h, s, l),
    systemCollision: systemCollision(h, s, l),
  };
}
