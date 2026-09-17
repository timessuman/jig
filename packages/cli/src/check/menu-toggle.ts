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
const DETAILS_RE = /<details\b/i;
// `aria-expanded` whose value is bound to state by a framework: JSX
// `aria-expanded={open}`, Vue/Alpine `:aria-expanded`, Angular
// `[attr.aria-expanded]`, Svelte/Handlebars/Blade `aria-expanded="{...}"`.
const BOUND_RE = /(?::|x-bind:|\[attr\.)aria-expanded\b|\baria-expanded\s*=\s*(?:\{|["'][^"']*[{$@])/i;
const EXPANDED_TAG_RE = /<[a-z][\w-]*\b[^>]*\baria-expanded\b[^>]*>/gi;
const NAMES_MENU_RE = /menu|nav/i;
const SCRIPT_STATE_RE = /setAttribute\(\s*['"`]aria-expanded['"`]|toggleAttribute\(\s*['"`]aria-expanded|\.ariaExpanded\s*=|dataset\.expanded|\[['"]aria-expanded['"]\]\s*=/;

/**
 * Whether the navigation's open state is recorded AND changes.
 *
 * A static `aria-expanded="false"` is not a toggle. In arm test 3 a phone menu
 * button carried exactly that, with no handler anywhere, and silenced this
 * check while the menu could not be opened. So the attribute counts only when
 * something changes it: a script that sets it, or a framework binding. A
 * `<details>` disclosure changes itself.
 */
export function hasMenuToggle(raw: string): boolean {
  const scripted = SCRIPT_STATE_RE.test(raw);
  for (const region of raw.match(NAV_REGION_RE) ?? []) {
    if (DETAILS_RE.test(region)) return true;
    if (/\baria-expanded\b/i.test(region) && (scripted || BOUND_RE.test(region))) return true;
  }
  for (const tag of raw.match(EXPANDED_TAG_RE) ?? []) {
    if (!NAMES_MENU_RE.test(tag.replace(/\baria-expanded\b/i, ''))) continue;
    if (scripted || BOUND_RE.test(tag)) return true;
  }
  return scripted;
}
