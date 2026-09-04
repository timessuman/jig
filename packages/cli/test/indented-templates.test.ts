import { describe, it, expect } from 'vitest';
import { maskNonStyleRegions } from '../src/check/styles.js';

/**
 * Pug, Haml and Slim were the last languages `check` reported as unscanned.
 * They do not write `<style>` or `style="…"` as markup, so the HTML-shaped
 * extraction found nothing in them.
 *
 * They do not need a full parser either. Both constructs that carry CSS are
 * findable without one:
 *
 *   - a filter/block marker (`style.`, `:css`, `css:`) followed by a region
 *     delimited by INDENTATION rather than a closing tag;
 *   - an inline style attribute, in each language's own attribute syntax.
 *
 * Everything else about the approach is unchanged: blank the rest, preserve
 * every character position, hand the result to the existing detectors.
 */
const linesOf = (s: string) => s.split('\n').length;

describe('Pug', () => {
  it('reads an indented style block', () => {
    const src = ['doctype html', 'style.', '  .hero { color: #123456; }', 'p Hello'].join('\n');
    const out = maskNonStyleRegions(src, 'page.pug');
    expect(out).toContain('.hero { color: #123456; }');
    expect(out).not.toContain('doctype');
    expect(out).not.toContain('Hello');
    expect(linesOf(out)).toBe(linesOf(src));
  });

  it('ends the block when indentation returns', () => {
    const src = ['style.', '  .a { color: #111111; }', 'p Not css #222222'].join('\n');
    const out = maskNonStyleRegions(src, 'page.pug');
    expect(out).toContain('#111111');
    expect(out).not.toContain('#222222');
  });

  it('reads an inline style attribute', () => {
    const src = 'div(class="hero", style="color: #123456; padding: 13px")';
    const out = maskNonStyleRegions(src, 'page.pug');
    expect(out).toContain('color: #123456; padding: 13px');
    expect(out).not.toContain('hero');
  });
});

describe('Haml', () => {
  it('reads a :css filter block', () => {
    const src = ['%h1 Title', ':css', '  .hero { color: #123456; }', '%p Body'].join('\n');
    const out = maskNonStyleRegions(src, 'page.haml');
    expect(out).toContain('.hero { color: #123456; }');
    expect(out).not.toContain('Title');
    expect(linesOf(out)).toBe(linesOf(src));
  });

  it('reads both hash attribute styles', () => {
    expect(maskNonStyleRegions('%div{style: "color: #123456"}', 'a.haml')).toContain('color: #123456');
    expect(maskNonStyleRegions('%div{:style => "color: #abcdef"}', 'a.haml')).toContain('color: #abcdef');
  });
});

describe('Slim', () => {
  it('reads a css: filter block', () => {
    const src = ['h1 Title', 'css:', '  .hero { color: #123456; }', 'p Body'].join('\n');
    const out = maskNonStyleRegions(src, 'page.slim');
    expect(out).toContain('.hero { color: #123456; }');
    expect(out).not.toContain('Title');
  });

  it('reads an inline style attribute', () => {
    const src = 'div style="color: #123456"';
    expect(maskNonStyleRegions(src, 'page.slim')).toContain('color: #123456');
  });
});

describe('the indentation rule is honoured, not approximated', () => {
  it('keeps a nested deeper-indented line inside the block', () => {
    const src = ['style.', '  .a {', '    color: #123456;', '  }', 'p done'].join('\n');
    const out = maskNonStyleRegions(src, 'page.pug');
    expect(out).toContain('color: #123456;');
    expect(out).not.toContain('done');
  });

  it('does not let a blank line end the block early', () => {
    const src = ['style.', '  .a { color: #111111; }', '', '  .b { color: #222222; }', 'p x'].join('\n');
    const out = maskNonStyleRegions(src, 'page.pug');
    expect(out).toContain('#111111');
    expect(out).toContain('#222222');
  });

  it('handles a block at the end of the file', () => {
    const src = ['p x', 'style.', '  .a { color: #123456; }'].join('\n');
    expect(maskNonStyleRegions(src, 'page.pug')).toContain('#123456');
  });

  it('never reads a template that has no style region at all', () => {
    const src = ['doctype html', 'p A colour in prose: #6D28D9', 'p size 13px'].join('\n');
    expect(maskNonStyleRegions(src, 'page.pug').trim()).toBe('');
  });
});
