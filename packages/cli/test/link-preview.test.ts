import { describe, it, expect } from 'vitest';
import { metadata } from '../src/check/detectors/metadata.js';
import { readMetadata } from '../src/check/metadata.js';
import { probeCheck, type ProbeResult } from '../src/probe/check.js';
import type { DetectorContext } from '../src/check/types.js';

/**
 * J-164: what a link preview reads. A page pasted into a chat or a post is met
 * as a card before anyone opens it, and a card is built from `og:title` and
 * `og:description`. Without them each service guesses, from whatever the page
 * happens to carry.
 */
const run = (raw: string, mode = 'editorial', file = 'page.html') =>
  metadata.run('', file, { ruleId: 'J-164', bucket: 'mechanical', severity: 'warning', tokens: {}, projectParticipates: true, raw, mode } as DetectorContext);
const doc = (head: string) => `<!doctype html><html><head><title>Pricing</title><meta name="description" content="Three plans.">${head}</head><body><main>x</main></body></html>`;

describe('J-164 in a file that writes its own head', () => {
  it('reports an indexable document with no preview title or description', () => {
    expect(run(doc(''))[0]?.message).toMatch(/no link preview/);
    expect(run(doc('<meta property="og:title" content="Pricing">'))[0]?.message).toMatch(/og:description/);
  });

  it('passes a document that states both', () => {
    expect(run(doc('<meta property="og:title" content="Pricing"><meta property="og:description" content="Three plans.">'))).toEqual([]);
  });

  it('leaves a page after sign-in alone, and a file whose layout writes the head', () => {
    expect(run(doc(''), 'product')).toEqual([]);
    expect(run('export default function Page() { return <main>x</main>; }', 'editorial', 'page.tsx')).toEqual([]);
  });

  it('reads previews declared the way frameworks declare them', () => {
    expect(readMetadata('export const metadata = { openGraph: { title: "Pricing", description: "Three plans." } };').hasPreview).toBe(true);
    expect(readMetadata('useSeoMeta({ ogTitle: "Pricing", ogDescription: "Three plans." })').hasPreview).toBe(true);
    expect(readMetadata('<meta property="og:title" content="Pricing">').hasPreview).toBe(false);
  });
});

describe('J-164 in a head fragment that writes its own description', () => {
  const tag = '<meta name="description" content="Three plans." />';

  it('reports a description with no og:description, in every shape a page writes its head', () => {
    for (const [file, raw] of [
      ['+page.svelte', `<svelte:head><title>Pricing</title>${tag}</svelte:head><main>x</main>`],
      ['pricing.astro', `---\n---\n<Layout><Fragment slot="head">${tag}</Fragment></Layout>`],
      ['Pricing.tsx', `import Head from 'next/head';\nexport default () => <><Head>${tag}</Head><main>x</main></>;`],
      ['Pricing.vue', `<template><Head>${tag}</Head><main>x</main></template>`],
    ]) {
      expect(run(raw!, 'editorial', file!)[0]?.message, file).toMatch(/no og:description or og:title/);
    }
  });

  it('passes a fragment that states the preview too', () => {
    expect(run(`<svelte:head>${tag}<meta property="og:title" content="Pricing" /><meta property="og:description" content="Three plans." /></svelte:head>`, 'editorial', '+page.svelte')).toEqual([]);
  });

  it('leaves alone a layout that fills the description from a value, and a page after sign-in', () => {
    expect(run('<svelte:head><meta name="description" content={description} /></svelte:head>', 'editorial', '+layout.svelte')).toEqual([]);
    expect(run(`<svelte:head>${tag}</svelte:head>`, 'product', '+page.svelte')).toEqual([]);
  });
});

describe('J-164 on the rendered page', () => {
  const probe = (head: Partial<NonNullable<ProbeResult['head']>>): ProbeResult => ({
    jigProbe: 9, width: 360, sidewaysScroll: false, scrollWidth: 360, clientWidth: 360,
    defaultFont: false, unresolvedTokens: [], junkText: [], brokenImages: 0, navLinksVisible: 5, menu: null,
    head: { title: 'Pricing', description: 'Three plans.', canonical: '', robots: '', ogTitle: '', ogImage: '', ...head },
  });
  const none = () => undefined;

  it('fails a served page with no preview title or description', () => {
    expect(probeCheck([probe({ ogDescription: '' })], none).failures.join('\n')).toMatch(/J-164/);
    expect(probeCheck([probe({ ogTitle: 'Pricing', ogDescription: '' })], none).failures.join('\n')).toMatch(/og:description/);
  });

  it('passes a page that serves both, and one that must not be indexed', () => {
    expect(probeCheck([probe({ ogTitle: 'Pricing', ogDescription: 'Three plans.' })], none).failures).toEqual([]);
    expect(probeCheck([probe({ ogDescription: '' })], none, false).failures.join('\n')).not.toMatch(/J-164/);
  });

  // A probe taken before the probe read og:description cannot say it is missing.
  it('says nothing of a description an older probe never read', () => {
    expect(probeCheck([probe({ ogTitle: 'Pricing' })], none).failures).toEqual([]);
  });
});
