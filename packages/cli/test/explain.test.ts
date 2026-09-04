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

  it('rejects something that is not a rule id at all', () => {
    expect(() => explain({ ruleId: 'not-an-id', version })).toThrow(/rule id/i);
  });
});
