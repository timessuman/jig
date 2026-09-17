import { buildLineIndex, leafBlocks, lineForOffset, lineOfOffset, sourceLine } from '../css.js';
import { isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// E-116: the navigation is hidden at some width, and nothing can open it.
// ❌ @media (max-width: 767px) { .nav-links { display: none } } — and a Menu
//    button with no aria-expanded, or no button at all
// ✅ a <button aria-expanded> that shows the links and records it, or
//    <details><summary>Menu</summary> in the navigation
//
// A hidden nav with no recorded open state is either unreachable — the reader
// on a phone has no way to the other pages — or opens silently, so a screen
// reader hears "Menu, button" and never learns whether anything happened. Both
// arm-test pages that shipped a dead Menu button looked finished in a
// screenshot. Whether the button actually opens the menu is `critique`'s to
// operate on a render (`P-14`); this catches the case source can prove.
//
// Selectors: some compound must name the navigation (`nav ul`, `.nav-links`,
// `.menu`, `#site-nav`). A submenu or dropdown hidden until hover — named so,
// or a list nested inside a list item — is a different control and is skipped. `projectMenuToggle` undefined means never computed —
// silent.

const HIDDEN_RE = /(?<![-\w])display\s*:\s*none\b/i;
const NAV_SELECTOR_RE = /(?:^|[\s>+~.#])(?:nav|[\w-]*(?:nav|navigation|menu)[\w-]*)(?:$|[\s.#:[>+~])/i;
// The control that opens the menu is hidden at wide widths by design; it is not
// the navigation.
const SKIP_RE = /sub-?menu|dropdown|flyout|mega|button|btn|toggle|trigger|burger|icon/i;

const NESTED_LIST_RE = /\bli\b[^,]*\b(?:ul|ol)\b/i;

/** Each selector in the list that hides the navigation itself. */
function navSelectors(selectorList: string): string[] {
  return selectorList
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !SKIP_RE.test(s) && !NESTED_LIST_RE.test(s) && !/:hover|:focus/i.test(s))
    .filter((s) => s.split(/\s+|>|\+|~/).some((c) => NAV_SELECTOR_RE.test(c)));
}

// A button named as the menu control, in markup. Arm test 3 shipped
// `<button aria-label="menu" aria-expanded="false">menu</button>` with no nav
// links and no handler: nothing was hidden, so the stylesheet case above never
// saw it.
const MENU_BUTTON_RE = /<button\b([^>]*)>([\s\S]{0,200}?)<\/button>/gi;
const MENU_NAME_RE = /^\s*(?:open |toggle |show )?(?:the )?(?:site |main )?(?:menu|navigation|nav)\s*$/i;

function deadMenuButtons(raw: string): number[] {
  const offsets: number[] = [];
  for (const m of raw.matchAll(MENU_BUTTON_RE)) {
    const label = /\baria-label\s*=\s*["']([^"']*)["']/i.exec(m[1]!)?.[1];
    const text = m[2]!.replace(/<[^>]*>/g, '').trim();
    if (MENU_NAME_RE.test(label ?? '') || MENU_NAME_RE.test(text)) offsets.push(m.index!);
  }
  return offsets;
}

export const menuState: Detector = {
  name: 'menu-state',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    if (ctx.projectMenuToggle !== false) return [];
    const findings: Finding[] = [];
    if (/\.(html?|vue|svelte|astro|jsx|tsx|php|erb|twig|hbs)$/i.test(file)) {
      const starts = buildLineIndex(ctx.raw);
      for (const offset of deadMenuButtons(ctx.raw)) {
        const line = lineForOffset(starts, offset);
        findings.push(
          mkFinding(ctx, 'menu-state', file, line,
            'a Menu button that nothing opens — no script or binding ever changes aria-expanded, and no <details>',
            sourceLine(ctx.raw, line)),
        );
      }
    }
    for (const block of leafBlocks(source)) {
      const hidden = HIDDEN_RE.exec(block.body);
      if (!hidden) continue;
      const names = navSelectors(block.selector.replace(/^[\s\S]*[;}]/, ''));
      if (names.length === 0) continue;
      const line = lineOfOffset(block, hidden.index);
      findings.push(
        mkFinding(ctx, 'menu-state', file, line,
          `${names[0]} is hidden, and nothing in the project opens it with aria-expanded or <details>`,
          sourceLine(source, line)),
      );
    }
    return findings;
  },
};
