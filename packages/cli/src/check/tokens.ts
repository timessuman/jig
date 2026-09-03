import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitRuleBlocks } from './css.js';

/**
 * Builds a flat map of custom-property name (without the leading `--`) to
 * its raw declared value, from every vendored `.jig/tokens/*.css` file.
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
export function loadTokenMap(installRoot: string): Record<string, string> {
  const tokensDir = join(installRoot, '.jig', 'tokens');
  const tokens: Record<string, string> = {};
  if (!existsSync(tokensDir)) return tokens;

  const files = readdirSync(tokensDir).filter((f) => f.endsWith('.css')).sort();
  for (const file of files) {
    const source = readFileSync(join(tokensDir, file), 'utf8');
    for (const block of splitRuleBlocks(source)) {
      if (block.body.includes('{')) continue; // wrapper (e.g. @media), not a leaf
      if (block.selector.trim() !== ':root') continue;
      const re = /--([\w-]+)\s*:\s*([^;]+);/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(block.body))) {
        tokens[m[1]] = m[2].trim();
      }
    }
  }
  return tokens;
}
