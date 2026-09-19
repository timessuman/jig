import { describe, it, expect } from 'vitest';
import { metadata } from '../src/check/detectors/metadata.js';
import { readMetadata } from '../src/check/metadata.js';
import type { DetectorContext } from '../src/check/types.js';

const run = (raw: string, ruleId: string, mode?: string, file = 'page.html') =>
  metadata.run('', file, { ruleId, bucket: 'mechanical', severity: 'error', tokens: {}, projectParticipates: true, raw, mode } as DetectorContext);

const doc = (head: string, mode = '') => `<!doctype html><html><head>${head}</head><body><main>x</main></body></html>`;

/**
 * Metadata is a `<meta>` tag in one framework and a `metadata` export, a
 * `useSeoMeta` call, a `<svelte:head>` block, a `meta` export or front matter
 * in the others — and a page may inherit all of it from a layout.
 */
describe('readMetadata across frameworks', () => {
  it('reads a plain document', () => {
    const m = readMetadata('<title>Pricing</title><meta name="description" content="Three plans.">');
    expect(m.title?.value).toBe('Pricing');
    expect(m.description?.value).toBe('Three plans.');
  });

  it('reads a Next metadata export', () => {
    const m = readMetadata('export const metadata = {\n  title: "Pricing",\n  description: "Three plans.",\n};');
    expect(m.title?.value).toBe('Pricing');
    expect(m.description?.value).toBe('Three plans.');
    expect(m.declares).toBe(true);
  });

  it('reads Nuxt useSeoMeta, a Remix meta export and SvelteKit head', () => {
    expect(readMetadata("useSeoMeta({ title: 'Pricing', ogDescription: 'Three plans.' })").title?.value).toBe('Pricing');
    expect(readMetadata("export const meta = () => [{ title: 'Pricing' }];").declares).toBe(true);
    expect(readMetadata('<svelte:head><title>Pricing</title></svelte:head>').title?.value).toBe('Pricing');
  });

  it('reads front matter, and ignores an interpolated value it cannot resolve', () => {
    expect(readMetadata('---\ntitle: "Pricing"\ndescription: "Three plans."\n---\n').description?.value).toBe('Three plans.');
    expect(readMetadata('export const metadata = { title: `${site.name} — Pricing` };').title).toBeUndefined();
  });

  it('recognises noindex in every shape a framework offers', () => {
    for (const source of [
      '<meta name="robots" content="noindex, nofollow">',
      'export const metadata = { robots: { index: false, follow: false } };',
      "useSeoMeta({ robots: 'noindex' })",
      'res.setHeader("X-Robots-Tag", "noindex");',
    ]) expect(readMetadata(source).noindex, source).toBe(true);
    expect(readMetadata('<title>Pricing</title>').noindex).toBe(false);
  });
});

describe('metadata detector', () => {
  it('reports a title or description past its budget, whatever framework wrote it', () => {
    const long = 'Pricing for teams of every size, with seats, retention and daily ingest explained';
    expect(run(`export const metadata = { title: "${long}" };`, 'J-122', 'editorial', 'page.tsx')[0].message).toMatch(/is 81 characters, past the 60/);
    expect(run(doc(`<title>${long}</title>`), 'J-122', 'editorial')).toHaveLength(1);
  });

  it('reports a date generated at request time', () => {
    expect(run('export default function sitemap() { return [{ url: "/", lastModified: new Date() }]; }', 'J-125', 'editorial', 'sitemap.ts')[0].message)
      .toMatch(/false on every request/);
  });

  it('reports a whole document with no title or description', () => {
    const f = run(doc('<meta charset="utf-8">'), 'J-121', 'editorial');
    expect(f).toHaveLength(2);
    expect(f.map((x) => x.message).join(' ')).toMatch(/no <title>.*no meta description/s);
  });

  // A component or a route file may inherit every string from its layout.
  it('says nothing about absence in a file that is not a whole document', () => {
    expect(run('export default function Page() { return <main>x</main>; }', 'J-121', 'editorial', 'page.tsx')).toHaveLength(0);
  });

  it('requires noindex where somebody arrives signed in, and not elsewhere', () => {
    expect(run(doc('<title>Admin</title>'), 'J-123', 'product')[0].message).toMatch(/carries no noindex/);
    expect(run(doc('<title>Admin</title><meta name="robots" content="noindex">'), 'J-123', 'operator')).toHaveLength(0);
    expect(run(doc('<title>Pricing</title>'), 'J-123', 'editorial')).toHaveLength(0);
    expect(run(doc('<title>Pricing</title>'), 'J-123', undefined)).toHaveLength(0);
  });

  it('asks an indexable page for metadata, and a signed-in one for none', () => {
    expect(run(doc('<meta charset="utf-8">'), 'J-121', 'product')).toHaveLength(0);
  });
});

/**
 * jig-site's layout writes `<title>{title}</title>` and a conditional
 * description. The value is a runtime question; the title is plainly there.
 * Absence and value are different questions, and confusing them reported a
 * correct layout as having no title at all.
 */
describe('absence is not the same as an unreadable value', () => {
  it('sees a computed title and description as present', () => {
    const layout = '<html><head>{description && <meta name="description" content={description} />}<title>{title}</title></head><body><slot /></body></html>';
    expect(run(layout, 'J-121', 'editorial', 'BaseLayout.astro')).toHaveLength(0);
    const m = readMetadata(layout);
    expect(m.hasTitle).toBe(true);
    expect(m.title).toBeUndefined();
  });

  it('still reports a document that declares neither', () => {
    expect(run(doc('<meta charset="utf-8">'), 'J-121', 'editorial')).toHaveLength(2);
  });
});

// A spec wrote its per-page override as a sentence on the indexable line. The
// parser read no bare word, fell back to the mode, and a correct page was
// reported as contradicting J-123.
describe('a spec\'s indexable: is true or false', () => {
  it('reads true and false, quoted or not, and calls anything else unreadable', async () => {
    const { specIndexableField } = await import('../src/check/spec-shape.js');
    expect(specIndexableField('indexable: true')).toBe(true);
    expect(specIndexableField('indexable: "false"')).toBe(false);
    expect(specIndexableField('mode: operator')).toBe('absent');
    expect(specIndexableField('indexable: "/rules/ itself: true, overriding the default. Filtered: false."')).toBe('unreadable');
  });

  it('is a spec-shape problem when it is a sentence', async () => {
    const { specProblems } = await import('../src/check/spec-shape.js');
    const body = '---\nfeature: x\nsurface: x\nmode: operator\nindexable: "/rules/: true, because it is public"\nsizes:\nconfirmed: true\nmockup: approved\n---\n';
    expect(specProblems({ path: 's.spec.md', body }).some((p) => /indexable:.*neither true nor false/.test(p))).toBe(true);
  });
});
