import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { isReaderText } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// H-119: a generic element where a native one says what the content is.
//
// Most of this rule is judgment — whether a `div` should have been a list, a
// table or a description list is a question about meaning, and `critique`
// answers it. Two cases are decidable from the source, and both were observed:
// a page with no <main>, and five navigation links inside a <div> with no <nav>
// anywhere in the file.
//
// Read only where a page is actually assembled. A component file holding one
// card has no business declaring <main>, so a file is judged as a page only
// when it carries a <body> (or a full document), which is also what keeps this
// off partial templates, layouts and islands.

const BODY = /<body\b/i;
const MAIN = /<main\b|role\s*=\s*["']main["']/i;
const NAV_ELEMENT = /<nav\b|role\s*=\s*["']navigation["']/i;
// The two places a row of site destinations lives. A page whose only link row
// is in the footer is the observed case: five links, no <nav> anywhere.
const CHROME = /<(header|footer)\b[\s\S]*?<\/\1\s*>/gi;
// A container named as the navigation: class="site-nav", id="main-menu".
const NAV_CONTAINER = /<(div|section|ul|span)\b[^>]*\b(?:class|className|id)\s*=\s*["'][^"']*\b(?:nav|navigation|navbar|menu)\b[^"']*["'][^>]*>/i;
const LINK = /<a\b[^>]*\bhref\b/gi;
// A generic element named as the heading, or styled as one by a utility class.
const HEADING_SHAPED = /<(div|span|p)\b[^>]*\b(?:class|className)\s*=\s*["']([^"']*\b(?:title|heading|headline|text-(?:2xl|3xl|4xl|5xl))\b[^"']*)["'][^>]*>([\s\S]{0,120}?)<\/\1\s*>/gi;
const HEADING_INSIDE = /<h[1-6]\b/i;
// The same element, with the same class, three times over: a set.
const REPEATED = /<(div|article|section|a)\b[^>]*\b(?:class|className)\s*=\s*["']([^"']+)["']/gi;
const LIST_OR_TABLE = /<(ul|ol|dl|table|tbody|menu)\b/i;

export const semanticElement: Detector = {
  name: 'semantic-element',
  appliesTo: (file) => isReaderText(file),
  run(_source, file, ctx) {
    const raw = ctx.raw;
    if (!BODY.test(raw)) return [];
    const starts = buildLineIndex(raw);
    const findings: Finding[] = [];
    const at = (offset: number, message: string) => {
      const line = lineForOffset(starts, offset);
      findings.push(mkFinding(ctx, 'semantic-element', file, line, message, sourceLine(raw, line)));
    };

    if (!MAIN.test(raw)) {
      at(BODY.exec(raw)!.index,
        'this page has no <main> — nothing tells a reader skipping the chrome where the page itself starts');
    }

    if (!NAV_ELEMENT.test(raw)) {
      const container = NAV_CONTAINER.exec(raw);
      const links = (raw.match(LINK) ?? []).length;
      if (container && links >= 3) {
        at(container.index, 'navigation links in a generic container, with no <nav> on the page — the element is what makes it a landmark, not the class name');
      } else {
        for (const region of raw.matchAll(CHROME)) {
          if ((region[0].match(LINK) ?? []).length < 3) continue;
          at(region.index!, `the ${region[1]!.toLowerCase()} holds a row of links and the page has no <nav> — a set of destinations is a navigation landmark, and the element is what makes it one`);
          break;
        }
      }
    }

    for (const m of raw.matchAll(HEADING_SHAPED)) {
      if (HEADING_INSIDE.test(m[3]!)) continue;
      const text = m[3]!.replace(/<[^>]*>/g, '').trim();
      if (!text || text.length > 80) continue;
      at(m.index!, `"${text.slice(0, 40)}" is a ${m[1]!.toLowerCase()} named and styled as a heading — if it is the heading, it is an h1-h6, and CSS gives it the size`);
    }

    // Three or more of the same element with the same class, with no list or
    // table element anywhere on the page: a repeated set whose markup does not
    // say it is one. Only reported once per file; which element it should be —
    // ul, ol, dl or table — is the review's call, and the rule says so.
    if (!LIST_OR_TABLE.test(raw)) {
      const counts = new Map<string, { n: number; index: number }>();
      for (const m of raw.matchAll(REPEATED)) {
        const key = `${m[1]!.toLowerCase()}.${m[2]!.trim()}`;
        const seen = counts.get(key) ?? { n: 0, index: m.index! };
        counts.set(key, { n: seen.n + 1, index: seen.index });
      }
      const repeated = [...counts.entries()].filter(([, v]) => v.n >= 3).sort((a, b) => a[1].index - b[1].index)[0];
      if (repeated) {
        at(repeated[1].index, `${repeated[1].n} sibling ${repeated[0]} elements are a repeated set, and nothing on this page is a list or a table — decide which collection this is (ul, ol, dl, table) before using a generic container`);
      }
    }

    return findings;
  },
};
