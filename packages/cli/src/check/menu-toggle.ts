/**
 * Whether the project's navigation carries an open state a reader and a screen
 * reader can both see — `aria-expanded` on the menu control, or a `<details>`
 * disclosure inside the navigation. See `E-116` and `P-14`.
 *
 * A project fact, for the same reason as `projectResponsive`: the rule that hides
 * the links lives in a stylesheet, and the button that would show them again
 * lives in markup or a component — routinely a different file.
 *
 * Deliberately narrow. A `<details>` in an FAQ or an `aria-expanded` on an
 * accordion says nothing about the menu, so only markup inside `<nav>` or
 * `<header>`, or a control whose own tag names a menu or the navigation, counts.
 * A script that sets `aria-expanded` counts too, since that is how a hand-rolled
 * toggle records its state.
 */
const NAV_REGION_RE = /<(nav|header)\b[\s\S]*?<\/\1\s*>/gi;
const STATE_RE = /\baria-expanded\b|<details\b/i;
const EXPANDED_TAG_RE = /<[a-z][\w-]*\b[^>]*\baria-expanded\b[^>]*>/gi;
const NAMES_MENU_RE = /menu|nav/i;
const SCRIPT_STATE_RE = /setAttribute\(\s*['"]aria-expanded['"]|\.ariaExpanded\s*=/;

export function hasMenuToggle(raw: string): boolean {
  for (const region of raw.match(NAV_REGION_RE) ?? []) {
    if (STATE_RE.test(region)) return true;
  }
  for (const tag of raw.match(EXPANDED_TAG_RE) ?? []) {
    if (NAMES_MENU_RE.test(tag.replace(/\baria-expanded\b/i, ''))) return true;
  }
  return SCRIPT_STATE_RE.test(raw);
}
