import { describe, it, expect } from 'vitest';
import { emojiIcon } from '../src/check/detectors/emoji-icon.js';
import { placeholderContent } from '../src/check/detectors/placeholder-content.js';
import type { DetectorContext } from '../src/check/types.js';

/**
 * Three of the fourteen "generic-AI aesthetic" rules had detectors. The other
 * eleven were enforced by a single self-check question — "would this look
 * different from a generic template?" — which an agent that just produced a
 * generic template answers yes to.
 *
 * `A-05` and `A-10` are the two that were never judgment calls at all. An emoji
 * in a text node is a regex; so is "lorem ipsum". Jig's own documentation site
 * shipped `<span aria-hidden="true">❌</span> Don't` in its page chrome with
 * `jig check --all` reporting zero findings.
 */
const ctx = (over: Partial<DetectorContext> = {}): DetectorContext => ({
  ruleId: 'A-05', bucket: 'mechanical', severity: 'warning',
  tokens: {}, projectParticipates: true, raw: '', ...over,
} as DetectorContext);

const run = (d: typeof emojiIcon, raw: string, file = 'src/Card.tsx') =>
  d.run('', file, ctx({ raw }));

describe('A-05 — emoji as interface iconography', () => {
  it('fires on an emoji in markup', () => {
    expect(run(emojiIcon, '<h3>🚀 Fast deploys</h3>')).toHaveLength(1);
  });

  it('fires even when the emoji is marked decorative', () => {
    // aria-hidden makes it invisible to a screen reader; it does not make it
    // not an emoji icon. Jig's own site did exactly this.
    expect(run(emojiIcon, '<span aria-hidden="true">❌</span> Don\'t')).toHaveLength(1);
  });

  it('does not fire on ordinary prose, punctuation or arrows in text', () => {
    expect(run(emojiIcon, '<p>Costs £20 — about 25% less. See § 4.</p>')).toEqual([]);
  });

  it('does not fire inside a comment', () => {
    // Comments are masked for `source`, not for `raw`, so this detector must
    // skip them itself or every rule file quoting an emoji would fire.
    expect(run(emojiIcon, '// the ❌ marker in a rule\nconst x = 1;')).toEqual([]);
  });

  it('reports the line the emoji is on', () => {
    const f = run(emojiIcon, 'line one\nline two\n<b>✅ yes</b>');
    expect(f[0].line).toBe(3);
  });
});

describe('A-10 — placeholder content shipped', () => {
  it('fires on lorem ipsum', () => {
    expect(run(placeholderContent, '<p>Lorem ipsum dolor sit amet</p>')).toHaveLength(1);
  });

  it('fires on a placeholder company and domain', () => {
    expect(run(placeholderContent, '<a href="https://example.com">Acme Inc</a>').length)
      .toBeGreaterThan(0);
  });

  it('does not fire on prose that merely contains the word example', () => {
    expect(run(placeholderContent, '<p>For example, a button.</p>')).toEqual([]);
  });

  it('does not fire inside a comment', () => {
    expect(run(placeholderContent, '/* e.g. https://example.com */')).toEqual([]);
  });
});

import { marketingVoice } from '../src/check/detectors/marketing-voice.js';

/**
 * A-09 is the first rule whose violation depends on the mode.
 *
 * "Supercharge your workflow" is correct on a landing page and wrong on an
 * internal dashboard, so a detector that fired everywhere would be wrong on
 * every marketing site — and a detector that is wrong half the time is one
 * people switch off, taking the rest with it.
 */
const inMode = (mode: string | undefined, raw: string) =>
  marketingVoice.run('', 'src/Dashboard.tsx', ctx({ ruleId: 'A-09', raw, mode }));

describe('A-09 — marketing voice in an application', () => {
  it('fires in product mode', () => {
    expect(inMode('product', '<h1>Supercharge your workflow</h1>')).toHaveLength(1);
  });

  it('fires in operator mode', () => {
    expect(inMode('operator', '<p>Unleash the power of your data</p>')).toHaveLength(1);
  });

  it('stays silent in editorial mode, where it is the correct register', () => {
    expect(inMode('editorial', '<h1>Supercharge your workflow</h1>')).toEqual([]);
  });

  it('stays silent when no mode is declared, rather than guessing', () => {
    expect(inMode(undefined, '<h1>Supercharge your workflow</h1>')).toEqual([]);
  });

  it('does not fire on ordinary application copy', () => {
    expect(inMode('product', '<p>Your export is ready. Download it below.</p>')).toEqual([]);
  });

  it('does not fire inside a comment', () => {
    expect(inMode('product', '// TODO: supercharge this query')).toEqual([]);
  });
});
