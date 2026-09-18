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
export const PROBE_VERSION = 5;

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
  // Markup order against reading order (H-119). Only a vertical inversion
  // counts: an element that sits entirely ABOVE another on screen while coming
  // after it in the markup. Two columns side by side are not an inversion —
  // putting the sidebar after the main content and moving it left with CSS is
  // the correct pattern, and flagging it would punish the right answer.
  // What to call a region in a report: its own label, else its heading, else
  // nothing. Its whole text content reads as gibberish inside a finding.
  const label = (el) => {
    const aria = (el.getAttribute('aria-label') || '').trim();
    if (aria) return aria;
    const id = el.getAttribute('aria-labelledby');
    const target = id ? document.getElementById(id) : null;
    const heading = target || (/^h[1-6]$/i.test(el.tagName) ? el : el.querySelector('h1, h2, h3, h4, h5, h6'));
    const t = (heading ? heading.textContent : '').replace(/\\s+/g, ' ').trim();
    return t.length > 42 ? t.slice(0, 40).trimEnd() + '\u2026' : t;
  };
  const all = [...document.querySelectorAll('main, nav, aside, header, footer, section, article, h1, h2, h3')].filter(vis);
  // Only the outermost regions. A nested heading inverts with its own parent
  // and with every sibling of it, so one swapped column reported four times.
  const landmarks = all
    .filter((el) => !all.some((other) => other !== el && other.contains(el)))
    .map((el, order) => {
      const r = el.getBoundingClientRect();
      return {
        order,
        tag: el.tagName.toLowerCase(),
        name: label(el),
        top: Math.round(r.top + scrollY),
        bottom: Math.round(r.bottom + scrollY),
      };
    });
  const describe = (l) => '<' + l.tag + '>' + (l.name ? ' \u201c' + l.name + '\u201d' : '');
  const inversions = [];
  for (let i = 0; i < landmarks.length; i++) {
    for (let j = i + 1; j < landmarks.length; j++) {
      const earlier = landmarks[i], later = landmarks[j];
      // The later element sits wholly above the earlier one, past a rounding wobble.
      if (later.bottom - earlier.top <= 8 && later.top < earlier.top) {
        inversions.push({ markupFirst: describe(earlier), seenFirst: describe(later) });
      }
    }
  }
  // What a wide screen exposes: a layout with no upper bound, and the lines it
  // stretches. Measured rather than guessed — a paragraph's own width and font
  // size give its length in characters, which is what B-11 is written about.
  const region = document.querySelector('main') || document.body;
  const prose = [...document.querySelectorAll('p, li, dd, blockquote')].filter(vis)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const size = parseFloat(getComputedStyle(el).fontSize) || 16;
      const text = (el.textContent || '').trim();
      // 0.5em per character is the usual approximation for a text face.
      return { width: Math.round(r.width), chars: Math.round(r.width / (size * 0.5)), text: text.slice(0, 40), long: text.length > 80 };
    })
    .filter((p) => p.long)
    .sort((a, b) => b.chars - a.chars)[0] || null;
  const navLinks = () => [...document.querySelectorAll('nav a, header a, [role=navigation] a')].filter(vis).length;
  // Measured before anything is clicked: what a reader sees on arrival.
  const navAtRest = navLinks();
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
    emDashes: [...new Set((text.match(/[^.!?\\n]{0,28}\u2014[^.!?\\n]{0,28}/g) || []).map((t) => t.trim()))].slice(0, 5),
    brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    navLinksVisible: navAtRest,
    head: {
      title: (document.title || '').trim(),
      description: (document.querySelector('meta[name=description]') || {}).content || '',
      canonical: (document.querySelector('link[rel=canonical]') || {}).href || '',
      robots: (document.querySelector('meta[name=robots]') || {}).content || '',
      ogTitle: (document.querySelector('meta[property="og:title"]') || {}).content || '',
      ogImage: (document.querySelector('meta[property="og:image"]') || {}).content || '',
    },
    contentWidth: Math.round(region.getBoundingClientRect().width),
    contentMaxWidth: getComputedStyle(region).maxWidth,
    longestLine: prose,
    landmarks: landmarks.map(describe),
    orderInversions: inversions.slice(0, 5),
    menu,
  });
})()`;
