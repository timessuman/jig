import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decisionsFile } from './decisions.js';

/**
 * A brand colour or typeface `DECISIONS.md` records that the brand file does not
 * carry.
 *
 * `/jig decide` asks for the type and the colour and writes the answers down;
 * the brand file `init` wrote is what every page actually reads. Of six runs
 * whose owner named a colour and a typeface, four recorded both and left the
 * brand file at Jig's unbranded default, so every page shipped near-black in
 * the system face. Nothing said so: the decisions were right, and the tokens
 * were valid, just not the ones decided.
 *
 * Two signals, both read from the file's own words, never guessed: a hex
 * colour the decisions name, against the brand hue, saturation and lightness;
 * and a face named under a heading about type, against `--font-text` and
 * `--font-display`.
 */
export interface BrandGap {
  file: string;
  line: number;
  message: string;
}

/** The brand file: `brand` in jig.config.json, else the one `init` recorded. */
export function brandFile(projectRoot: string): string | undefined {
  try {
    const brand = JSON.parse(readFileSync(join(projectRoot, 'jig.config.json'), 'utf8')).brand;
    if (typeof brand === 'string' && existsSync(join(projectRoot, brand))) return brand.replace(/^\.\//, '');
  } catch { /* no config, or not JSON */ }
  try {
    const state = JSON.parse(readFileSync(join(projectRoot, '.jig', 'state.json'), 'utf8')) as { files?: Record<string, string> };
    const recorded = Object.keys(state.files ?? {}).find((f) => /^brand\..*\.css$/.test(basename(f)));
    if (recorded && existsSync(join(projectRoot, recorded))) return recorded;
  } catch { /* no state */ }
  for (const dir of ['jig', '.jig/tokens']) {
    try {
      const found = readdirSync(join(projectRoot, dir)).find((f) => /^brand\..*\.css$/.test(f));
      if (found) return `${dir}/${found}`;
    } catch { /* no such folder */ }
  }
  return undefined;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
}

/** The first (light-theme) declaration of a property, with its line. */
function declared(source: string, prop: string): { value: string; line: number } | undefined {
  const m = new RegExp(`${prop}\\s*:\\s*([^;]+);`).exec(source);
  if (!m) return undefined;
  return { value: m[1]!.trim(), line: source.slice(0, m.index).split('\n').length };
}

// Words that open or fill a sentence about type without naming a face.
const NOT_A_FACE = new Set([
  'type', 'typeface', 'typefaces', 'font', 'fonts', 'face', 'faces', 'one', 'the', 'a', 'an', 'and', 'for', 'both', 'no', 'not',
  'why', 'inferred', 'google', 'adobe', 'everything', 'everywhere', 'display', 'text', 'body', 'headings', 'heading', 'sans', 'serif',
  'mono', 'monospace', 'system', 'default', 'plain', 'neutral', 'loaded', 'from', 'it', 'is', 'its', 'use', 'only', 'second', 'this',
  'that', 'owner', 'agent', 'choice', 'value', 'values', 'token', 'tokens', 'same', 'all', 'with', 'of', 'in', 'on', 'one',
]);

/**
 * Faces the decisions name, in the shapes a decision takes: an answer quoted as
 * "Type: Manrope for everything", a line under a heading about type that opens
 * with the face ("Manrope is both the display and the text face", "Manrope, for
 * both"), or a quoted name in a font stack. A capitalised word that merely opens
 * a sentence is not a face.
 */
function namedFaces(decisions: string): Array<{ face: string; line: number }> {
  const out: Array<{ face: string; line: number }> = [];
  const add = (face: string, line: number) => {
    const words = face.trim().split(/\s+/).filter((w) => !NOT_A_FACE.has(w.toLowerCase()));
    if (!words.length) return;
    const name = words.join(' ');
    if (!out.some((f) => f.face === name)) out.push({ face: name, line });
  };
  let inType = false;
  decisions.split('\n').forEach((text, i) => {
    const heading = /^#{2,4}\s+(.*)$/.exec(text);
    if (heading) inType = /\b(type|typeface|typefaces|font|fonts|typography)\b/i.test(heading[1]!);
    for (const m of text.matchAll(/\b(?:type|typeface|font)\s*:\s*([A-Z][\w-]+(?:\s[A-Z][\w-]+){0,2})/gi)) add(m[1]!, i + 1);
    if (!inType) return;
    const opening = /^(?:#{2,4}\s+[^:]*:\s*)?\*{0,2}([A-Z][\w-]+(?:\s[A-Z][\w-]+)?)\*{0,2}(?:\s+is\b|,|\s+for\b)/.exec(text);
    if (opening) add(opening[1]!, i + 1);
    for (const m of text.matchAll(/--font-(?:text|display)\s*:\s*["']([^"']+)["']/g)) add(m[1]!, i + 1);
  });
  return out;
}

/** The first hex on a line, or under a heading, about the brand colour. */
function decidedHex(decisions: string): { hex: string; line: number } | undefined {
  let aboutColour = false;
  const lines = decisions.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!;
    const heading = /^#{2,4}\s+(.*)$/.exec(text);
    if (heading) aboutColour = /\b(brand|colou?r|accent)\b/i.test(heading[1]!);
    const hex = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i.exec(text);
    if (hex && (aboutColour || /\b(brand|colou?r|accent)\b/i.test(text)) && !/\b(never|not|avoid|forbid)/i.test(text)) return { hex: hex[0], line: i + 1 };
  }
  return undefined;
}

export function brandDecidedGaps(projectRoot: string): BrandGap[] {
  const decisionsRel = decisionsFile(projectRoot);
  const brandRel = brandFile(projectRoot);
  if (!decisionsRel || !brandRel) return [];
  const decisions = readFileSync(join(projectRoot, decisionsRel), 'utf8');
  const brand = readFileSync(join(projectRoot, brandRel), 'utf8');
  const gaps: BrandGap[] = [];

  // The colour: a hex the decisions name, set against the brand's own hue,
  // saturation and lightness. A brand file that sets `--color-brand` some
  // other way is read for the hex directly.
  const decided = decidedHex(decisions);
  if (decided) {
    const hex = [decided.hex];
    const want = hexToHsl(hex[0]);
    const h = declared(brand, '--brand-h');
    const s = declared(brand, '--brand-s');
    const l = declared(brand, '--brand-l');
    const direct = declared(brand, '--color-brand');
    const carriesHex = brand.toLowerCase().includes(hex[0].toLowerCase());
    let matches = carriesHex;
    if (!matches && h && s && l) {
      const [bh, bs, bl] = [parseFloat(h.value), parseFloat(s.value), parseFloat(l.value)];
      const hueGap = Math.min(Math.abs(bh - want.h), 360 - Math.abs(bh - want.h));
      matches = (want.s < 10 && bs < 10 && Math.abs(bl - want.l) <= 12) || (hueGap <= 12 && Math.abs(bs - want.s) <= 15 && Math.abs(bl - want.l) <= 12);
    }
    if (!matches) {
      const line = decided.line;
      const found = h && s && l ? `hsl(${h.value} ${s.value} ${l.value})` : direct?.value ?? 'something else';
      gaps.push({
        file: decisionsRel,
        line,
        message: `DECISIONS.md decides the brand colour ${hex[0]}, and ${brandRel} still sets ${found}: every page reads the brand file, so none of them carries the decided colour. Change the brand's hue, saturation and lightness in ${brandRel} to match.`,
      });
    }
  }

  // The typeface: a face named under a heading about type, against the brand
  // file's text and display stacks.
  const stacks = [declared(brand, '--font-text')?.value ?? '', declared(brand, '--font-display')?.value ?? ''].join(' ').toLowerCase();
  const missing = namedFaces(decisions).filter((f) => !stacks.includes(f.face.toLowerCase()));
  if (missing.length) {
    gaps.push({
      file: decisionsRel,
      line: missing[0]!.line,
      message: `DECISIONS.md decides the typeface ${missing.map((f) => f.face).join(', ')}, and ${brandRel}'s --font-text does not name it: every page is set in the default stack instead. Put it first in --font-text (and --font-display), and load it wherever the pages load their styles.`,
    });
  }
  return gaps;
}
