/**
 * APCA (WCAG 3 draft) lightness contrast, W3 0.1.9 / "98G-4g" constants.
 *
 * Lives here rather than in the CLI because the CLI has no APCA detector, by
 * decision: `check` fails builds on WCAG 2.1 AA, which is what is legally
 * referenced, and a mechanical rule that fails a build against a *draft*
 * standard would be asserting more than the draft does. `02-tokens.md` says the
 * same thing in prose — comply with WCAG 2.1, check APCA as well.
 *
 * What it is used for is the token set's own values, where the two systems
 * disagree about what is defensible and the disagreement is the point: our
 * `--opacity-disabled` was chosen before anyone computed its Lc.
 *
 * If a detector is ever added, this moves into `check/` and stops being a
 * script. It is one function; that will not be the hard part.
 */

const Rco = 0.2126729;
const Gco = 0.7151522;
const Bco = 0.0721750;
const mainTRC = 2.4;

const normBG = 0.56;
const normTXT = 0.57;
const revTXT = 0.62;
const revBG = 0.65;

const blkThrs = 0.022;
const blkClmp = 1.414;
const scale = 1.14;
const offset = 0.027;
const deltaYmin = 0.0005;
const loClip = 0.1;

/** Screen luminance of an opaque sRGB triple, with APCA's black soft-clamp. */
function luminance([r, g, b]) {
  const y =
    Rco * (r / 255) ** mainTRC + Gco * (g / 255) ** mainTRC + Bco * (b / 255) ** mainTRC;
  return y < blkThrs ? y + (blkThrs - y) ** blkClmp : y;
}

/**
 * Lc for `text` on `background`, both opaque `[r, g, b]` 0–255.
 *
 * Positive for dark text on light, negative for light on dark — APCA is
 * polarity-signed, unlike a WCAG ratio, because the two directions genuinely
 * are not equivalent. Callers comparing against a threshold want `Math.abs`.
 */
export function apcaContrast(text, background) {
  const Yt = luminance(text);
  const Yb = luminance(background);
  if (Math.abs(Yb - Yt) < deltaYmin) return 0;

  let sapc;
  let lc;
  if (Yb > Yt) {
    sapc = (Yb ** normBG - Yt ** normTXT) * scale;
    lc = sapc < loClip ? 0 : sapc - offset;
  } else {
    sapc = (Yb ** revBG - Yt ** revTXT) * scale;
    lc = sapc > -loClip ? 0 : sapc + offset;
  }
  return lc * 100;
}

/** `foreground` at `alpha` composited over an opaque `background`. */
export function over(alpha, foreground, background) {
  return foreground.map((c, i) => Math.round(c * alpha + background[i] * (1 - alpha)));
}
