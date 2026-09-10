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
// Anchored to the start of a line, because the type table is the one where a
// mode name is the FIRST cell. The sizes-and-motion tables below it put the
// mode names in their HEADER row instead, and an unanchored match picked those
// up too — five "mode rows" where there are three.
const rows = [...tokensDoc.matchAll(
  /^\|\s*`(editorial|product|operator)`\s*\|[^|]*\|\s*\|([^\n]*)/gm,
)];

if (rows.length !== 3) {
  fail(`Rule 1 expected 3 mode rows in the type table, found ${rows.length}. ` +
       `The table shape changed — update this check.`);
}

for (const [, mode, cells] of rows) {
  const css = read(`tokens/mode.${mode}.css`);
  const values = cells.split('|').map((c) => c.trim()).filter(Boolean);
  if (values.length !== TYPE_COLUMNS.length) {
    fail(`${mode}: type table has ${values.length} sizes, expected ${TYPE_COLUMNS.length}`);
    continue;
  }

  TYPE_COLUMNS.forEach((token, i) => {
    const cell = values[i];

    // A plain number is a fixed size.
    if (/^\d+$/.test(cell)) {
      if (!new RegExp(`${token}:\\s*${cell}px`).test(css)) {
        fail(`${token} is not ${cell}px in mode.${mode}.css, but 02-tokens.md says it is`);
      }
      return;
    }

    // `32–48` is a fluid size: a clamp whose bounds are those two values.
    const range = /^(\d+)[–-](\d+)$/.exec(cell);
    if (!range) {
      fail(`${mode}: "${cell}" in the type table is neither a size nor a range like 32–48`);
      return;
    }
    const [, minPx, maxPx] = range.map(Number);

    const decl = new RegExp(
      `${token}:\\s*clamp\\(\\s*([\\d.]+)rem\\s*,\\s*([\\d.]+)rem\\s*\\+\\s*([\\d.]+)vw\\s*,\\s*([\\d.]+)rem\\s*\\)`,
    ).exec(css);
    if (!decl) {
      fail(`02-tokens.md says ${token} is fluid (${cell}) in ${mode}, but mode.${mode}.css ` +
           `does not declare it as clamp(<rem>, <rem> + <vw>, <rem>). ` +
           `Every term must be rem-based — a px or bare vw bound ignores the reader's font-size setting (WCAG 1.4.4).`);
      return;
    }
    const [, lo, intercept, slope, hi] = decl.map(Number);

    if (lo * 16 !== minPx || hi * 16 !== maxPx) {
      fail(`${token} in ${mode} clamps to ${lo * 16}–${hi * 16}px, but 02-tokens.md says ${cell}`);
      return;
    }

    // The bounds can be right while the curve between them is wrong. The doc
    // states the range is reached at a 360px viewport and at 1024px, so check
    // the preferred term actually passes through those two points — otherwise
    // the heading saturates somewhere else entirely and the doc is fiction.
    for (const [vw, expected] of [[360, minPx], [1024, maxPx]]) {
      const actual = intercept * 16 + (slope / 100) * vw;
      if (Math.abs(actual - expected) > 0.5) {
        fail(`${token} in ${mode}: at a ${vw}px viewport the clamp computes ` +
             `${actual.toFixed(2)}px, but the stated range wants ${expected}px there.`);
      }
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

/* ------------------------------------------------------------------ *
 * Rule 6 — every token is rendered by the preview harness.
 *
 * The preview is the only check that can catch a value which passes its
 * arithmetic and still looks wrong, and a token it does not render is a
 * value nobody has ever seen. Without this rule the harness would rot
 * silently — it has no failure mode of its own, unlike everything else here.
 *
 * The search is a literal one, so preview sources must write token names out
 * in full rather than interpolating them. A check clever enough to expand
 * `--color-text-${name}` would be a check with its own bugs.
 * ------------------------------------------------------------------ */
{
  const defined = new Set();
  for (const file of ['brand.default.css', 'mode.editorial.css', 'mode.product.css', 'mode.operator.css']) {
    for (const m of read(`tokens/${file}`).matchAll(/^\s*(--[a-z0-9-]+):/gm)) defined.add(m[1]);
  }
  const previewSource = ['index.html', 'preview.css', 'preview.js']
    .map((f) => read(`packages/preview/${f}`)).join('\n');

  const unrendered = [...defined].filter((t) => !previewSource.includes(t)).sort();
  if (unrendered.length) {
    fail(`${unrendered.length} token(s) defined but never rendered by packages/preview:`);
    for (const t of unrendered) console.error(`      ${t}`);
    console.error('      Add them to the preview — a token nobody has looked at is a value nobody has checked.');
  }
}


/* ------------------------------------------------------------------ *
 * Rule 7 — the sizes-and-motion tables match the mode files.
 *
 * `01-modes.md` names these tokens and points at 02-tokens.md for resolved
 * values. The values were only ever in `tokens/mode.*.css`, so the pointer led
 * nowhere; now that the doc states them, they can drift from the CSS instead —
 * which is worse than absent, because a wrong number reads as authoritative.
 *
 * A `—` cell asserts the token is genuinely ABSENT from that mode, so the
 * table cannot quietly hide one that was added later.
 * ------------------------------------------------------------------ */
{
  const MODES = ['editorial', 'product', 'operator'];
  const cssFor = Object.fromEntries(MODES.map((m) => [m, read(`tokens/mode.${m}.css`)]));

  // Every `| \`--token\` | a | b | c |` row in the sizes/motion section.
  const rows = [...tokensDoc.matchAll(
    /^\|\s*`(--[a-z0-9-]+)`\s*\|([^\n]*)\|\s*$/gm,
  )];
  const checked = rows.filter(([, token]) =>
    /^--(size|duration|measure|spacing|ease|leading)-/.test(token),
  );

  if (checked.length < 9) {
    fail(`Rule 7 found only ${checked.length} size/motion rows in 02-tokens.md; ` +
         `the table shape changed — update this check.`);
  }

  for (const [, token, cells] of checked) {
    const values = cells.split('|').map((c) => c.trim().replace(/`/g, ''));
    if (values.length !== MODES.length) {
      fail(`Rule 7: ${token} has ${values.length} cells, expected ${MODES.length}`);
      continue;
    }
    MODES.forEach((mode, i) => {
      const claimed = values[i];
      const actual = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(cssFor[mode]);
      if (claimed === '—') {
        if (actual) {
          fail(`02-tokens.md says ${token} is undefined in ${mode}, but mode.${mode}.css sets it to ${actual[1].trim()}`);
        }
        return;
      }
      if (!actual) {
        fail(`02-tokens.md says ${token} is ${claimed} in ${mode}, but mode.${mode}.css does not define it`);
        return;
      }
      // A selection is written `var(--spacing-m)` in CSS and `--spacing-m` in
      // the doc — the same value, and the doc form is the readable one.
      const resolved = actual[1].trim().replace(/^var\((--[a-z0-9-]+)\)$/, '$1');
      if (resolved !== claimed) {
        fail(`${token} is ${resolved} in mode.${mode}.css, but 02-tokens.md says ${claimed}`);
      }
    });
  }
}

/* ------------------------------------------------------------------ *
 * Rule 8 — leading holds its shape within each mode.
 *
 * Rule 7 checks the doc against the CSS, which catches drift between the
 * two but not a value that is wrong in both. This checks the relationship
 * the doc actually claims: within a mode, line height never INCREASES as
 * type gets bigger, because a large heading needs proportionally less
 * leading to sit at the same optical rhythm.
 *
 * Prose is the deliberate exception and is excluded. It is larger than body
 * AND looser (1.6 against 1.5) because sustained reading wants that; it is a
 * different role, not a bigger body.
 * ------------------------------------------------------------------ */
{
  // Ascending by font size, so leading must be non-increasing along it.
  const ASCENDING = ['--leading-body', '--leading-h3', '--leading-h2', '--leading-h1'];

  for (const mode of ['editorial', 'product', 'operator']) {
    const css = read(`tokens/mode.${mode}.css`);
    const val = (t) => {
      const m = new RegExp(`${t}\\s*:\\s*([\\d.]+)`).exec(css);
      if (!m) fail(`Rule 8: ${t} is not defined in mode.${mode}.css`);
      return m ? Number(m[1]) : NaN;
    };
    const leads = ASCENDING.map(val);
    if (leads.some(Number.isNaN)) continue;

    for (let i = 1; i < leads.length; i++) {
      if (leads[i] > leads[i - 1]) {
        fail(`${mode}: ${ASCENDING[i]} (${leads[i]}) is looser than ${ASCENDING[i - 1]} ` +
             `(${leads[i - 1]}), but it is on larger type. Leading tightens as size grows.`);
      }
    }

    const floor = Math.min(val('--leading-body'), val('--leading-caption'));
    if (floor < 1.5) {
      fail(`${mode}: body/caption leading is ${floor}, below the 1.5 floor.`);
    }
    if (val('--leading-prose') < 1.5 || val('--leading-prose') > 2) {
      fail(`${mode}: --leading-prose is ${val('--leading-prose')}, outside the 1.5–2 band ` +
           `that long-form reading wants.`);
    }
  }
}

if (failed) {
  console.error('\ntoken/doc check failed');
  process.exit(1);
}
console.log('✓ tokens and docs agree');
