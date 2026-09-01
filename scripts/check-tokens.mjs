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

if (failed) {
  console.error('\ntoken/doc check failed');
  process.exit(1);
}
console.log('✓ tokens and docs agree');
