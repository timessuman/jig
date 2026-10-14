import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { isReaderText } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// E-165: a link that opens a new tab and never says so.
// ❌ <a href="https://…" target="_blank" rel="noopener">GitHub</a>
// ✅ the same tab; or, where leaving would lose something, a link whose
//    accessible name says "(opens in a new tab)"
//
// Whether a new tab is justified (a task the reader would lose) is a judgment
// on the page. What a file can settle is the half that is never justified: a
// new tab nobody is told about. The name is read from the link's text, its
// aria-label and its title. A link whose text is an expression (`{label}`) is
// left alone, since its words are not in the file.

const BLANK_LINK = /<a\b([^>]*\btarget\s*=\s*\{?\s*["'`]?_blank["'`]?\s*\}?[^>]*)>([\s\S]*?)<\/a\s*>/gi;
const SAYS_SO = /new\s+(?:tab|window)|opens?\s+in\s+a\s+new/i;
const ATTR = /\b(?:aria-label|title)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

export const newTabLink: Detector = {
  name: 'new-tab-link',
  appliesTo: (file) => isReaderText(file),
  run(_source, file, ctx) {
    const raw = ctx.raw;
    const starts = buildLineIndex(raw);
    const findings: Finding[] = [];
    for (const m of raw.matchAll(BLANK_LINK)) {
      const attrs = m[1]!;
      const inner = m[2]!;
      const named = [...attrs.matchAll(ATTR)].map((a) => a[1] ?? a[2] ?? '').join(' ');
      if (SAYS_SO.test(named) || SAYS_SO.test(inner)) continue;
      // An expression in the text, or a spread of props, may say it; the file cannot tell.
      if (/\{[^}]*\}/.test(inner.replace(/<[^>]*>/g, '')) || /\{\s*\.\.\./.test(attrs)) continue;
      const text = inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
      const line = lineForOffset(starts, m.index!);
      findings.push(
        mkFinding(ctx, 'new-tab-link', file, line,
          `"${text || 'a link'}" opens a new tab and does not say so: keep it in the same tab, or, where leaving would lose the reader's work, add "(opens in a new tab)" to its accessible name`,
          sourceLine(raw, line)),
      );
    }
    return findings;
  },
};
