/**
 * Whether a piece of a project adapts its composition to the viewport.
 *
 * This is a question about the PROJECT, answered by asking it of every style
 * region and OR-ing the results. A three-column grid in `pricing.css` whose
 * collapse lives in `responsive.css` is responsive, and no single-file answer
 * can see that. See `projectResponsive` in `types.ts`.
 *
 * Deliberately generous: a construct counts even if it adapts only one thing.
 * The detector this feeds fires on the ABSENCE of all of them, so every
 * construct listed here is a way to stay silent, and silence is the cheap
 * error. A project that adapts badly is `critique`'s business; a project that
 * never adapts at all is decidable, and that is the only thing claimed.
 */

// A media query counts only when its condition is about the viewport or the
// pointing device. `prefers-reduced-motion`, `prefers-color-scheme` and `print`
// adapt to the user or the output, never to the width — and the first of them
// is exactly the query `L-04` asks every page to include, so counting it would
// let a fixed-width page silence this rule by following the self-check.
const MEDIA_RE = /@media\b([^{]*)\{/gi;
const VIEWPORT_FEATURE_RE = /\b(?:min-|max-)?(?:width|height|aspect-ratio|orientation|resolution)\b|\b(?:any-)?(?:pointer|hover)\b/i;

// Constructs that adapt without a breakpoint.
const INTRINSIC_RE = [
  /@container\b/i,
  /\bminmax\s*\(/i,
  /\bauto-(?:fit|fill)\b/i,
  /\bflex-wrap\s*:\s*wrap(?:-reverse)?\b/i,
  /\bclamp\s*\(/i,
];

// Tailwind writes breakpoints as class prefixes in markup, so a Tailwind
// project can be fully responsive with no `@media` anywhere in its source.
// Only breakpoint and container-query variants count; `hover:` and
// `focus-visible:` are states, not sizes.
const TAILWIND_BREAKPOINT_RE = /(?:^|[\s"'`{])(?:max-)?(?:sm|md|lg|xl|2xl|@(?:xs|sm|md|lg|xl))(?:\/[\w-]+)?:[\w[-]/;

export function isResponsive(source: string, raw: string): boolean {
  MEDIA_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MEDIA_RE.exec(source))) {
    if (VIEWPORT_FEATURE_RE.test(m[1])) return true;
  }
  if (INTRINSIC_RE.some((re) => re.test(source))) return true;
  return TAILWIND_BREAKPOINT_RE.test(raw);
}
