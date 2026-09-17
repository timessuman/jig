import { describe, it, expect } from 'vitest';
import { menuState } from '../src/check/detectors/menu-state.js';
import { hasMenuToggle } from '../src/check/menu-toggle.js';
import type { DetectorContext } from '../src/check/types.js';

const ctx = (projectMenuToggle: boolean | undefined): DetectorContext =>
  ({ ruleId: 'E-116', bucket: 'mechanical', severity: 'warning', tokens: {}, projectParticipates: false, raw: '', projectMenuToggle });

const hiddenNarrow = `.nav-links { display: flex; gap: 1rem; }
@media (max-width: 767px) {
  .nav-links {
    display: none;
  }
}`;

const hiddenBaseShownWide = `nav ul {
  display: none;
}
@media (min-width: 768px) {
  nav ul { display: flex; }
}`;

describe('hasMenuToggle — does the navigation carry an open state', () => {
  it('finds aria-expanded in the navigation when something changes it', () => {
    const button = '<header><button aria-expanded="false" aria-controls="m">Menu</button></header>';
    expect(hasMenuToggle(`${button}<script>b.setAttribute("aria-expanded", "true")</script>`)).toBe(true);
    expect(hasMenuToggle('<header><button aria-expanded={open}>Menu</button></header>')).toBe(true);
    expect(hasMenuToggle('<header><button :aria-expanded="open">Menu</button></header>')).toBe(true);
  });

  // Arm test 3: a dead Menu button with a static attribute silenced E-116.
  it('does not count a static aria-expanded that nothing changes', () => {
    expect(hasMenuToggle('<header><button class="nav-button" aria-label="menu" aria-expanded="false">menu</button></header>')).toBe(false);
  });
  it('finds a <details> disclosure inside the navigation', () => {
    expect(hasMenuToggle('<nav><details><summary>Menu</summary><a href="/">x</a></details></nav>')).toBe(true);
  });
  it('finds aria-expanded set from script', () => {
    expect(hasMenuToggle(`btn.setAttribute('aria-expanded', String(open))`)).toBe(true);
  });
  // A disclosure elsewhere on the page says nothing about the menu.
  it('ignores a <details> or aria-expanded outside the navigation markup', () => {
    expect(hasMenuToggle('<section class="faq"><details><summary>q</summary></details></section>')).toBe(false);
    expect(hasMenuToggle('<header><button class="menu">Menu</button></header>')).toBe(false);
  });
});

describe('menu-state (E-116)', () => {
  it('fires when nav links are hidden at a narrow width and nothing records open state', () => {
    const f = menuState.run(hiddenNarrow, 'pricing.css', ctx(false));
    expect(f).toHaveLength(1);
    expect(f[0].ruleId).toBe('E-116');
  });

  it('fires on the mobile-first form: hidden by default, shown at a min-width', () => {
    expect(menuState.run(hiddenBaseShownWide, 'a.css', ctx(false))).toHaveLength(1);
  });

  it('does not fire when the project has a menu that records its state', () => {
    expect(menuState.run(hiddenNarrow, 'a.css', ctx(true))).toHaveLength(0);
  });

  it('does not fire when the nav is never hidden', () => {
    expect(menuState.run('.nav-links { display: flex; flex-wrap: wrap; }', 'a.css', ctx(false))).toHaveLength(0);
  });

  it('does not fire on a hidden element that is not navigation', () => {
    expect(menuState.run('@media (max-width: 600px) { .promo { display: none; } }', 'a.css', ctx(false))).toHaveLength(0);
  });

  it('stays silent when the project fact was never computed', () => {
    expect(menuState.run(hiddenNarrow, 'a.css', ctx(undefined))).toHaveLength(0);
  });
});

describe('menu-state (E-116) — controls that are not the menu', () => {
  it('skips a dropdown nested in a nav item', () => {
    expect(menuState.run('nav li ul { display: none; } nav li:hover ul { display: block; }', 'a.css', ctx(false))).toHaveLength(0);
    expect(menuState.run('.nav .submenu { display: none; }', 'a.css', ctx(false))).toHaveLength(0);
  });
});

describe('menu-state (E-116) — the toggle itself', () => {
  // Every arm-test page hid its Menu button above phone width. That is the
  // button, not the navigation, and reporting it doubled every finding.
  it('skips the menu button hidden at wide widths', () => {
    expect(menuState.run('@media (min-width: 768px) { .menu-button { display: none; } .nav-toggle { display: none; } }', 'a.css', ctx(false))).toHaveLength(0);
  });
});

describe('menu-state (E-116) — a Menu button in markup that nothing opens', () => {
  const page = '<header>\n  <div class="logo">Hoistline</div>\n  <button class="nav-button" aria-label="menu" aria-expanded="false">menu</button>\n</header>';
  const inHtml = (raw: string, toggle: boolean | undefined) => menuState.run('', 'pricing.html', { ...ctx(toggle), raw });

  it('fires on the arm-test-3 button, on its line', () => {
    const f = inHtml(page, false);
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(3);
  });

  it('does not fire when the project changes its state, or on other buttons', () => {
    expect(inHtml(page, true)).toHaveLength(0);
    expect(inHtml('<button>Sign up</button><button aria-label="Close">x</button>', false)).toHaveLength(0);
  });
});
