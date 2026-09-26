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
export const PROBE_VERSION = 7;

export const PROBE_SCRIPT = `(async () => {
  const doc = document.documentElement;
  // checkVisibility also sees content a closed <details> hides: Chromium hides
  // it with content-visibility, which still gives its links real boxes, so a
  // closed menu counted as open and an opened one showed "no more links".
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && (!e.checkVisibility || e.checkVisibility()); };
  const probe = document.createElement('div');
  probe.style.all = 'initial';
  document.body.appendChild(probe);
  const defaultFont = getComputedStyle(probe).fontFamily;
  probe.remove();
  const text = document.body.innerText || '';
  // I-118: a verbatim quotation keeps its own punctuation. Text marked as a
  // quotation is the source's words, so it is taken out before the dash scan;
  // the page's own copy around it still counts.
  let ownText = text;
  for (const q of document.querySelectorAll('blockquote, q')) {
    const quoted = (q.innerText || '').trim();
    if (quoted) ownText = ownText.split(quoted).join('\\n');
  }
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
  // B-106 in every browser. \`text-wrap: pretty\` moves a lone last word up in
  // Chromium and does nothing in Firefox or in Safari before 26, so the page is
  // also measured as those lay it out: wrap forced plain, and the last word of
  // each block compared with the word before it. jig-site's Versions page was
  // clean in this browser and stranded "back." on an iPhone.
  const plainWrap = document.createElement('style');
  plainWrap.textContent = '*{text-wrap:wrap !important}';
  document.head.appendChild(plainWrap);
  const stranded = [];
  for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,dd,dt,figcaption,blockquote,td,th,caption,summary')) {
    if (!vis(el) || el.closest('pre, script, style, [aria-hidden="true"]')) continue;
    if (el.querySelector('p,li,dd,dt,blockquote,h1,h2,h3,h4,h5,h6')) continue;
    const words = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const m of n.data.matchAll(/\\S+/g)) words.push([n, m.index, m.index + m[0].length, m[0]]);
    }
    if (words.length < 3) continue;
    const top = (w) => { const r = document.createRange(); r.setStart(w[0], w[1]); r.setEnd(w[0], w[2]); const rs = r.getClientRects(); return rs.length ? rs[rs.length - 1].top : null; };
    const last = words[words.length - 1];
    const a = top(words[words.length - 2]), b = top(last);
    if (/[\\p{L}\\p{N}]/u.test(last[3]) && a !== null && b !== null && b - a > 2) {
      stranded.push({ word: last[3], text: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40) });
    }
  }
  plainWrap.remove();
  // The menu control: inside the header or navigation, or named as the menu.
  // Not any disclosure — an FAQ <summary> is not a menu.
  // The site's navigation, not a page's own: a <nav> inside <main>, an
  // <article> or an <aside> is in-page navigation (a section list, a table of
  // contents), and its <summary> is a disclosure the reader opens, not the menu.
  // A rule page's "More in this section" list was judged a broken menu this way.
  const inChrome = (b) => !!b.closest('header, [role=banner]') ||
    (!!b.closest('nav, [role=navigation]') && !b.closest('main, article, aside, [role=main]'));
  const named = (b) => /\b(menu|navigation)\b/i.test((b.getAttribute('aria-label') || '') + ' ' + b.textContent);
  const candidates = [...document.querySelectorAll('button, summary, [role=button]')].filter((b) =>
    named(b) || (inChrome(b) && (b.tagName === 'SUMMARY' || b.hasAttribute('aria-expanded') || b.hasAttribute('aria-controls'))));
  // A menu the page names, or one in its banner, is the menu. Where it exists
  // but is hidden at this width, the links show instead and there is no menu
  // here; the next disclosure in some other <nav> (a docs rail's tree) is not
  // a stand-in for it.
  const primary = (b) => named(b) || !!b.closest('header, [role=banner]');
  const pool = candidates.some(primary) ? candidates.filter(primary) : candidates;
  const toggle = pool.find(vis);
  let menu = null;
  if (toggle) {
    // The label as rendered: a menu that swaps "Menu" for "Close" with CSS keeps
    // both words in its textContent at all times, so only innerText sees the swap.
    const name = () => ((toggle.getAttribute('aria-label') || '') + ' ' + (toggle.innerText || toggle.textContent || '')).replace(/\\s+/g, ' ').trim();
    // A native <summary> carries no aria-expanded attribute; the browser exposes
    // its <details>'s open state as the expanded state, which is what counts.
    const expanded = () => toggle.getAttribute('aria-expanded') ??
      (toggle.tagName === 'SUMMARY' && toggle.parentElement && toggle.parentElement.tagName === 'DETAILS' ? String(toggle.parentElement.open) : null);
    // Opening is judged by what becomes visible anywhere: a menu panel is often
    // a sibling of the header, not inside it (arm test 3, tw-1).
    const allLinks = () => [...document.querySelectorAll('a')].filter(vis).length;
    const controlled = () => { const id = toggle.getAttribute('aria-controls'); const el = id && document.getElementById(id); return el ? vis(el) : null; };
    const before = { links: allLinks(), controlled: controlled(), expanded: expanded(), name: name(), html: toggle.innerHTML };
    toggle.click();
    await new Promise((r) => setTimeout(r, 350));
    const after = { links: allLinks(), controlled: controlled(), expanded: expanded(), name: name(), htmlChanged: toggle.innerHTML !== before.html };
    toggle.focus();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    menu = {
      linksBefore: before.links, linksAfter: after.links,
      expandedBefore: before.expanded, expandedAfter: after.expanded,
      opened: after.links > before.links || (before.controlled === false && after.controlled === true),
      labelChanged: after.name !== before.name || after.htmlChanged,
      escapeCloses: expanded() !== 'true' && allLinks() <= before.links,
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
    emDashes: [...new Set((ownText.match(/[^.!?\\n]{0,28}\u2014[^.!?\\n]{0,28}/g) || []).map((t) => t.trim()))].slice(0, 5),
    brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    navLinksVisible: navAtRest,
    strandedCount: stranded.length,
    strandedWords: stranded.slice(0, 6),
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
