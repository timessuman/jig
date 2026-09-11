import { describe, it, expect } from 'vitest';
import { explain } from '../src/commands/explain.js';

/**
 * `explain <rule-id>` closes the loop when a rule fires. `check` prints
 * "✗ C-19 Grey text below contrast floor … (see rule C-19 in your installed jig
 * skill's rules/)", which sends the reader off to open a file and find the
 * section. This prints it.
 *
 * It must cover everything an agent can cite. The `A`–`I` rules are indexed
 * with a ❌/✅ pair; the `P-` pattern specs and `M-` mode specs are neither
 * indexed nor parsed as rules, but agents cite them constantly — every baseline
 * run in this release cited `P-02`, `P-05` or `P-06`. An `explain` that said
 * "unknown rule" for those would be wrong about its own system.
 */
const version = '0.4.0';

describe('explain — indexed rules', () => {
  it('prints the rule, its correction, and the version it arrived in', () => {
    const out = explain({ ruleId: 'C-19', version });
    expect(out).toContain('C-19');
    expect(out).toContain('Grey text below contrast floor');
    expect(out).toMatch(/❌/);
    expect(out).toMatch(/✅/);
    expect(out).toContain('0.1.0');
    // Where to read more.
    expect(out).toContain('00-anti-patterns.md');
  });

  it('states the bucket, so the reader knows who checks it', () => {
    expect(explain({ ruleId: 'C-19', version })).toMatch(/mechanical/);
    expect(explain({ ruleId: 'I-84', version })).toMatch(/judgment/);
  });

  it('names the detector for a rule the CLI can check', () => {
    expect(explain({ ruleId: 'C-19', version })).toContain('contrast-floor');
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(explain({ ruleId: ' c-19 ', version })).toContain('C-19');
  });
});

describe('explain — pattern and mode specs (M10)', () => {
  it('explains a pattern spec that no rule index contains', () => {
    const out = explain({ ruleId: 'P-02', version });
    expect(out).toContain('P-02');
    expect(out).toContain('Button');
    expect(out).toContain('03-patterns.md');
  });

  it('explains a mode spec', () => {
    const out = explain({ ruleId: 'M-03', version });
    expect(out).toContain('M-03');
    expect(out).toContain('operator');
    expect(out).toContain('01-modes.md');
  });

  it('says a spec is a specification rather than dressing it as a rule', () => {
    // A spec's own prose may well contain ❌/✅ examples — P-06 does — so the
    // check is not "no ❌ anywhere". It is that `explain` does not present the
    // spec in the rule shape it lacks: no bucket/severity line, no detector,
    // and it says outright what kind of thing this is.
    const out = explain({ ruleId: 'P-06', version });
    expect(out).toMatch(/specification/i);
    expect(out).not.toMatch(/mechanical|judgment|hybrid/);
    expect(out).not.toMatch(/detector:/);
  });
});

describe('explain — unknown ids', () => {
  it('refuses an id that does not exist, and suggests near misses', () => {
    expect(() => explain({ ruleId: 'C-999', version })).toThrow(/C-999/);
  });

  it('points at the section when the letter is real but the number is not', () => {
    expect(() => explain({ ruleId: 'C-999', version })).toThrow(/C-\d+/);
  });

  it('treats a non-id as a search term, and says so when it finds nothing', () => {
    // This used to throw "is not a rule id". It is a better answer to search
    // for it and report the empty result: 'not-an-id' is not malformed input,
    // it is a query with no hits, and the reader needs a way forward either way.
    expect(() => explain({ ruleId: 'not-an-id', version })).toThrow(/no rule matches/i);
    expect(() => explain({ ruleId: 'not-an-id', version })).toThrow(/--list/);
  });
});

/**
 * `explain` answered exactly one question: "I have an id, what is it?" That
 * closes the loop after `check` prints a finding, and nothing else.
 *
 * The other direction had no answer at all. An agent told to "review the colour
 * decisions here" holds no id, and `explain contrast` returned "not a rule id"
 * — the tool that knows every rule refusing to say which ones exist. For a
 * system whose whole premise is that an agent reads it, that is the more
 * important direction of the two.
 */
describe('explain — finding a rule you cannot name', () => {
  it('searches titles when given a word rather than an id', () => {
    const out = explain({ ruleId: 'contrast', version });
    expect(out).toContain('C-19');
    expect(out).toContain('Grey text below contrast floor');
  });

  it('searches rule bodies too, not just titles', () => {
    // "placeholder" appears in C-19's correction, not its title.
    expect(explain({ ruleId: 'placeholder', version })).toContain('C-19');
  });

  it('prints the whole rule when the search finds exactly one', () => {
    // One hit is not ambiguous, so answer the question rather than making the
    // reader run a second command to get the same rule.
    const out = explain({ ruleId: 'hamburger', version });
    expect(out).toMatch(/❌/);
    expect(out).toMatch(/✅/);
    expect(out).toMatch(/detector:|judgment|mechanical|hybrid/);
  });

  it('lists matches compactly when there are several', () => {
    const out = explain({ ruleId: 'colour', version });
    expect(out.split('\n').length, 'a multi-match result dumped full rule text')
      .toBeLessThan(60);
    expect(out).toMatch(/[A-Z]-\d+/);
  });

  it('finds specs as well as rules', () => {
    expect(explain({ ruleId: 'ambient', version })).toContain('P-13');
  });

  it('says so plainly when a search finds nothing', () => {
    expect(() => explain({ ruleId: 'kubernetes', version })).toThrow(/no rule|nothing/i);
  });
});

describe('explain — listing', () => {
  it('lists every rule when asked for the list', () => {
    const out = explain({ ruleId: '', version, list: true });
    expect(out).toContain('C-19');
    expect(out).toContain('P-13');
    expect(out).toContain('A-01');
  });

  it('lists one section when given a section letter', () => {
    const out = explain({ ruleId: 'G', version, list: true });
    expect(out).toContain('G-42');
    expect(out).not.toContain('C-19');
  });
});

describe('explain — forgiving input', () => {
  it('accepts an id with the hyphen missing', () => {
    // An agent citing "C19" has made a one-character typo with exactly one
    // possible meaning. Refusing it teaches nothing.
    expect(explain({ ruleId: 'C19', version })).toContain('Grey text below contrast floor');
  });

  it('still rejects something that is neither an id nor a match', () => {
    expect(() => explain({ ruleId: 'zzzz', version })).toThrow();
  });
});

describe('explain shows the reasoning, not just the pair', () => {
  it('prints the prose A-04 ships after its correction', () => {
    // Shipped in the tarball, installed into every skill directory, and
    // invisible through the command built to read it.
    // Not 'neumorphism' — that is in the ❌ line and would pass without the
    // fix. 'Experiment freely' exists only in the prose explain was dropping.
    expect(explain({ ruleId: 'A-04', version })).toContain('Experiment freely');
  });

  it('does not invent a notes section for a rule with no prose', () => {
    const out = explain({ ruleId: 'A-02', version });
    const afterCorrection = out.slice(out.indexOf('✅'));
    expect(afterCorrection.split('\n').filter((l) => l.trim() && !l.includes('·') && !l.includes('since')))
      .toHaveLength(1);
  });
});

/**
 * Some rules carry their substance BEFORE the ❌/✅ pair.
 *
 * `C-49` opens with two paragraphs and a three-row table setting out when a
 * link needs colour, when it needs an underline, and when neither is required.
 * Its ❌/✅ pair alone says "keep the underline" and omits every case the table
 * exists to distinguish. Collecting only the prose AFTER the correction left
 * that unreachable — a half-fix that looked complete because the rules with the
 * most prose happen to carry it at the end.
 */
describe('prose before the pair', () => {
  it('shows the table C-49 leads with', () => {
    const out = explain({ ruleId: 'C-49', version });
    expect(out).toContain('Colour-blind users cannot separate');
    expect(out).toContain('Underline, no colour');
  });

  it('keeps source order — preamble above the pair, notes below', () => {
    const out = explain({ ruleId: 'C-49', version });
    const preamble = out.indexOf('Colour-blind users cannot separate');
    // indexOf returns -1 when absent, which is trivially less than anything —
    // without this the assertion below passes on a missing preamble.
    expect(preamble).toBeGreaterThan(-1);
    expect(preamble).toBeLessThan(out.indexOf('❌'));
  });
});

