#!/usr/bin/env node
/**
 * Guards the contract that numeric values live in the token files and prose
 * cites token names. Three rules, each closing a drift path we have actually
 * been bitten by.
 *
 * Run from the repo root:  node scripts/check-tokens.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve against the repo root, not the caller's cwd, so this runs correctly
// from anywhere (npm scripts, CI, a subdirectory).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

let failed = false;
const fail = (msg) => { console.error(`  ✗ ${msg}`); failed = true; };

/* ------------------------------------------------------------------ *
 * Rule 1 — every size in 02-tokens.md's type table matches the token.
 *
 * Checks the SPECIFIC token, not merely that the number appears somewhere
 * in the file. A substring check passes when --text-h3 drifts 24 -> 26,
 * because --spacing-m is also 24px.
 * ------------------------------------------------------------------ */
const TYPE_COLUMNS = [
  '--text-caption', '--text-body', '--text-prose',
  '--text-h3', '--text-h2', '--text-h1',
];

const tokensDoc = read('rules/02-tokens.md');
const rows = [...tokensDoc.matchAll(
  /\|\s*`(editorial|product|operator)`\s*\|[^|]*\|\s*\|([^\n]*)/g,
)];

if (rows.length !== 3) {
  fail(`Rule 1 expected 3 mode rows in the type table, found ${rows.length}. ` +
       `The table shape changed — update this check.`);
}

for (const [, mode, cells] of rows) {
  const css = read(`tokens/mode.${mode}.css`);
  const sizes = cells.match(/\d+/g) ?? [];
  if (sizes.length !== TYPE_COLUMNS.length) {
    fail(`${mode}: type table has ${sizes.length} sizes, expected ${TYPE_COLUMNS.length}`);
    continue;
  }
  TYPE_COLUMNS.forEach((token, i) => {
    if (!new RegExp(`${token}:\\s*${sizes[i]}px`).test(css)) {
      fail(`${token} is not ${sizes[i]}px in mode.${mode}.css, but 02-tokens.md says it is`);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Rule 2 — no unanchored literal in a prose table.
 *
 * A number in a table with no token name beside it is a call site. Numbers
 * are fine when anchored to the token they come from, and explanatory prose
 * outside tables keeps literals where the number is the point.
 * ------------------------------------------------------------------ */
const PROSE = ['00-anti-patterns.md', '01-modes.md', '03-patterns.md', '04-principles.md', '05-copy.md'];
for (const file of PROSE) {
  read(`rules/${file}`).split('\n').forEach((line, i) => {
    if (/^\|/.test(line) && /\b\d+(px|ch)\b/.test(line) && !/`--/.test(line)) {
      fail(`${file}:${i + 1} literal value in a table with no token cited — ${line.trim().slice(0, 60)}`);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Rule 3 — no colour literal repeated inside a token file.
 *
 * hsl(0 71% 44%) once appeared five times; changing the red meant editing
 * every copy or the variations silently desynchronised. Same drift, inside
 * the file that is supposed to be the single source of truth.
 *
 * Achromatic anchors are exempt. The transparent foreground palette is
 * deliberately built from pure black and white at varying alphas — those
 * are constants, not chosen values, and cannot desynchronise.
 * ------------------------------------------------------------------ */
const ACHROMATIC = new Set([
  'rgb(0 0 0)', 'rgb(255 255 255)', 'oklch(1 0 0)', 'oklch(0 0 0)',
]);

for (const file of ['brand.default.css']) {
  const css = read(`tokens/${file}`);
  const seen = new Map();
  for (const m of css.matchAll(/(hsl|oklch|rgb)\(\s*([0-9][^)/]*?)\s*(?:\/|\))/g)) {
    const channels = `${m[1]}(${m[2].trim().replace(/\s+/g, ' ')})`;
    if (ACHROMATIC.has(channels)) continue;
    seen.set(channels, (seen.get(channels) ?? 0) + 1);
  }
  for (const [channels, count] of seen) {
    if (count > 1) {
      fail(`${file}: ${channels} appears ${count}x — extract it to a variable so the ` +
           `variations cannot desynchronise`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Rule 4 — every token import path in the rules is the canonical one.
 *
 * The rule markdown is BOTH the source of truth and the artefact vendored
 * into a consumer's repo, so a path that is correct in one context and wrong
 * in the other is a dual truth that drifts. There is exactly one location:
 * `.jig/tokens/`. `install` writes there, `update` refreshes there, and
 * nothing — including a future `init` — relocates them.
 * ------------------------------------------------------------------ */
const CANONICAL_TOKEN_PATH = '.jig/tokens/';
for (const file of ['02-tokens.md', ...PROSE]) {
  read(`rules/${file}`).split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/@import\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!/tokens?\//.test(spec)) continue;          // not a token import
      if (spec.startsWith(CANONICAL_TOKEN_PATH)) continue;
      fail(`${file}:${i + 1} imports tokens from "${spec}" — the canonical path is ` +
           `"${CANONICAL_TOKEN_PATH}", the only place install and update ever write them`);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Rule 5 — semantic colours meet their contrast floors.
 *
 * The source states it directly: system colours used for text need 4.5:1;
 * used for interface elements and icons, 3:1. A failing default propagates
 * to every consumer who accepts it, which is most of them — that is what a
 * default is. This shipped at 3.64:1 for warning and nobody noticed, because
 * catching it required arithmetic no one was doing.
 * ------------------------------------------------------------------ */
const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) =>
  0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hslToRgb = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
const composite = (fg, bg, alpha) =>
  fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

// Every light-mode surface a semantic colour can land on. `fill` matters and
// is easy to forget: the source is explicit that a text link can sit on a fill
// background, so the floor applies there too. It is the tightest of the three.
const FILL_ALPHA = 0.04;
const compositeFill = (bg) => bg.map((c) => Math.round(bg === bg ? c * (1 - FILL_ALPHA) : c));
const LIGHT_BACKGROUNDS = {
  'bg-base': [249, 248, 245],
  'bg-raised': [255, 255, 255],
  'fill-on-raised': compositeFill([255, 255, 255]),
  'fill-on-base': compositeFill([249, 248, 245]),
};

{
  const css = read('tokens/brand.default.css');
  for (const name of ['error', 'warning', 'success', 'info']) {
    const grab = (part) => {
      const m = new RegExp(`--${name}-${part}:\\s*([0-9.]+)%?`).exec(css);
      return m ? Number(m[1]) : null;
    };
    const [h, s, l] = [grab('h'), grab('s'), grab('l')];
    if (h === null || s === null || l === null) {
      fail(`brand.default.css: could not read --${name}-h/s/l`);
      continue;
    }
    const rgb = hslToRgb(h, s, l);
    for (const [bgName, bg] of Object.entries(LIGHT_BACKGROUNDS)) {
      const text = contrast(rgb, bg);
      const stroke = contrast(composite(rgb, bg, 0.8), bg);
      if (text < 4.5) {
        fail(`--color-text-${name} is ${text.toFixed(2)}:1 on ${bgName} — needs 4.5:1 for text`);
      }
      if (stroke < 3) {
        fail(`--color-stroke-${name}-strong is ${stroke.toFixed(2)}:1 on ${bgName} — needs 3:1`);
      }
    }
  }
}

if (failed) {
  console.error('\ntoken/doc check failed');
  process.exit(1);
}
console.log('✓ tokens and docs agree');
