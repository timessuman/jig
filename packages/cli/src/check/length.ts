/**
 * The one definition of "a length invented at the call site".
 *
 * `00-anti-patterns.md:11` states the scope of the whole file: "**Framework:**
 * agnostic. […] Where a utility-class framework is in use, translate — the rule
 * is about the resulting style, not the syntax." H-47's detector was the exact
 * inverse of that. Two branches decided the same question independently and
 * disagreed:
 *
 *   - the CSS branch matched `px` alone, so `font-size: 0.9em` was silent;
 *   - the Tailwind branch matched ten units, so `text-[0.9em]` was an error.
 *
 * Same value, same computed style, same cascade — a project on plain CSS got a
 * clean `check` for code a project on Tailwind got eight errors for. Found by
 * converting a real stylesheet to utilities without changing one computed
 * value and watching the report go from `No findings` to eight.
 *
 * The exclusions disagreed too, in the other direction: the CSS branch skipped
 * `0`, `1px` and `2px`; the Tailwind branch skipped nothing, so `p-[1px]` was
 * a finding where `padding: 1px` was not.
 *
 * Neither branch may answer this on its own again.
 */

/** Every unit H-47 treats as a design value. */
export const LENGTH_UNITS = [
  'px',
  'rem',
  'em',
  'pt',
  'vh',
  'vw',
  'vmin',
  'vmax',
  'ch',
  'ex',
] as const;

const UNITS = LENGTH_UNITS.join('|');

/** A whole value that is a single length — `0.9em`, `-4px`. Anchored. */
export const LENGTH_RE = new RegExp(`^-?\\d*\\.?\\d+(?:${UNITS})$`, 'i');

/**
 * Lengths anywhere inside a declaration value, so a shorthand carrying several
 * (`margin: 4px 1rem`) is read as the several it is. Global — reset
 * `lastIndex` before each use.
 */
export const LENGTH_SCAN_RE = new RegExp(`(-?\\d*\\.?\\d+)(${UNITS})`, 'gi');

/**
 * Lengths that name no design decision, and so are not H-47 findings.
 *
 * Zero is zero in every unit. `1px` and `2px` are the hairlines and borders
 * Jig has no token for — a stated gap, not an oversight here.
 *
 * The hairline exclusion is deliberately unit-specific rather than a bare
 * number: `1rem` is 16px and `2em` is a real size, so excluding them by
 * magnitude would silence the most common spelling of the defect.
 */
export function isExcludedLength(value: number, unit: string): boolean {
  if (value === 0) return true;
  return unit.toLowerCase() === 'px' && (Math.abs(value) === 1 || Math.abs(value) === 2);
}

/** Does this declaration value carry a length H-47 should flag? */
export function hasHardCodedLength(value: string): boolean {
  LENGTH_SCAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LENGTH_SCAN_RE.exec(value))) {
    if (!isExcludedLength(parseFloat(m[1]), m[2])) return true;
  }
  return false;
}
