#!/usr/bin/env node
/**
 * Guards the contract that numeric values live in the token files and prose
 * cites token names. Three rules, each closing a drift path we have actually
 * been bitten by.
 *
 * Run from the repo root:  node scripts/check-tokens.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apcaContrast, over } from './apca.mjs';

// Resolve against the repo root, not the caller's cwd, so this runs correctly
// from anywhere (npm scripts, CI, a subdirectory).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const list = (rel) => readdirSync(join(ROOT, rel));

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
  '--text-caption', '--text-body', '--text-prose', '--text-lead',
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
    // NOT line-anchored. The token files declare two per line —
    // `--text-caption: 14px;  --leading-caption: 1.5;` — and a `^\s*` anchor
    // sees only the first. That blind spot hid 30 of 133 tokens from this rule,
    // 17 of which were genuinely absent from the preview, including every
    // `--grid-*-sm` value. A coverage rule that silently covers 77% of what it
    // claims is worse than no rule, because it is trusted.
    for (const m of read(`tokens/${file}`).matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
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

/* ------------------------------------------------------------------ *
 * Rule 9 — every token the rules cite actually exists.
 *
 * The rules are the product. A rule naming a token that no mode defines
 * sends an agent to write `var(--leading-heading)`, which resolves to
 * nothing and silently falls back to the browser default — a failure with
 * no error message anywhere. This has bitten three times: --color-danger,
 * --color-surface, and --leading-heading, each found by hand.
 *
 * Two names are cited deliberately and must NOT be defined: they are
 * counter-examples, naming the thing the rule tells you not to write. An
 * allowlist is the honest way to express that — the alternative is a rule
 * that fires on correct prose, which teaches people to ignore it.
 * ------------------------------------------------------------------ */
{
  // Named as things NOT to consume. If either is ever added to a token file,
  // the rule citing it becomes wrong and this list must be revisited.
  const COUNTER_EXAMPLES = new Set(['--color-neutral-900', '--button-bg']);

  const defined = new Set();
  for (const file of list('tokens').filter((f) => f.endsWith('.css'))) {
    for (const m of read(`tokens/${file}`).matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  }

  for (const t of COUNTER_EXAMPLES) {
    if (defined.has(t)) {
      fail(`${t} is allowlisted in rule 9 as a counter-example, but a token file now ` +
           `defines it. The rule citing it is now wrong — fix the prose, then this list.`);
    }
  }

  for (const file of list('rules').filter((f) => f.endsWith('.md'))) {
    read(`rules/${file}`).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/`(--[a-z0-9-]+)`/g)) {
        if (defined.has(m[1]) || COUNTER_EXAMPLES.has(m[1])) continue;
        fail(`rules/${file}:${i + 1} cites ${m[1]}, which no token file defines. ` +
             `An agent following this writes a var() that resolves to nothing.`);
      }
    });
  }
}

/* ------------------------------------------------------------------ *
 * Rule 10 — the two dark blocks in a brand file stay identical.
 *
 * Dark has three states: OS-dark, explicitly-light, explicitly-dark. A
 * selector inside `@media (prefers-color-scheme: dark)` cannot match the
 * third — the query is false — so `data-theme="dark"` on a light-mode
 * system produced NO dark tokens until a second, unmediated block was
 * added. That is why the preview's dark toggle did nothing for anyone
 * whose OS was in light mode.
 *
 * CSS cannot share one declaration body across a media-query boundary, so
 * the duplication is forced. This makes it safe: the two blocks must
 * declare exactly the same tokens with exactly the same values.
 * ------------------------------------------------------------------ */
{
  const declarations = (body) => {
    const out = new Map();
    for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      out.set(m[1], m[2].trim().replace(/\s+/g, ' '));
    }
    return out;
  };

  for (const file of list('tokens').filter((f) => f.startsWith('brand.'))) {
    const css = read(`tokens/${file}`);

    const media = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\n  \}\s*\n\}/.exec(css);
    const explicit = /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css);

    if (!media || !explicit) {
      fail(`${file}: dark mode needs BOTH a prefers-color-scheme block and a ` +
           `:root[data-theme="dark"] block. Without the second, a user who chooses ` +
           `dark on a light-mode system gets no dark tokens at all.`);
      continue;
    }

    const a = declarations(media[1]);
    const b = declarations(explicit[1]);

    for (const [token, value] of a) {
      if (!b.has(token)) {
        fail(`${file}: ${token} is set in the prefers-color-scheme dark block but ` +
             `not in the :root[data-theme="dark"] block — it will not apply to a ` +
             `user who chose dark explicitly.`);
      } else if (b.get(token) !== value) {
        fail(`${file}: ${token} is "${value}" in the media block but ` +
             `"${b.get(token)}" in the explicit block. The two must match.`);
      }
    }
    for (const token of b.keys()) {
      if (!a.has(token)) {
        fail(`${file}: ${token} is set in the :root[data-theme="dark"] block but not ` +
             `in the prefers-color-scheme block — it will not apply to a user whose ` +
             `OS is in dark mode.`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Rule 11 — disabled text stays above APCA's own floor.
 *
 * The source this system reconciles against suggests 20% opacity for
 * disabled states. Ours is 38%, and the divergence was recorded but never
 * computed. Computing it settles it against the source's OWN APCA table,
 * which puts Lc 30 as the absolute minimum for disabled button text:
 *
 *   opacity 0.20 -> Lc 27.3    below the source's own floor
 *   opacity 0.38 -> Lc 52.1    clears it, and clears Lc 45 for UI elements
 *
 * Lc 30 is not reached until opacity 0.218. The source's two positions
 * contradict each other and the table is the one with a number in it.
 *
 * WCAG 2.1 has nothing to say here — it exempts disabled controls entirely —
 * so APCA is the only standard that constrains this value at all. That is
 * exactly the case `02-tokens.md` describes: comply with WCAG 2.1, and check
 * APCA as well, particularly where WCAG is silent.
 * ------------------------------------------------------------------ */
{
  const DISABLED_LC_FLOOR = 30;
  const brand = read('tokens/brand.default.css');

  const opacity = /--opacity-disabled:\s*([\d.]+)\s*;/.exec(brand);
  const textStrong = /--color-text-strong:\s*rgb\(0 0 0 \/ (\d+)%\)/.exec(brand);

  if (!opacity || !textStrong) {
    fail('Rule 11 could not read --opacity-disabled and --color-text-strong from ' +
         'brand.default.css. Both moved or changed shape — update this check.');
  } else {
    // Disabled styling multiplies the element's opacity by the text colour's
    // own alpha, so the effective alpha is the product. The background is the
    // lightest surface, which is the worst case for dark text.
    const effective = Number(opacity[1]) * (Number(textStrong[1]) / 100);
    const lc = Math.abs(apcaContrast(over(effective, [0, 0, 0], [255, 255, 255]), [255, 255, 255]));

    if (lc < DISABLED_LC_FLOOR) {
      fail(`--opacity-disabled is ${opacity[1]}, which puts disabled text at Lc ` +
           `${lc.toFixed(1)} — below APCA's ${DISABLED_LC_FLOOR} floor for disabled ` +
           `button text (02-tokens.md). WCAG 2.1 exempts disabled controls, so this ` +
           `is the only standard holding this value up.`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Rule 12 — counts stated in prose match what is actually there.
 *
 * "These eight cover most of what generated UI gets wrong" sat in
 * 03-patterns.md while the file held twelve pattern specs. It had been
 * wrong since P-12 and got wronger with P-13, and nothing noticed because
 * a number written as a word in a sentence is invisible to every other
 * check here.
 *
 * These are the numbers a reader uses to decide whether they have the
 * whole picture, which is exactly the kind that must not quietly drift.
 * ------------------------------------------------------------------ */
{
  const index = JSON.parse(read('rules.index.json'));
  const readme = read('README.md');
  const patterns = read('rules/03-patterns.md');
  const antiPatterns = read('rules/00-anti-patterns.md');

  const claim = (label, source, re, actual) => {
    const m = re.exec(source);
    if (!m) {
      fail(`Rule 12 could not find the ${label} claim — its wording changed, so ` +
           `the number is no longer checked. Update this rule or restore the phrasing.`);
    } else if (Number(m[1]) !== actual) {
      fail(`${label} says ${m[1]}, but there are ${actual}.`);
    }
  };

  claim('README rule count', readme, /(\d+) rules\b/, index.length);
  claim('README judgment count', readme, /(\d+) judgment\b/, index.filter((r) => r.bucket === 'judgment').length);
  claim("README's 00-anti-patterns row", readme, /\| (\d+) universal rules/,
        (antiPatterns.match(/^### [A-Z]-\d+/gm) ?? []).length);
  claim('03-patterns.md pattern count', patterns, /These (\d+) cover/,
        (patterns.match(/^## P-\d+/gm) ?? []).length);

  // There was a fifth claim here: the README stated how many reconciliation
  // rows were open. It is gone because the README no longer carries project
  // status at all — that is RECONCILE.md's job, and a count duplicated out of
  // its source is the thing that rots. Removed rather than repointed: a check
  // aimed at a file it is derived from would assert nothing.

}

if (failed) {
  console.error('\ntoken/doc check failed');
  process.exit(1);
}
console.log('✓ tokens and docs agree');
