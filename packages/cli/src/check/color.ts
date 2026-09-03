/**
 * Minimal CSS colour parsing and WCAG contrast math for the `check`
 * mechanical detectors. Deliberately narrow: only opaque, literal colour
 * forms (hex / rgb() / hsl(), plus `var(--token)` references that resolve
 * to one of those) are ever returned. Anything else — `oklch()`,
 * `currentColor`, a gradient, an unresolvable custom property, a colour
 * with alpha < 1 — resolves to `null`. Detectors that need certainty (the
 * contrast floor) skip a `null`; detectors that only need a hue (the
 * violet-band check) can still use a translucent colour's hue via
 * `extractColorComponents`.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface ColorComponents {
  rgb: RGB;
  hsl: HSLColor;
  alpha: number;
}

const NAMED: Record<string, RGB> = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
};

function parseComponent(raw: string): number {
  const v = raw.trim();
  if (v.endsWith('%')) return Math.round((parseFloat(v) / 100) * 255);
  return Math.round(parseFloat(v));
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 1;
  const v = raw.trim();
  return v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
}

function splitFnArgs(inner: string): { parts: string[]; alphaStr: string | undefined } {
  if (inner.includes(',')) {
    const parts = inner.split(',').map((p) => p.trim());
    const alphaStr = parts.length === 4 ? parts.pop() : undefined;
    return { parts, alphaStr };
  }
  const [main, alphaStr] = inner.split('/').map((p) => p.trim());
  return { parts: main.split(/\s+/).filter(Boolean), alphaStr };
}

function parseHex(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value.trim());
  if (!m) return null;
  const hex = m[1];
  let r: number, g: number, b: number, a = 255;
  if (hex.length === 3 || hex.length === 4) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
    if (hex.length === 4) a = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16);
  }
  return { r, g, b, a: a / 255 };
}

function parseRgbFn(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^rgba?\(([^)]*)\)$/i.exec(value.trim());
  if (!m) return null;
  const { parts, alphaStr } = splitFnArgs(m[1].trim());
  if (parts.length !== 3) return null;
  const [r, g, b] = parts.map(parseComponent);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a: parseAlpha(alphaStr) };
}

function parseHslFn(value: string): { h: number; s: number; l: number; a: number } | null {
  const m = /^hsla?\(([^)]*)\)$/i.exec(value.trim());
  if (!m) return null;
  const { parts, alphaStr } = splitFnArgs(m[1].trim());
  if (parts.length !== 3) return null;
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]);
  const l = parseFloat(parts[2]);
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;
  return { h: ((h % 360) + 360) % 360, s, l, a: parseAlpha(alphaStr) };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = lN - c / 2;
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

function rgbToHsl(rgb: RGB): HSLColor {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/**
 * Repeatedly substitutes `var(--name)` (or its fallback, when the token is
 * unknown) using `tokens`, up to a small depth so a token that references
 * another token (`--color-brand: hsl(var(--brand-h) ...)`) still resolves.
 * A `var()` whose name is not in `tokens` and has no fallback is left as-is
 * — the caller treats a value that still contains `var(` as unresolved.
 */
export function substituteVars(value: string, tokens: Record<string, string>, depth = 0): string {
  if (depth > 6) return value;
  let changed = false;
  const result = value.replace(/var\(\s*--([\w-]+)\s*(?:,\s*([^)]*))?\)/gi, (match, name, fallback) => {
    if (Object.prototype.hasOwnProperty.call(tokens, name)) {
      changed = true;
      return tokens[name];
    }
    if (fallback !== undefined) {
      changed = true;
      return fallback;
    }
    return match;
  });
  return changed ? substituteVars(result, tokens, depth + 1) : result;
}

// oklch(L C H [/ A]) — L as 0..1 or a percentage, C absolute (or a percentage
// of 0.4), H in degrees. Tailwind v4 and shadcn/ui emit oklch by default, so a
// parser that skipped it derived nothing from a large share of real projects
// and computed no contrast against Jig's own `--color-bg-base`.
const OKLCH_RE =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([-\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

/** sRGB gamma encode. */
function gammaEncode(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * oklch -> sRGB, via oklab and linear sRGB (Björn Ottosson's matrices).
 * Out-of-gamut colours are clamped per channel, which is what browsers do for
 * an sRGB display, and is the right answer for a contrast calculation.
 */
function parseOklchFn(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = OKLCH_RE.exec(value.trim());
  if (!m) return null;

  const num = (raw: string, pctBasis: number): number =>
    raw.endsWith('%') ? (Number.parseFloat(raw) / 100) * pctBasis : Number.parseFloat(raw);

  const L = num(m[1], 1);
  const C = num(m[2], 0.4);
  const H = Number.parseFloat(m[3]);
  const a = m[4] === undefined ? 1 : Math.min(1, Math.max(0, num(m[4], 1)));
  if ([L, C, H].some((n) => !Number.isFinite(n))) return null;

  const hRad = (H * Math.PI) / 180;
  const oa = C * Math.cos(hRad);
  const ob = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * oa + 0.2158037573 * ob;
  const m_ = L - 0.1055613458 * oa - 0.0638541728 * ob;
  const s_ = L - 0.0894841775 * oa - 1.291485548 * ob;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const ss = s_ ** 3;

  const lr = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss;
  const lg = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss;
  const lb = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss;

  const to255 = (lin: number): number =>
    Math.round(Math.min(1, Math.max(0, gammaEncode(lin))) * 255);

  return { r: to255(lr), g: to255(lg), b: to255(lb), a };
}

/**
 * Resolves `value` to its RGB/HSL components and alpha, substituting any
 * `var(--token)` references against `tokens` first. Returns `null` for
 * anything it cannot parse as a literal colour (currentColor,
 * gradients, an unresolved custom property, ...) — callers must not guess
 * past that.
 */
export function extractColorComponents(value: string, tokens: Record<string, string>): ColorComponents | null {
  const substituted = substituteVars(value, tokens).trim();
  if (/var\(/i.test(substituted)) return null;

  const named = NAMED[substituted.toLowerCase()];
  if (named) return { rgb: named, hsl: rgbToHsl(named), alpha: 1 };

  const hex = parseHex(substituted);
  if (hex) {
    const rgb = { r: hex.r, g: hex.g, b: hex.b };
    return { rgb, hsl: rgbToHsl(rgb), alpha: hex.a };
  }

  const rgbFn = parseRgbFn(substituted);
  if (rgbFn) {
    const rgb = { r: rgbFn.r, g: rgbFn.g, b: rgbFn.b };
    return { rgb, hsl: rgbToHsl(rgb), alpha: rgbFn.a };
  }

  const hslFn = parseHslFn(substituted);
  if (hslFn) {
    const rgb = hslToRgb(hslFn.h, hslFn.s, hslFn.l);
    return { rgb, hsl: { h: hslFn.h, s: hslFn.s, l: hslFn.l }, alpha: hslFn.a };
  }

  const oklch = parseOklchFn(substituted);
  if (oklch) {
    const rgb = { r: oklch.r, g: oklch.g, b: oklch.b };
    return { rgb, hsl: rgbToHsl(rgb), alpha: oklch.a };
  }

  return null;
}

// Matches a `var(--name, fallback)` call — specifically one THAT CARRIES A
// FALLBACK. The fallback only applies on the branch where the custom
// property is undefined, which by construction is the branch that does NOT
// run when it IS defined — and Jig never reads the consumer's `:root` to
// know which branch is live. Substituting it in for a contrast calculation
// reports the fallback as fact when it may never be the value in play.
const VAR_WITH_FALLBACK_RE = /var\(\s*--[\w-]+\s*,/i;

/** Like `extractColorComponents`, but returns `null` unless the colour is
 * fully opaque — the only case a contrast calculation can trust — AND the
 * value contains no `var(--x, fallback)`. A fallback is a guess about a
 * branch of the cascade Jig cannot observe; `contrast-floor` must skip
 * those pairs rather than score the fallback as if it were live. (The
 * plain fallback substitution in `substituteVars`/`extractColorComponents`
 * is preserved for callers like `violet-band-hue`, which only asks a
 * question at `warning` severity and is not claiming certainty.) */
export function resolveOpaqueColor(value: string, tokens: Record<string, string>): RGB | null {
  if (VAR_WITH_FALLBACK_RE.test(value)) return null;
  const c = extractColorComponents(value, tokens);
  if (!c || c.alpha < 0.999) return null;
  return c.rgb;
}

export function relativeLuminance(rgb: RGB): number {
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a) + 0.05;
  const lb = relativeLuminance(b) + 0.05;
  return la > lb ? la / lb : lb / la;
}
