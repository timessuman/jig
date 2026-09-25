import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * jig-site added a theme toggle and found the page switched while the
 * scrollbars and controls stayed with the device: `:root` said
 * `color-scheme: light dark` and the theme blocks set tokens only (DRIFT 48).
 */
describe('each theme names its color-scheme', () => {
  const css = readFileSync(join(repoRoot, 'tokens', 'brand.default.css'), 'utf8');
  const block = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  };

  it('dark in both dark blocks, light in the light one', () => {
    expect(block(':root:not([data-theme="light"])')).toMatch(/color-scheme:\s*dark;/);
    expect(block(':root[data-theme="dark"]')).toMatch(/color-scheme:\s*dark;/);
    expect(block(':root[data-theme="light"]')).toMatch(/color-scheme:\s*light;/);
  });
});
