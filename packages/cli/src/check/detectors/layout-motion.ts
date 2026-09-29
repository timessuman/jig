import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import { maskProseComments } from './text-scan.js';
import type { Detector, Finding } from '../types.js';

// G-162: animating layout, or everything.
// ❌ transition: height 200ms · transition: all 150ms · a keyframe moving `top` · `transition-all`
// ✅ animate transform and opacity, and name the properties a transition covers
//
// A layout property changes where everything around the element sits, so the
// browser lays the page out again on every frame. `all` animates whatever
// changes, including a layout property someone adds later.
//
// False-positive story: a disclosure growing to its content's height is the
// one accepted case. `grid-template-rows` (0fr to 1fr) is not in the list, so
// that technique is silent; a `height` transition on one is reported, and is
// waived with a reason (`jig-allow G-162`).
const LAYOUT = String.raw`(?:(?:min-|max-)?(?:width|height)|(?:inline|block)-size|top|left|right|bottom|inset(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|padding(?:-[a-z-]+)?)`;
const LAYOUT_NAME = new RegExp(`^${LAYOUT}$`, 'i');
const TRANSITION = /(?<![-\w])transition(-property)?\s*:\s*([^;}]+)/gi;
const KEYFRAMES = /@(?:-webkit-)?keyframes\b[^{]*\{/gi;
const KEYFRAME_DECL = new RegExp(`(?<![-\\w])(${LAYOUT})\\s*:`, 'gi');
const TAILWIND = new RegExp(`(?<![-\\w\\[])transition-(all|\\[[^\\]\\s]*?\\b${LAYOUT}\\b[^\\]\\s]*\\])(?![-\\w])`, 'gi');

/** The properties a `transition` or `transition-property` value names. */
function namedProperties(value: string, longhand: boolean): string[] {
  return value.split(',').map((item) => {
    const words = item.trim().split(/\s+/);
    // The shorthand's property is the word that is not a time, a timing function or a keyword.
    return longhand ? words[0]! : words.find((w) => /^[a-z-]+$/i.test(w) && !/^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|allow-discrete|normal|none)$/i.test(w)) ?? '';
  }).filter(Boolean);
}

/** Where the `@keyframes` block opening at `open` ends. */
function blockEnd(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return i;
  }
  return source.length;
}

export const layoutMotion: Detector = {
  name: 'layout-motion',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const findings: Finding[] = [];
    const seen = new Set<number>();
    const report = (text: string, offset: number, message: string) => {
      const line = lineForOffset(buildLineIndex(text), offset);
      if (seen.has(line)) return;
      seen.add(line);
      findings.push(mkFinding(ctx, 'layout-motion', file, line, message, sourceLine(text, line)));
    };

    for (const m of source.matchAll(TRANSITION)) {
      const names = namedProperties(m[2]!, Boolean(m[1]));
      const bad = names.find((n) => n.toLowerCase() === 'all' || LAYOUT_NAME.test(n));
      if (!bad) continue;
      report(source, m.index!, bad.toLowerCase() === 'all'
        ? 'a transition on `all`: name the properties it covers, and animate transform and opacity'
        : `a transition on \`${bad}\`, which lays the page out again every frame: animate transform or opacity instead`);
    }
    for (const k of source.matchAll(KEYFRAMES)) {
      const open = k.index! + k[0].length - 1;
      const body = source.slice(open, blockEnd(source, open));
      for (const d of body.matchAll(KEYFRAME_DECL)) {
        report(source, open + d.index!, `a keyframe animates \`${d[1]}\`, which lays the page out again every frame: animate transform or opacity instead`);
      }
    }
    const raw = maskProseComments(ctx.raw);
    for (const t of raw.matchAll(TAILWIND)) {
      report(ctx.raw, t.index!, `\`${t[0]}\` animates ${t[1] === 'all' ? 'every property that changes' : 'layout'}: use \`transition\`, \`transition-opacity\` or \`transition-transform\``);
    }
    return findings.sort((a, b) => a.line - b.line);
  },
};
