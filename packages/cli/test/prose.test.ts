import { describe, it, expect } from 'vitest';
import { formulaPhrase, headingEmoji } from '../src/check/detectors/prose.js';
import type { DetectorContext } from '../src/check/types.js';

const ctx = (raw: string, ruleId: string) =>
  ({ ruleId, bucket: 'hybrid', severity: 'warning', tokens: {}, projectParticipates: true, raw } as DetectorContext);
const formula = (raw: string, file = 'page.html') => formulaPhrase.run('', file, ctx(raw, 'I-150'));
const emoji = (raw: string, file = 'src/content/docs/start.md') => headingEmoji.run('', file, ctx(raw, 'I-155'));

describe('formula-phrase (I-150)', () => {
  it('reports a formula opener in page text, on its line', () => {
    const f = formula('<main>\n  <p>In today\'s fast-paced world, teams ship daily.</p>\n</main>');
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(2);
    expect(f[0].message).toMatch(/formula phrase \("In today's fast-paced"\)/);
  });

  it('knows the signposts and closers, in either apostrophe', () => {
    expect(formula('<p>It is important to note that the plan renews.</p>')).toHaveLength(1);
    expect(formula('<p>It’s worth noting the limit.</p>')).toHaveLength(1);
    expect(formula('<p>Let’s dive in.</p>')).toHaveLength(1);
    expect(formula('<p>In conclusion, it works.</p>')).toHaveLength(1);
    expect(formula('<p>Only time will tell.</p>')).toHaveLength(1);
  });

  it('reads Markdown a page is built from', () => {
    expect(formula('# Setup\n\nHere\'s the thing: it installs once.\n', 'src/content/docs/setup.md')).toHaveLength(1);
  });

  it('leaves ordinary uses of the same words alone', () => {
    expect(formula('<p>Today\'s builds ran in 40 seconds.</p>')).toHaveLength(0);
    expect(formula('<p>Note the limit before you start.</p>')).toHaveLength(0);
    expect(formula('<p>Dive sites near Accra</p>')).toHaveLength(0);
  });

  // A quotation is the source's words, as I-118 has it.
  it('leaves quotations, code and comments alone', () => {
    expect(formula('<blockquote>In conclusion, we can see the answer is yes.</blockquote>')).toHaveLength(0);
    expect(formula('<p>They wrote <q>let\'s dive in</q> on every page.</p>')).toHaveLength(0);
    expect(formula('> In conclusion, it was fine.\n', 'src/content/blog/post.md')).toHaveLength(0);
    expect(formula('Run `in conclusion` as a test.\n', 'src/content/docs/a.md')).toHaveLength(0);
    expect(formula('<!-- in conclusion -->\n<p>fine</p>')).toHaveLength(0);
  });

  it('does not read repository documents', () => {
    expect(formulaPhrase.appliesTo('README.md')).toBe(false);
    expect(formulaPhrase.appliesTo('src/content/blog/post.md')).toBe(true);
  });
});

describe('heading-emoji (I-155)', () => {
  it('reports an emoji in a Markdown heading', () => {
    const f = emoji('# Start\n\n## 🚀 Getting started\n\nText.\n');
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(3);
    expect(f[0].message).toMatch(/emoji in a heading \("🚀"\)/);
  });

  it('leaves an emoji outside a heading, and typographic marks, alone', () => {
    expect(emoji('## Getting started\n\nShip it 🚀\n')).toHaveLength(0);
    expect(emoji('## Next → the loop\n')).toHaveLength(0);
  });

  it('does not read a heading inside a code sample', () => {
    expect(emoji('```md\n## 🚀 Getting started\n```\n')).toHaveLength(0);
  });

  // A-05 reports every emoji in markup, headings included: one glyph, one finding.
  it('reads only what A-05 does not', () => {
    expect(headingEmoji.appliesTo('src/content/docs/start.md')).toBe(true);
    expect(headingEmoji.appliesTo('src/pages/index.astro')).toBe(false);
    expect(headingEmoji.appliesTo('src/content/docs/start.mdx')).toBe(false);
    expect(headingEmoji.appliesTo('README.md')).toBe(false);
  });
});
