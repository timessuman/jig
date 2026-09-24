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
      // Real tags only: a code sample showing `onclick=` as escaped text is
      // text, and it is the point of the sample.
      const tags = (html.match(/<[a-z][^>]*>/gi) ?? []).join('\n');
      const unsafe = /<(script|style|link|iframe|object|embed)\b|\son[a-z]+\s*=|(?:src|href)\s*=\s*["']?\s*(?:https?:|\/\/|javascript:)|url\(\s*(?:&quot;|["'])?\s*(?:https?:|\/\/)/i.exec(tags);
      expect(unsafe?.[0], 'a figure renders in a sandbox, so it carries no script, stylesheet or external URL').toBeUndefined();
      expect(html.length, 'an example is a specimen, not a page').toBeLessThan(6000);
    });
  }
});

describe('explain names the example', () => {
  it('prints where a rule\'s example is', async () => {
    const { explain } = await import('../src/commands/explain.js');
    const out = explain({ ruleId: 'A-139', version: 't', packageRoot: repoRoot });
    expect(out).toMatch(/Example: .*examples\/A-139\.html/);
  });
});

// A consumer draws each figure in a 320px frame. The README once promised a
// height every figure then broke: a docs site sized its frames from it, one
// "instead" ran 363px wide and cut its own button off, and another stood 288px
// tall in a frame drawn for less. Measured in a real browser, every figure.
describe('every example fits the frame the README promises', () => {
  it('is at most 320px wide and 260px tall', async () => {
    const { findChrome, runProbe } = await import('../src/probe/browser.js');
    if (!findChrome()) return;
    const { mkdtempSync: tmp, writeFileSync: write } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const boxes = files.flatMap((file) => {
      const html = readFileSync(join(dir, file), 'utf8');
      return ['dont', 'do'].map((kind) => {
        const inner = new RegExp(`<figure data-example="${kind}">([\\s\\S]*?)</figure>`).exec(html)?.[1] ?? '';
        return `<div class="box" data-id="${file.replace(/\.html$/, '')}/${kind}" style="width:320px;margin:0 0 24px">${inner}</div>`;
      });
    });
    const page = join(tmp(join(tmpdir(), 'jig-examples-')), 'all.html');
    write(page, `<!doctype html><body style="margin:0">${boxes.join('')}</body>`);
    const measured = JSON.parse(await runProbe({
      url: `file://${page}`, width: 1000, expression:
        `JSON.stringify([...document.querySelectorAll('.box')].map((b) => ({ id: b.dataset.id, w: b.scrollWidth, h: Math.round(b.getBoundingClientRect().height) })))`,
    })) as Array<{ id: string; w: number; h: number }>;
    expect(measured).toHaveLength(files.length * 2);
    expect(measured.filter((m) => m.w > 320).map((m) => `${m.id} ${m.w}px wide`)).toEqual([]);
    expect(measured.filter((m) => m.h > 260).map((m) => `${m.id} ${m.h}px tall`)).toEqual([]);
  }, 120_000);
});
