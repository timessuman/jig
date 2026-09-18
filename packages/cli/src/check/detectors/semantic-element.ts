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

    return findings;
  },
};
