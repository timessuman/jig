import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * Every rule has a picture beside its name: a `dont` and a `do`, small and
 * self-contained. See examples/README.md.
 */
const dir = join(repoRoot, 'examples');
const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')) as Array<{ id: string }>;
const ids = index.map((r) => r.id);
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')) : [];

describe('rule examples', () => {
  it('exist for every rule', () => {
    const missing = ids.filter((id) => !files.includes(`${id}.html`));
    expect(missing, `${missing.length} rule(s) with no example`).toEqual([]);
  });

  it('are only for rules that exist', () => {
    const orphans = files.map((f) => f.replace(/\.html$/, '')).filter((id) => !ids.includes(id));
    expect(orphans).toEqual([]);
  });

  for (const file of files) {
    it(`${file} has one dont and one do, and renders the same anywhere`, () => {
      const html = readFileSync(join(dir, file), 'utf8');
      const id = file.replace(/\.html$/, '');
      expect(html.startsWith(`<!-- ${id} · `), 'first line names the rule').toBe(true);
      expect((html.match(/<figure data-example="dont">/g) ?? []).length).toBe(1);
      expect((html.match(/<figure data-example="do">/g) ?? []).length).toBe(1);
      expect((html.match(/<\/figure>/g) ?? []).length).toBe(2);
      expect(html.indexOf('data-example="dont"')).toBeLessThan(html.indexOf('data-example="do"'));
      const unsafe = /<(script|style|link|iframe|object|embed)\b|\son[a-z]+\s*=|(?:src|href)\s*=\s*["']?\s*(?:https?:|\/\/|javascript:)|url\(\s*["']?\s*(?:https?:|\/\/)/i.exec(html);
      expect(unsafe?.[0], 'a figure renders in a sandbox, so it carries no script, stylesheet or external URL').toBeUndefined();
      expect(html.length, 'an example is a specimen, not a page').toBeLessThan(6000);
    });
  }
});
