/**
 * The render probe: one script the critique's screen arm runs inside whatever
 * browser it has, at each width, and saves as `.jig/critique/<surface>/probe-<width>.json`.
 *
 * Why: in arm test 3 a screen arm returned 31 verdicts with 31 distinct reasons,
 * passed `jig verdicts`, and called the page production-ready — while the page
 * rendered in the default serif, its menu links spilled over the plans, and its
 * menu verdict read "ok, opens and closes". A reason is prose; prose can say
 * anything. The probe records what the browser measured, and `jig verdicts`
 * refuses a verdict the measurement contradicts.
 *
 * What it cannot do: prove it was run. An agent could write the JSON by hand.
 * It raises the cost of a false verdict from one adjective to a fabricated
 * measurement, which is the failure actually observed.
 *
 * Kept as a single expression that evaluates to a Promise of a JSON string, so
 * `browse js "<script>"`, Playwright's `page.evaluate(script)` and a devtools
 * console all run it unchanged.
 */
export const PROBE_VERSION = 1;

export const PROBE_SCRIPT = `(async () => {
  const doc = document.documentElement;
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const probe = document.createElement('div');
  probe.style.all = 'initial';
  document.body.appendChild(probe);
  const defaultFont = getComputedStyle(probe).fontFamily;
  probe.remove();
  const text = document.body.innerText || '';
  const junk = [...new Set(text.match(/\\$\\{|\\{\\{|\\bundefined\\b|\\bNaN\\b|\\[object Object\\]/g) || [])];
  const unresolved = new Set();
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const rule of rules) {
      for (const m of (rule.cssText || '').matchAll(/var\\(\\s*(--[\\w-]+)\\s*\\)/g)) {
        if (!getComputedStyle(doc).getPropertyValue(m[1]).trim()) unresolved.add(m[1]);
      }
    }
  }
  const navLinks = () => [...document.querySelectorAll('nav a, header a, [role=navigation] a')].filter(vis).length;
  // The menu control: inside the header or navigation, or named as the menu.
  // Not any disclosure — an FAQ <summary> is not a menu.
  const inChrome = (b) => !!b.closest('header, nav, [role=navigation], [role=banner]');
  const named = (b) => /\b(menu|navigation)\b/i.test((b.getAttribute('aria-label') || '') + ' ' + b.textContent);
  const toggle = [...document.querySelectorAll('button, summary, [role=button]')].find((b) => vis(b) &&
    (named(b) || (inChrome(b) && (b.tagName === 'SUMMARY' || b.hasAttribute('aria-expanded') || b.hasAttribute('aria-controls')))));
  let menu = null;
  if (toggle) {
    const name = () => ((toggle.getAttribute('aria-label') || '') + ' ' + (toggle.textContent || '')).replace(/\\s+/g, ' ').trim();
    // Opening is judged by what becomes visible anywhere: a menu panel is often
    // a sibling of the header, not inside it (arm test 3, tw-1).
    const allLinks = () => [...document.querySelectorAll('a')].filter(vis).length;
    const controlled = () => { const id = toggle.getAttribute('aria-controls'); const el = id && document.getElementById(id); return el ? vis(el) : null; };
    const before = { links: allLinks(), controlled: controlled(), expanded: toggle.getAttribute('aria-expanded'), name: name(), html: toggle.innerHTML };
    toggle.click();
    await new Promise((r) => setTimeout(r, 350));
    const after = { links: allLinks(), controlled: controlled(), expanded: toggle.getAttribute('aria-expanded'), name: name(), htmlChanged: toggle.innerHTML !== before.html };
    toggle.focus();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    menu = {
      linksBefore: before.links, linksAfter: after.links,
      expandedBefore: before.expanded, expandedAfter: after.expanded,
      opened: after.links > before.links || (before.controlled === false && after.controlled === true),
      labelChanged: after.name !== before.name || after.htmlChanged,
      escapeCloses: toggle.getAttribute('aria-expanded') !== 'true' && allLinks() <= before.links,
      focusReturned: document.activeElement === toggle,
    };
  }
  return JSON.stringify({
    jigProbe: ${PROBE_VERSION},
    url: location.href,
    width: innerWidth,
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    sidewaysScroll: doc.scrollWidth > doc.clientWidth,
    bodyFont: getComputedStyle(document.body).fontFamily,
    defaultFont: getComputedStyle(document.body).fontFamily === defaultFont,
    unresolvedTokens: [...unresolved],
    junkText: junk,
    brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    navLinksVisible: navLinks(),
    menu,
  });
})()`;
