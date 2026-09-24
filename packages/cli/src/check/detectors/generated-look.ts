import { buildLineIndex, leafBlocks, lineForOffset, lineOfOffset, sourceLine, type CssBlock } from '../css.js';
import { extractColorComponents } from '../color.js';
import { isReaderText, isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import { isMarkupHost } from '../styles.js';
import { classAttributeValues } from '../tailwind.js';
import type { Detector, DetectorContext, Finding } from '../types.js';

// The generated-page tells of A-135 to A-146 and G-145, where the source says
// enough to decide. Each is a warning: the rule's own correction allows the
// shape where it means something (a stripe that marks the current item, a
// numbered procedure), which only a reader can see, and `jig-allow` waives
// the one that is right.
//
// Every detector reads both halves of a modern codebase: the CSS (`source`,
// masked to style regions) and the utility classes in markup (`ctx.raw`),
// because a Tailwind page carries all of its style in class attributes that
// masking removes.

type Hit = { line: number; message: string };

function report(ctx: DetectorContext, name: string, file: string, raw: string, hits: Hit[]): Finding[] {
  const seen = new Set<number>();
  return hits
    .filter((h) => (seen.has(h.line) ? false : (seen.add(h.line), true)))
    .map((h) => mkFinding(ctx, name, file, h.line, h.message, sourceLine(raw, h.line)))
    .sort((a, b) => a.line - b.line);
}

function classLists(file: string, raw: string): Array<{ classes: string[]; line: number }> {
  if (!isMarkupHost(file)) return [];
  return classAttributeValues(raw).map((a) => ({ classes: a.classes.split(/\s+/).filter(Boolean), line: a.line }));
}

/** A class list's utilities without their variants: `md:hover:border-l-4` → `border-l-4`. */
const bare = (c: string) => c.replace(/^(?:[\w-]+:)+/, '').replace(/^!/, '');

const px = (v: string): number | undefined => {
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(v.trim());
  if (!m) return undefined;
  const n = parseFloat(m[1]!);
  return m[2] === 'rem' || m[2] === 'em' ? n * 16 : n;
};

/** Tailwind's default border widths: `border-l` 1, `-2` 2, `-4` 4, `-8` 8, `-[3px]`. */
function twBorderWidth(suffix: string | undefined): number {
  if (!suffix) return 1;
  const arb = /^\[(.+)\]$/.exec(suffix);
  if (arb) return px(arb[1]!) ?? 0;
  return Number(suffix) || 0;
}

const TW_COLOUR = /^(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/;

function saturated(value: string, tokens: Record<string, string>, minS = 25, minAlpha = 0.2): boolean {
  const c = extractColorComponents(value.trim(), tokens);
  return !!c && c.alpha >= minAlpha && c.hsl.s >= minS && c.hsl.l > 8 && c.hsl.l < 92;
}

/** The colour word(s) in a border shorthand: `3px solid #2563eb` → `#2563eb`. */
function colourIn(value: string): string {
  return value.replace(/\b\d*\.?\d+(px|rem|em)\b/g, ' ')
    .replace(/\b(solid|dashed|dotted|double|groove|ridge|inset|outset|none|hidden)\b/gi, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// A-139 a side-tab accent border
// ---------------------------------------------------------------------------

const SIDE_DECL = /(?<![-\w])border-(left|inline-start|right|inline-end)(?:-width)?\s*:\s*([^;}]+)/gi;
const OTHER_SIDE_WIDE = /(?<![-\w])border(?:-(?:top|bottom))?(?:-width)?\s*:\s*(\d*\.?\d+)px/gi;

export const sideTabBorder: Detector = {
  name: 'side-tab-border',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const hits: Hit[] = [];
    for (const block of leafBlocks(source)) {
      // A quotation's rule is the one conventional side stripe.
      if (/\bblockquote\b|\bq\b/.test(block.selector)) continue;
      SIDE_DECL.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SIDE_DECL.exec(block.body))) {
        const width = Math.max(0, ...[...m[2]!.matchAll(/(\d*\.?\d+)(px|rem)/g)].map((w) => px(w[0]) ?? 0));
        if (width < 3) continue;
        const colour = colourIn(m[2]!);
        const colourDecl = new RegExp(`border-${m[1]}-color\\s*:\\s*([^;}]+)`, 'i').exec(block.body)?.[1] ?? colour;
        if (colourDecl && !saturated(colourDecl, ctx.tokens) && !/var\(--color-(?:brand|text-brand|stroke-brand|accent)/.test(colourDecl)) continue;
        OTHER_SIDE_WIDE.lastIndex = 0;
        if ([...block.body.matchAll(OTHER_SIDE_WIDE)].some((o) => parseFloat(o[1]!) >= width)) continue;
        hits.push({ line: lineOfOffset(block, m.index), message: `a ${width}px coloured stripe on one side of ${block.selector.trim()}: the shape of an alert on something that is not one` });
      }
    }
    for (const { classes, line } of classLists(file, ctx.raw)) {
      const plain = classes.map(bare);
      const side = plain.map((c) => /^border-(l|s|r|e)(?:-(\d+|\[[^\]]+\]))?$/.exec(c)).find((x) => x && twBorderWidth(x[2]) >= 3);
      if (!side) continue;
      const colour = plain.find((c) => new RegExp(`^border-(?:${side[1]}-)?(.+)$`).test(c) && TW_COLOUR.test(c.replace(/^border-(?:[lsre]-)?/, '')));
      if (!colour) continue;
      if (plain.some((c) => /^border-(?:\d+|\[[^\]]+\])$/.test(c))) continue;
      hits.push({ line, message: `\`${side[0]}\` with \`${colour}\`: a coloured stripe on one side, the shape of an alert on something that is not one` });
    }
    return report(ctx, 'side-tab-border', file, ctx.raw, hits);
  },
};

// ---------------------------------------------------------------------------
// A-140 a thick coloured border on a rounded element
// ---------------------------------------------------------------------------

const BORDER_ALL = /(?<![-\w])border(?:-width)?\s*:\s*([^;}]+)/i;
const RADIUS = /(?<![-\w])border-radius\s*:\s*([^;}]+)/i;

export const roundedAccentBorder: Detector = {
  name: 'rounded-accent-border',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const hits: Hit[] = [];
    for (const block of leafBlocks(source)) {
      const border = BORDER_ALL.exec(block.body);
      const radius = RADIUS.exec(block.body);
      if (!border || !radius) continue;
      const width = Math.max(0, ...[...border[1]!.matchAll(/(\d*\.?\d+)px/g)].map((w) => parseFloat(w[1]!)));
      const r = /%|9999|999px/.test(radius[1]!) ? 999 : Math.max(0, ...[...radius[1]!.matchAll(/(\d*\.?\d+)(px|rem)/g)].map((w) => px(w[0]) ?? 0));
      if (width < 2 || r < 12) continue;
      const colour = /border-color\s*:\s*([^;}]+)/i.exec(block.body)?.[1] ?? colourIn(border[1]!);
      if (!saturated(colour, ctx.tokens)) continue;
      hits.push({ line: lineOfOffset(block, border.index), message: `a ${width}px coloured border on a ${r >= 999 ? 'fully' : `${r}px`} rounded element: the outline becomes the most visible shape in it` });
    }
    for (const { classes, line } of classLists(file, ctx.raw)) {
      const plain = classes.map(bare);
      const width = plain.map((c) => /^border-(\d+|\[[^\]]+\])$/.exec(c)).find((x) => x && twBorderWidth(x[1]) >= 2);
      const colour = plain.find((c) => /^border-/.test(c) && TW_COLOUR.test(c.slice('border-'.length)));
      const round = plain.find((c) => /^rounded-(?:xl|2xl|3xl|full|\[(?:1[2-9]|[2-9]\d|\d{3,})px\])$/.test(c));
      if (width && colour && round) hits.push({ line, message: `\`${width[0]} ${colour} ${round}\`: a heavy coloured outline on a large curve` });
    }
    return report(ctx, 'rounded-accent-border', file, ctx.raw, hits);
  },
};

// ---------------------------------------------------------------------------
// A-143 a decorative grid or stripe background
// ---------------------------------------------------------------------------

const BG_IMAGE = /(?<![-\w])background(?:-image)?\s*:\s*([^;}]+)/i;

function gridLike(value: string, block: CssBlock | undefined, sizeHint: boolean): boolean {
  if (/repeating-(?:linear|radial)-gradient\(/i.test(value)) return true;
  const linear = (value.match(/linear-gradient\(/gi) ?? []).length;
  const radial = (value.match(/radial-gradient\(/gi) ?? []).length;
  const lines = /\b1px\b|transparent\s+1px|\s1px\s*,\s*transparent/i.test(value);
  const sized = sizeHint || (block ? /background-size\s*:/i.test(block.body) : false);
  return sized && ((linear >= 2 && lines) || (radial >= 1 && /\b1px\b|\b2px\b/.test(value)));
}

export const decorativeGridBackground: Detector = {
  name: 'decorative-grid-background',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const hits: Hit[] = [];
    for (const block of leafBlocks(source)) {
      const bg = BG_IMAGE.exec(block.body);
      if (bg && gridLike(bg[1]!, block, false)) {
        hits.push({ line: lineOfOffset(block, bg.index), message: 'a background of grid lines, dots or stripes behind content: noise at the contrast that makes text harder to read' });
      }
    }
    for (const { classes, line } of classLists(file, ctx.raw)) {
      const arb = classes.map(bare).filter((c) => /^bg-\[/.test(c)).map((c) => c.replace(/_/g, ' '));
      const image = arb.find((c) => /gradient\(/.test(c));
      if (image && gridLike(image, undefined, arb.some((c) => /^bg-\[size:/.test(c)) || /repeating-/.test(image))) {
        hits.push({ line, message: 'a grid, dot or stripe background drawn with utility classes: decoration behind content' });
      }
    }
    return report(ctx, 'decorative-grid-background', file, ctx.raw, hits);
  },
};

// ---------------------------------------------------------------------------
// A-144 dark mode with glowing accents
// ---------------------------------------------------------------------------

const SHADOW = /(?<![-\w])(box-shadow|text-shadow)\s*:\s*([^;}]+)/gi;
const DROP = /drop-shadow\(\s*0(?:px)?\s+0(?:px)?\s+(\d*\.?\d+)px\s+([^)]+\)?)\s*\)/gi;

/** A colour written in a declaration: a function, a hex, a token, or a keyword. */
const COLOUR_IN = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}\b|var\([^)]*\)|\b[a-z]{3,}\b/i;

/**
 * A shadow layer that is a glow: no offset, a real blur, a saturated colour.
 * The colour is read out first, so the numbers inside `rgb(59 130 246 / .3)`
 * or a hex are never taken for lengths.
 */
function glowLayers(value: string, tokens: Record<string, string>): boolean {
  return value.split(/,(?![^(]*\))/).some((layer) => {
    if (/\binset\b/.test(layer)) return false;
    const colour = COLOUR_IN.exec(layer.replace(/\binset\b/, ''))?.[0];
    if (!colour) return false;
    const nums = [...layer.replace(colour, ' ').matchAll(/-?\d*\.?\d+/g)].map((n) => parseFloat(n[0]));
    if (nums.length < 3) return false;
    const [x, y, blur] = nums;
    if (x !== 0 || y !== 0 || blur! < 8) return false;
    return saturated(colour, tokens, 40, 0.15);
  });
}

export const glowAccent: Detector = {
  name: 'glow-accent',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const hits: Hit[] = [];
    for (const block of leafBlocks(source)) {
      SHADOW.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SHADOW.exec(block.body))) {
        if (glowLayers(m[2]!, ctx.tokens)) hits.push({ line: lineOfOffset(block, m.index), message: `a coloured ${m[1]} glow: contrast added without meaning` });
      }
      DROP.lastIndex = 0;
      while ((m = DROP.exec(block.body))) {
        if (parseFloat(m[1]!) >= 8 && saturated(m[2]!, ctx.tokens, 40)) hits.push({ line: lineOfOffset(block, m.index), message: 'a coloured drop-shadow glow: contrast added without meaning' });
      }
    }
    for (const { classes, line } of classLists(file, ctx.raw)) {
      const plain = classes.map(bare);
      const arb = plain.find((c) => /^(?:shadow|drop-shadow)-\[/.test(c) && glowLayers(c.replace(/^[\w-]+-\[|\]$/g, '').replace(/_/g, ' '), ctx.tokens));
      const tinted = plain.find((c) => /^shadow-/.test(c) && TW_COLOUR.test(c.slice('shadow-'.length)));
      if (arb) hits.push({ line, message: `\`${arb}\`: a coloured glow` });
      else if (tinted && plain.some((c) => /^shadow-(?:lg|xl|2xl)$/.test(c))) hits.push({ line, message: `\`${tinted}\`: a large shadow in a saturated colour, which reads as a glow` });
    }
    return report(ctx, 'glow-accent', file, ctx.raw, hits);
  },
};

// ---------------------------------------------------------------------------
// A-137 cream and beige by reflex
// ---------------------------------------------------------------------------

const PAGE_SELECTOR = /(?:^|[\s,>])(?:html|body|:root|main)\b|--[\w-]*(?:bg|background|surface|page|canvas)[\w-]*/i;
const TW_CREAM = /^bg-(?:amber|orange|yellow)-(?:50|100)$|^bg-stone-(?:100|200)$/;

/**
 * Cream: near-white, warm, and visibly tinted. Measured as the spread between
 * red and blue, not HSL saturation, which near white reports as high for a
 * tint nobody can see: an off-white of 249, 248, 245 is neutral to the eye and
 * 20% saturated to the formula.
 */
function cream(value: string, tokens: Record<string, string>): boolean {
  const c = extractColorComponents(value.trim(), tokens);
  if (!c || c.alpha < 0.9) return false;
  const { r, g, b } = c.rgb;
  return Math.min(r, g, b) >= 215 && r >= g && g >= b && r - b >= 6;
}

export const creamPalette: Detector = {
  name: 'cream-palette',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const hits: Hit[] = [];
    for (const block of leafBlocks(source)) {
      for (const m of block.body.matchAll(/(?:^|[;{\s])((?:--[\w-]+|background(?:-color)?))\s*:\s*([^;}]+)/g)) {
        const prop = m[1]!;
        const onPage = prop.startsWith('--') ? PAGE_SELECTOR.test(prop) : PAGE_SELECTOR.test(block.selector);
        if (!onPage || !cream(m[2]!, ctx.tokens)) continue;
        hits.push({ line: lineOfOffset(block, m.index!), message: `a cream page surface (${m[2]!.trim()}): the palette a model reaches for when asked to look tasteful` });
      }
    }
    if (isMarkupHost(file)) {
      for (const m of ctx.raw.matchAll(/<(html|body|main)\b[^>]*\b(?:class|className)\s*=\s*["']([^"']*)["']/gi)) {
        const hit = m[2]!.split(/\s+/).map(bare).find((c) => TW_CREAM.test(c) || (/^bg-\[#?[\w(),.%\s]+\]$/.test(c) && cream(c.slice(4, -1), ctx.tokens)));
        if (hit) hits.push({ line: lineForOffset(buildLineIndex(ctx.raw), m.index!), message: `\`${hit}\` on <${m[1]}>: a cream page surface by default` });
      }
    }
    return report(ctx, 'cream-palette', file, ctx.raw, hits);
  },
};

// ---------------------------------------------------------------------------
// G-145 a pulsing status dot
// ---------------------------------------------------------------------------

export const pulsingDot: Detector = {
  name: 'pulsing-dot',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const hits: Hit[] = [];
    // A pulse is often a class in the stylesheet (`.status-pulse`) while the
    // dot's shape is utilities on the element. Collect the pulsing classes
    // first, then look for a dot that wears one.
    const pulsingClasses = new Set<string>();
    for (const block of leafBlocks(source)) {
      const anim = /(?<![-\w])animation(?:-name)?\s*:\s*([^;}]+)/i.exec(block.body);
      if (!anim || !/\b(?:pulse|ping|blink|breathe|beacon|glow)[\w-]*/i.test(anim[1]!)) continue;
      if (!/infinite/i.test(anim[1]!) && !/animation-iteration-count\s*:\s*infinite/i.test(block.body)) continue;
      const single = /^\s*\.([\w-]+)\s*$/.exec(block.selector);
      if (single) pulsingClasses.add(single[1]!);
      if (!/border-radius\s*:\s*(?:50%|9999px|999px|100%)/i.test(block.body)) continue;
      hits.push({ line: lineOfOffset(block, anim.index), message: 'a round element pulsing forever: an alarm on a state that is not changing' });
    }
    for (const { classes, line } of classLists(file, ctx.raw)) {
      const plain = classes.map(bare);
      const ping = plain.includes('animate-ping');
      const dot = plain.includes('rounded-full') && plain.some((c) => /^(?:size|w|h)-(?:1|1\.5|2|2\.5|3|3\.5)$/.test(c));
      const pulsing = plain.includes('animate-pulse') || plain.some((c) => pulsingClasses.has(c));
      if (ping || (pulsing && dot)) hits.push({ line, message: `a status dot that ${ping ? 'pings' : 'pulses'} forever: motion on a state that is not changing` });
    }
    return report(ctx, 'pulsing-dot', file, ctx.raw, hits);
  },
};

// ---------------------------------------------------------------------------
// A-138 an italic serif display headline
// ---------------------------------------------------------------------------

const HEADLINE_SELECTOR = /\bh1\b|\bh2\b|hero|display|headline|title/i;
const SERIF = /font-family\s*:\s*([^;}]+)/i;

function serifFamily(value: string): boolean {
  const first = value.split(',')[0]!.trim().toLowerCase();
  if (/sans|mono|system-ui|ui-sans|inter\b|helvetica|arial/.test(first)) return false;
  return /serif|georgia|garamond|playfair|fraunces|lora|merriweather|instrument serif|dm serif|cormorant|newsreader|times|baskerville|bodoni|caslon|libre caslon|source serif|pt serif|crimson/.test(value.toLowerCase());
}

export const italicSerifDisplay: Detector = {
  name: 'italic-serif-display',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const hits: Hit[] = [];
    // A serif is often a class in the stylesheet (`.display { font-family:
    // "Cormorant Garamond" }`) that the headline wears in markup.
    const serifClasses = new Set<string>();
    for (const block of leafBlocks(source)) {
      const family = SERIF.exec(block.body);
      const single = /^\s*\.([\w-]+)\s*$/.exec(block.selector);
      if (family && single && serifFamily(family[1]!)) serifClasses.add(single[1]!);
    }
    for (const block of leafBlocks(source)) {
      if (!HEADLINE_SELECTOR.test(block.selector) && !/\bh1\b.*\b(?:em|i)\b/.test(block.selector)) continue;
      const italic = /font-style\s*:\s*italic/i.exec(block.body);
      const family = SERIF.exec(block.body);
      if (italic && family && serifFamily(family[1]!)) {
        hits.push({ line: lineOfOffset(block, italic.index), message: `${block.selector.trim()} is an italic serif headline: the shortcut to an editorial look` });
      }
    }
    if (isMarkupHost(file)) {
      const starts = buildLineIndex(ctx.raw);
      for (const m of ctx.raw.matchAll(/<(h[12])\b([^>]*)>([\s\S]{0,400}?)<\/\1\s*>/gi)) {
        const own = (/\b(?:class|className)\s*=\s*["']([^"']*)["']/.exec(m[2]!)?.[1] ?? '').split(/\s+/).map(bare);
        const serif = own.includes('font-serif') || own.some((c) => serifClasses.has(c) || (/^font-\[.*serif/i.test(c) && !/sans/i.test(c)));
        const italicSelf = own.includes('italic');
        const italicChild = /<(em|i)\b(?![^>]*\bnot-italic\b)/i.test(m[3]!) || /\bclass(?:Name)?\s*=\s*["'][^"']*\bitalic\b/.test(m[3]!);
        const childSerif = /\bclass(?:Name)?\s*=\s*["'][^"']*\bfont-serif\b/.test(m[3]!);
        if ((serif && (italicSelf || italicChild)) || (italicChild && childSerif)) {
          hits.push({ line: lineForOffset(starts, m.index!), message: `an italic serif <${m[1]!.toLowerCase()}>: the shortcut to an editorial look` });
        }
      }
    }
    return report(ctx, 'italic-serif-display', file, ctx.raw, hits);
  },
};

// ---------------------------------------------------------------------------
// A-135 a kicker above every heading, A-136 an eyebrow chip over the headline
// ---------------------------------------------------------------------------

// The element closing just before a heading opens: `<p class="…">FEATURES</p>\n<h2`.
// The label may hold inline pieces of its own: a dot, an icon, a bold word.
const BEFORE_HEADING = /<(p|span|div|small|a)\b([^>]*)>((?:[^<]|<\/?(?:span|svg|path|circle|i|b|strong|em|img)\b[^>]*>){1,400}?)<\/\1\s*>\s*(?:<[^>]*>\s*){0,2}<(h[1-3])\b/gi;
const LABEL_CLASS = /\b(?:eyebrow|kicker|overline|pretitle|pre-title|tagline|section-label|superscript-label)\b/i;

function labelKind(attrs: string): 'chip' | 'kicker' | undefined {
  const cls = (/\b(?:class|className)\s*=\s*["']([^"']*)["']/.exec(attrs)?.[1] ?? '');
  const plain = cls.split(/\s+/).map(bare);
  const pill = plain.includes('rounded-full') && plain.some((c) => /^(?:border|bg-|ring)/.test(c)) && plain.some((c) => /^(?:px|py|p)-/.test(c));
  if (pill) return 'chip';
  const caps = plain.includes('uppercase') && plain.some((c) => /^tracking-/.test(c) && !/tracking-(?:tight|tighter|normal)/.test(c));
  if (caps || LABEL_CLASS.test(cls)) return 'kicker';
  return undefined;
}

function labelHits(raw: string): Array<{ kind: 'chip' | 'kicker'; heading: string; offset: number; text: string }> {
  const out: Array<{ kind: 'chip' | 'kicker'; heading: string; offset: number; text: string }> = [];
  for (const m of raw.matchAll(BEFORE_HEADING)) {
    const kind = labelKind(m[2]!);
    const text = m[3]!.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (kind && text && text.length <= 60) out.push({ kind, heading: m[4]!.toLowerCase(), offset: m.index!, text });
  }
  return out;
}

export const headingKicker: Detector = {
  name: 'heading-kicker',
  appliesTo: (file) => isReaderText(file) && isMarkupHost(file),
  run(_source, file, ctx) {
    const kickers = labelHits(ctx.raw).filter((h) => h.kind === 'kicker');
    // One label over one heading can be a real category. Over every heading,
    // it has stopped marking anything.
    if (kickers.length < 2) return [];
    const starts = buildLineIndex(ctx.raw);
    return report(ctx, 'heading-kicker', file, ctx.raw, kickers.map((k) => ({
      line: lineForOffset(starts, k.offset),
      message: `"${k.text}" as a small caps line over an <${k.heading}>, one of ${kickers.length} in this file: a kicker over every heading`,
    })));
  },
};

export const eyebrowChip: Detector = {
  name: 'eyebrow-chip',
  appliesTo: (file) => isReaderText(file) && isMarkupHost(file),
  run(_source, file, ctx) {
    const starts = buildLineIndex(ctx.raw);
    return report(ctx, 'eyebrow-chip', file, ctx.raw, labelHits(ctx.raw)
      .filter((h) => h.kind === 'chip' && h.heading === 'h1')
      .map((h) => ({ line: lineForOffset(starts, h.offset), message: `"${h.text}" in a pill over the headline: the shape of a control, pressed and doing nothing` })));
  },
};

// ---------------------------------------------------------------------------
// A-146 numbered section labels
// ---------------------------------------------------------------------------

const NUMBER_LABEL = /<(span|p|div|small)\b[^>]*>\s*(?:\(|№\s*)?0[1-9](?:\s*[./)]|\s*\/\s*\d{2})?\s*<\/\1\s*>\s*(?:<[^>]*>\s*){0,2}<h[2-4]\b|<h[2-4]\b[^>]*>\s*(?:<[^>]+>\s*)?0[1-9]\s*(?:<\/[^>]+>)?\s*[.·—–/|:]?\s*(?:<[^>]+>)?\s*[A-Za-z]/gi;

export const numberedSectionLabels: Detector = {
  name: 'numbered-section-labels',
  appliesTo: (file) => isReaderText(file) && isMarkupHost(file),
  run(_source, file, ctx) {
    // Inside an ordered list the numbers are the order; that is the rule's own
    // exception, so ordered lists are taken out first.
    const raw = ctx.raw.replace(/<ol\b[\s\S]*?<\/ol\s*>/gi, (m) => m.replace(/[^\n]/g, ' '));
    const found = [...raw.matchAll(NUMBER_LABEL)];
    if (found.length < 2) return [];
    const starts = buildLineIndex(ctx.raw);
    return report(ctx, 'numbered-section-labels', file, ctx.raw, found.map((m) => ({
      line: lineForOffset(starts, m.index!),
      message: `a "0N" label on a section heading, one of ${found.length} here: a number promises an order`,
    })));
  },
};

export const generatedLookDetectors = [
  sideTabBorder, roundedAccentBorder, decorativeGridBackground, glowAccent,
  creamPalette, pulsingDot, italicSerifDisplay, headingKicker, eyebrowChip, numberedSectionLabels,
];
