import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitRuleBlocks } from './css.js';
import { maskNonStyleRegions } from './styles.js';

/**
 * Builds a flat map of custom-property name (without the leading `--`) to
 * its raw declared value, from every `.jig/tokens/*.css` file in a project —
 * always the project's own tokens (its brand file and declared mode
 * file(s), written by `init`), never anything from wherever the skill/rules
 * happen to be installed.
 *
 * Only the top-level `:root { ... }` block is read — not the
 * `prefers-color-scheme: dark` or `[data-theme="dark"]` overrides, whose
 * selectors are `:root:not(...)` / `:root[data-theme="dark"]` and so don't
 * match the exact `:root` filter below. This is a deliberate choice, not an
 * oversight: `check` has no way to know which mode/theme a given piece of
 * markup renders under, so it resolves tokens against the one unambiguous
 * default — the light `:root` block — and leaves anything it can't
 * resolve alone (the values there are consumed by `resolveOpaqueColor` /
 * `extractColorComponents`, which already skip what they can't parse).
 *
 * Files are read in filename order, so a later file's value for the same
 * custom property wins — in practice this only matters if a consumer's own
 * mode file redeclares something brand.default.css also sets.
 */
/** Top-level `:root { ... }` custom properties in one stylesheet's source. */
function rootDeclarations(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of splitRuleBlocks(source)) {
    if (block.atRuleDepth !== 0) continue; // conditional on a theme/breakpoint — see CssBlock.atRuleDepth
    if (block.body.includes('{')) continue; // wrapper, not a leaf
    if (block.selector.trim() !== ':root') continue;
    const re = /--([\w-]+)\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block.body))) out[m[1]] = m[2].trim();
  }
  return out;
}

/**
 * The token map the detectors resolve `var(--x)` against.
 *
 * `.jig/tokens/*.css` is the first source and behaves as it always has: files
 * in filename order, a later file's value winning, since mode files select
 * from what the brand file declares.
 *
 * `consumerFiles` is the second, and closes I5. Until it existed, this map
 * held ONLY Jig's own vendored tokens, so a `var(--brand)` the project
 * declared in its own `:root` was never in it — `resolveOpaqueColor` and
 * `extractColorComponents` treated it as unresolvable and skipped it. That is
 * the safe default rather than a wrong answer, but it meant `contrast-floor`
 * and `violet-band-hue` silently did not evaluate an entire class of real
 * values: on a project that had not run `jig init`, very nearly all of them.
 *
 * A name declared in both places, with different values, is DELETED rather
 * than resolved either way. Which one a browser uses depends on import order,
 * which cannot be known from the files alone — and a wrong guess here does not
 * produce a missed finding, it produces a REPORTED one against a value the
 * page never renders. A false contrast failure costs more trust than a missed
 * one, so ambiguity resolves to silence. The same rule applies between two
 * consumer files that disagree.
 *
 * Scope is deliberately shallow: top-level `:root` only, no `@media` or
 * `@layer` overrides, no `@import` following. `check` cannot know which mode
 * or theme a given piece of markup renders under, so it resolves against the
 * one unambiguous default and leaves everything else alone.
 */
export function loadTokenMap(
  projectRoot: string,
  consumerFiles: string[] = [],
): Record<string, string> {
  const jig: Record<string, string> = {};
  const tokensDir = join(projectRoot, '.jig', 'tokens');
  if (existsSync(tokensDir)) {
    for (const file of readdirSync(tokensDir).filter((f) => f.endsWith('.css')).sort()) {
      Object.assign(jig, rootDeclarations(readFileSync(join(tokensDir, file), 'utf8')));
    }
  }

  const consumer: Record<string, string> = {};
  const ambiguous = new Set<string>();
  const vendored = join('.jig', 'tokens');

  for (const file of consumerFiles) {
    if (file.includes(vendored)) continue; // already read above, as Jig's own
    let source: string;
    try {
      source = readFileSync(join(projectRoot, file), 'utf8');
    } catch {
      continue; // deleted between selection and read; not this function's problem
    }
    for (const [name, value] of Object.entries(rootDeclarations(maskNonStyleRegions(source, file)))) {
      if (name in consumer && consumer[name] !== value) ambiguous.add(name);
      consumer[name] = value;
    }
  }

  const tokens: Record<string, string> = { ...consumer };
  for (const [name, value] of Object.entries(jig)) {
    if (name in consumer && consumer[name] !== value) ambiguous.add(name);
    tokens[name] = value;
  }
  for (const name of ambiguous) delete tokens[name];

  return tokens;
}
