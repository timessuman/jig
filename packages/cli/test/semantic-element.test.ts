import { describe, it, expect } from 'vitest';
import { semanticElement } from '../src/check/detectors/semantic-element.js';
import type { DetectorContext } from '../src/check/types.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

const run = (raw: string, file = 'page.html') =>
  semanticElement.run('', file, { ruleId: 'H-119', bucket: 'mechanical', severity: 'warning', tokens: {}, projectParticipates: true, raw } as DetectorContext);

const page = (body: string) => `<!doctype html><html><head><title>t</title></head>\n<body>\n${body}\n</body></html>`;
const links = (n: number, wrap = (s: string) => s) =>
  wrap(Array.from({ length: n }, (_, i) => `<a href="/${i}">page ${i}</a>`).join('\n'));

describe('semantic-element (H-119)', () => {
  it('reports a page with no <main>', () => {
    const f = run(page('<div class="content"><h1>Pricing</h1></div>'));
    expect(f).toHaveLength(1);
    expect(f[0].message).toMatch(/no <main>/);
  });

  it('accepts <main>, and role="main" for a framework that writes one', () => {
    expect(run(page('<main><h1>Pricing</h1></main>'))).toHaveLength(0);
    expect(run(page('<div role="main"><h1>Pricing</h1></div>'))).toHaveLength(0);
  });

  it('reports navigation links in a generic container with no <nav>', () => {
    const f = run(page(`<header><div class="site-nav">${links(5)}</div></header><main>x</main>`));
    expect(f).toHaveLength(1);
    expect(f[0].message).toMatch(/no <nav> on the page/);
  });

  // arm3/css-1: five destinations in a header, no <nav> anywhere.
  it('reports a header full of links even when nothing is named "nav"', () => {
    const f = run(page(`<header><a href="/">Home</a>${links(4)}</header><main>x</main>`));
    expect(f[0].message).toMatch(/navigation landmark/);
  });

  // arm3/css-1: the header held a dead menu button, and the five destinations
  // sat in the footer with no <nav> anywhere on the page.
  it('reports a footer row of destinations with no <nav>', () => {
    const f = run(page(`<header><button>menu</button></header><main>x</main><footer>${links(5)}</footer>`));
    expect(f[0].message).toMatch(/the footer holds a row of links/);
  });

  it('says nothing when the page uses <nav>', () => {
    expect(run(page(`<header><nav>${links(5)}</nav></header><main>x</main>`))).toHaveLength(0);
    expect(run(page(`<header><div role="navigation">${links(5)}</div></header><main>x</main>`))).toHaveLength(0);
  });

  // A card, a layout, an island: no page assembles itself here.
  it('judges only files that assemble a page', () => {
    expect(run('<div class="card"><h3>Solo</h3><a href="/a">a</a><a href="/b">b</a><a href="/c">c</a></div>', 'Card.tsx')).toHaveLength(0);
  });

  it('does not call two links in a header a navigation landmark', () => {
    expect(run(page('<header><a href="/">Home</a><a href="/in">Sign in</a></header><main>x</main>'))).toHaveLength(0);
  });
});

describe('the procedures decide meaning before markup', () => {
  const t = readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');

  it('spec describes regions by content, not appearance', () => {
    expect(t).toMatch(/Regions say what the content is, not what it looks like/);
  });

  it('make chooses elements from meaning, and checks the page reads with the stylesheet off', () => {
    expect(t).toMatch(/Choose every element from what its content is, before styling any of it/);
    expect(t).toMatch(/read as what it is with the stylesheet off/);
  });

  it('critique reads the markup as a document, and does not invent a fault over a div', () => {
    expect(t).toMatch(/Read the markup as a document, not a layout/);
    expect(t).toMatch(/A `<div>` is right where nothing more specific is true/);
  });
});
