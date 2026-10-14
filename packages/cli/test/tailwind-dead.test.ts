import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deadTailwindClasses } from '../src/check/tailwind-dead.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * A portfolio's 22px button: `min-h-touch` in a project with no
 * `--spacing-touch`. Tailwind v4 generates nothing for it and says nothing,
 * and H-117, which reads var(), never saw it. Its nav's `duration-fast` was
 * the same with `--duration-fast` declared: Tailwind reads durations from
 * `--transition-duration-*`. The answer comes from Tailwind itself.
 */
function project(css: string, markup: Record<string, string>, withTailwind = true): string {
  const root = mkdtempSync(join(tmpdir(), 'jig-tw-dead-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), '{"name":"p"}');
  writeFileSync(join(root, 'src', 'app.css'), css);
  for (const [file, body] of Object.entries(markup)) writeFileSync(join(root, 'src', file), body);
  // A junction needs no privilege on Windows.
  if (withTailwind) symlinkSync(join(repoRoot, 'node_modules'), join(root, 'node_modules'), 'junction');
  return root;
}
const THEME = '@import "tailwindcss";\n@theme {\n  --spacing-gap: 12px;\n  --duration-fast: 150ms;\n}\n.text-hero { font-size: 2rem; }\n';

describe('a Tailwind class that generates no CSS', () => {
  it('reports a utility with no value, behind a variant too, and nothing the theme or the CSS defines', () => {
    const root = project(THEME, {
      'Button.tsx': 'export const B = () => <button className="min-h-touch duration-fast p-gap">Go</button>;\n',
      'Card.tsx': 'export const C = () => (\n  <div className="card group hover:min-h-touch md:p-4 text-hero">x</div>\n);\n',
    });
    const r = deadTailwindClasses(root, ['src/Button.tsx', 'src/Card.tsx'], ['src/app.css']);
    expect(r.skipped).toBeUndefined();
    expect(r.dead.map((d) => `${d.file}:${d.line} ${d.className}`)).toEqual([
      'src/Button.tsx:1 min-h-touch',
      'src/Button.tsx:1 duration-fast',
      'src/Card.tsx:2 hover:min-h-touch',
    ]);
  }, 30_000);

  it('passes once the theme declares what the classes read', () => {
    const fixed = THEME.replace('--duration-fast: 150ms;', '--transition-duration-fast: 150ms;\n  --spacing-touch: 48px;');
    const root = project(fixed, { 'Button.tsx': 'export const B = () => <button className="min-h-touch duration-fast">Go</button>;\n' });
    expect(deadTailwindClasses(root, ['src/Button.tsx'], ['src/app.css']).dead).toEqual([]);
  }, 30_000);

  it('is silent without Tailwind v4, and says so when Tailwind cannot be asked', () => {
    const plain = project('.a { color: red; }\n', { 'a.html': '<div class="min-h-touch">x</div>\n' });
    expect(deadTailwindClasses(plain, ['src/a.html'], ['src/app.css'])).toEqual({ dead: [] });
    const uninstalled = project(THEME, { 'a.html': '<div class="min-h-touch">x</div>\n' }, false);
    expect(deadTailwindClasses(uninstalled, ['src/a.html'], ['src/app.css']).skipped).toMatch(/@tailwindcss\/node is not installed/);
  }, 30_000);
});
