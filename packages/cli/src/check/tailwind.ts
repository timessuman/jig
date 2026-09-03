/**
 * Values written into class attributes, where they are not CSS and no amount of
 * style extraction will find them.
 *
 * Two forms are decidable without modelling the framework:
 *
 * - **Arbitrary values** — `bg-[#6D28D9]`, `p-[13px]`. The bracket syntax means
 *   "this exact value, bypassing the scale", which is H-47 stated in Tailwind's
 *   own notation.
 * - **Default-palette pairs** — `bg-gray-950 text-white`. Both sides are known
 *   constants, so C-19 can resolve the contrast.
 *
 * A bare `p-4` is deliberately not a finding. It resolves through a scale,
 * which is what a scale is for; flagging it would mean flagging correct
 * Tailwind, and the scale a project uses is the project's own decision.
 */

/** `class=` / `className=` up to the start of its value. */
const CLASS_ATTR = /\b(?:class|className)\s*=\s*/g;

/**
 * The braced expression starting at `open`, tracking depth and skipping quoted
 * runs. A non-greedy `\{...\}` cannot do this: it stops at the first `}`,
 * which in `` {`g ${x} h`} `` is the one closing the interpolation.
 */
function readBraced(source: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  return null;
}

export interface ClassAttribute {
  /** The class names, with interpolations removed. */
  classes: string;
  /** 1-based line the attribute's value starts on, in the source given. */
  line: number;
}

/**
 * Every class attribute in `source`, each carrying its own line.
 *
 * The line is computed here, from the match offset, rather than by the caller
 * searching for the text afterwards. `indexOf` returns the FIRST occurrence, so
 * two identical attributes — the same component rendered twice, the same
 * utility string copied — both reported the first one's line. A user fixes that
 * line, re-runs, and sees what looks like the identical finding, with nothing
 * naming the line still wrong.
 */
export function classAttributeValues(source: string): ClassAttribute[] {
  const out: ClassAttribute[] = [];
  const lineAt = (offset: number) => source.slice(0, offset).split('\n').length;
  for (const m of source.matchAll(CLASS_ATTR)) {
    const at = m.index! + m[0].length;
    const opener = source[at];
    if (opener === '"' || opener === "'") {
      const end = source.indexOf(opener, at + 1);
      if (end !== -1) out.push({ classes: source.slice(at + 1, end), line: lineAt(at) });
      continue;
    }
    if (opener !== '{') continue;
    const raw = readBraced(source, at);
    if (raw === null) continue;
    // A JSX expression: a string, a template literal, or a clsx-style call.
    // Take every quoted or backticked run inside it and ignore the JS around
    // them — an interpolated `${x}` contributes no literal class name.
    const literals = [...raw.matchAll(/(["'`])([\s\S]*?)\1/g)].map((q) =>
      q[2].replace(/\$\{[\s\S]*?\}/g, ' '),
    );
    if (literals.length > 0) out.push({ classes: literals.join(' ').trim(), line: lineAt(at) });
  }
  return out;
}

export interface ArbitraryValue {
  utility: string;
  value: string;
  kind: 'colour' | 'length';
}

/**
 * `[...]` utilities carrying a literal colour or length.
 *
 * A variant prefix (`hover:`, `md:`) is stripped. An arbitrary value that reads
 * a custom property — `bg-[var(--color-brand)]` — is the token layer working as
 * intended and is never a finding. Values that are neither a colour nor a
 * length (a grid template, a z-index) are out of H-47's scope.
 */
const ARBITRARY = /(?:^|\s)(?:[\w-]+:)*([a-z][\w-]*)-\[([^\]\s]+)\]/gi;
const COLOUR = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\()/i;
const LENGTH = /^-?\d*\.?\d+(?:px|rem|em|pt|vh|vw|vmin|vmax|ch|ex)$/i;

export function arbitraryValues(classes: string): ArbitraryValue[] {
  const out: ArbitraryValue[] = [];
  for (const m of classes.matchAll(ARBITRARY)) {
    const [, utility, rawValue] = m;
    // Tailwind writes spaces as underscores inside brackets.
    const value = rawValue.replace(/_/g, ' ');
    if (/var\(|--/.test(value)) continue;
    if (COLOUR.test(value)) out.push({ utility, value, kind: 'colour' });
    else if (LENGTH.test(value)) out.push({ utility, value, kind: 'length' });
  }
  return out;
}

/**
 * Tailwind's default palette, for the pairs C-19 can resolve without a parser.
 *
 * Deliberately partial: the greys plus black and white, which is where
 * contrast failures actually cluster (`bg-gray-950 text-white`,
 * `text-gray-400` on white). A colour this table does not know produces no
 * finding rather than a guess.
 */
const PALETTE: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db', 'gray-400': '#9ca3af', 'gray-500': '#6b7280',
  'gray-600': '#4b5563', 'gray-700': '#374151', 'gray-800': '#1f2937',
  'gray-900': '#111827', 'gray-950': '#030712',
  'slate-50': '#f8fafc', 'slate-400': '#94a3b8', 'slate-500': '#64748b',
  'slate-800': '#1e293b', 'slate-900': '#0f172a', 'slate-950': '#020617',
  'zinc-400': '#a1a1aa', 'zinc-500': '#71717a', 'zinc-900': '#18181b',
  'neutral-400': '#a3a3a3', 'neutral-500': '#737373', 'neutral-900': '#171717',
  'stone-400': '#a8a29e', 'stone-500': '#78716c', 'stone-900': '#1c1917',
};

export interface PalettePair {
  background: string;
  foreground: string;
}

/**
 * A background and a foreground on the same element, both resolvable in the
 * default palette. Only a complete pair is returned: one known side says
 * nothing about contrast, because the other could be anything.
 */
export function palettePairs(classes: string): PalettePair[] {
  let background: string | undefined;
  let foreground: string | undefined;
  for (const token of classes.split(/\s+/)) {
    const bare = token.replace(/^(?:[\w-]+:)*/, '');
    const bg = /^bg-(.+)$/.exec(bare);
    const fg = /^text-(.+)$/.exec(bare);
    if (bg && PALETTE[bg[1]]) background = PALETTE[bg[1]];
    if (fg && PALETTE[fg[1]]) foreground = PALETTE[fg[1]];
  }
  return background && foreground ? [{ background, foreground }] : [];
}
