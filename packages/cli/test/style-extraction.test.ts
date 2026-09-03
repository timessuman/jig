import { describe, it, expect } from 'vitest';
import { maskNonStyleRegions } from '../src/check/styles.js';

/**
 * The detector suite reads CSS. Most projects do not keep their CSS in `.css`
 * files: it lives in `<style>` blocks (Astro, Vue, Svelte, PHP, Django, ERB,
 * plain HTML), in `style="..."` and `style={{ }}` attributes, and in tagged
 * templates (styled-components, emotion).
 *
 * Rather than write a detector per host language, blank everything that is not
 * CSS and hand the result to the detectors unchanged. Two properties make that
 * safe:
 *
 * 1. **Positions are preserved.** Masked regions keep their newlines and become
 *    spaces, so a finding's line number points at the host file's real line —
 *    no offset mapping, and every existing detector keeps working untouched.
 * 2. **Application code is never seen as CSS.** Anything outside a style region
 *    is blanked, so a detector cannot fire on a hex colour in a data structure
 *    or a `px` inside a string.
 */
describe('maskNonStyleRegions', () => {
  const linesOf = (s: string) => s.split('\n').length;

  it('keeps a <style> block and blanks the markup around it', () => {
    const src = [
      '<div class="hero">#ff0000</div>',
      '<style>',
      '  .hero { color: #ff0000; }',
      '</style>',
      '<p>trailing</p>',
    ].join('\n');
    const out = maskNonStyleRegions(src, 'page.html');

    expect(out).toContain('.hero { color: #ff0000; }');
    // The identical literal in markup must not survive.
    expect(out.split('\n')[0].trim()).toBe('');
    expect(out.split('\n')[4].trim()).toBe('');
    expect(linesOf(out), 'line count must be preserved exactly').toBe(linesOf(src));
  });

  it('puts the CSS on the same line it was on in the host file', () => {
    const src = ['<template></template>', '<style scoped>', '.a { color: #abc; }', '</style>'].join('\n');
    const out = maskNonStyleRegions(src, 'App.vue');
    expect(out.split('\n')[2]).toContain('.a { color: #abc; }');
  });

  it('handles the style attribute in markup', () => {
    const src = '<div style="color: #123456; padding: 13px">x</div>';
    const out = maskNonStyleRegions(src, 'index.html');
    expect(out).toContain('color: #123456; padding: 13px');
    expect(out).not.toContain('<div');
  });

  it('handles a JSX style object', () => {
    const src = "export const A = () => <b style={{ color: '#d97706', height: 32 }}>hi</b>;";
    const out = maskNonStyleRegions(src, 'A.tsx');
    expect(out).toContain('#d97706');
    expect(out).not.toContain('export const');
  });

  it('handles styled-components and emotion tagged templates', () => {
    const src = [
      "import styled from 'styled-components';",
      'const Button = styled.button`',
      '  color: #6D28D9;',
      '  padding: 13px;',
      '`;',
      "const other = 'not css #ffffff';",
    ].join('\n');
    const out = maskNonStyleRegions(src, 'Button.ts');

    expect(out).toContain('color: #6D28D9;');
    expect(out).toContain('padding: 13px;');
    // A plain string literal elsewhere is application code, not CSS.
    expect(out).not.toContain('#ffffff');
    expect(linesOf(out)).toBe(linesOf(src));
  });

  it('handles the css`` helper and styled(Component)``', () => {
    const src = ['const a = css`color: #111;`;', 'const b = styled(Link)`color: #222;`;'].join('\n');
    const out = maskNonStyleRegions(src, 'x.tsx');
    expect(out).toContain('#111');
    expect(out).toContain('#222');
  });

  it('leaves a plain stylesheet completely untouched', () => {
    const src = '.a { color: #fff; }\n.b { padding: 13px; }\n';
    expect(maskNonStyleRegions(src, 'app.css')).toBe(src);
  });

  it('blanks a file with no style regions at all', () => {
    const src = 'const palette = { brand: "#6D28D9", size: 13 };\nexport default palette;\n';
    const out = maskNonStyleRegions(src, 'palette.ts');
    expect(out.trim()).toBe('');
    expect(linesOf(out)).toBe(linesOf(src));
  });

  it('is not fooled by a <style> mentioned inside a string', () => {
    const src = `const s = "<style>.x{color:#fff}</style>";\n`;
    const out = maskNonStyleRegions(src, 'a.ts');
    expect(out.trim()).toBe('');
  });

  it('handles the server-rendered markup family', () => {
    // ASP, ASP.NET, Razor, JSP, Phoenix, and the HTML-shaped template engines
    // are plain markup around a template syntax: their <style> blocks and
    // style attributes are exactly the ones already handled. Only the
    // indentation-based languages (Pug, Haml, Slim) genuinely need different
    // parsing, and they stay out.
    for (const file of [
      'Default.asp', 'Default.aspx', 'Ctrl.ascx', 'Site.master',
      'Index.cshtml', 'Index.vbhtml', 'Counter.razor',
      'index.jsp', 'page.jspx', 'view.eex', 'view.heex',
      'page.ejs', 'page.njk', 'page.liquid', 'page.mustache',
      'page.vm', 'page.ftl', 'page.jinja', 'page.jinja2', 'page.j2',
    ]) {
      const src = `<div style="color: #123456">x</div>\n<style>\n.a { padding: 13px; }\n</style>`;
      const out = maskNonStyleRegions(src, file);
      expect(out, `${file} style attribute`).toContain('#123456');
      expect(out, `${file} style block`).toContain('13px');
      expect(out, `${file} markup`).not.toContain('<div');
    }
  });

  it('still does not pretend to read indentation-based templates', () => {
    // Pug/Haml/Slim do not write `<style>`; treating them as markup would find
    // nothing and imply coverage that is not there. They are reported as
    // unscanned instead.
    const src = 'div(style="color: #123456")\n';
    expect(maskNonStyleRegions(src, 'page.pug').trim()).toBe('');
  });
});
