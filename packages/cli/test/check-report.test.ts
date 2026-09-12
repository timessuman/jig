import { describe, it, expect } from 'vitest';
import { formatReport } from '../src/check/report.js';
import type { Finding } from '../src/check/types.js';

const f = (over: Partial<Finding>): Finding => ({
  ruleId: 'E-29',
  detector: 'focus-removed',
  bucket: 'mechanical',
  severity: 'error',
  file: 'src/Dialog.tsx',
  line: 44,
  message: 'Focus removed without replacement',
  ...over,
});

describe('formatReport', () => {
  it('reports zero findings cleanly with a pass attestation', () => {
    const out = formatReport([], { totalRules: 104, version: '0.2.1' });
    expect(out).toContain('No findings.');
    expect(out).toContain('0 errors');
    expect(out).toContain('104 rules, 0 fired');
    expect(out).toContain('mechanical=pass:0');
    expect(out).toContain('judgment=not-run');
  });

  it('counts errors/warnings and rules fired, and reports mechanical fail count', () => {
    const findings = [
      f({ ruleId: 'E-29', severity: 'error', bucket: 'mechanical' }),
      f({ ruleId: 'H-47', severity: 'error', bucket: 'mechanical', detector: 'hardcoded-value' }),
      f({ ruleId: 'A-01', severity: 'warning', bucket: 'hybrid', detector: 'violet-band-hue' }),
    ];
    const out = formatReport(findings, { totalRules: 104, version: '0.2.1' });
    expect(out).toContain('2 errors, 1 warning');
    expect(out).toContain('104 rules, 3 fired');
    expect(out).toContain('mechanical=fail:2');
  });

  it('adds the explain hint only on the first occurrence of a given rule id', () => {
    const findings = [
      f({ ruleId: 'H-47', line: 10 }),
      f({ ruleId: 'H-47', line: 20 }),
    ];
    const out = formatReport(findings, { totalRules: 104, version: '0.2.1' });
    const hintCount = out.split('see rule H-47').length - 1;
    expect(hintCount).toBe(1);
  });

  it('tags the bucket on each row without foregrounding it', () => {
    const out = formatReport([f({})], { totalRules: 104, version: '0.2.1' });
    expect(out).toContain('[mechanical]');
  });
});

/**
 * A clean report must say what it examined.
 *
 * `0 errors · 104 rules, 0 fired` is what a project with forty components and
 * no violations prints. It is also, byte for byte, what a project containing a
 * single empty stylesheet and no markup prints. Nothing in the output separates
 * "found nothing wrong" from "had nothing to look at".
 *
 * That is not hypothetical: it was misread that way while building Jig's own
 * documentation site, where a green `check` was cited as evidence the work was
 * sound. The project had no authored UI at the time — three generated token
 * files and Astro's stock index page. The detectors ran over nothing and said
 * so in language indistinguishable from success.
 *
 * Same failure as the token audit going quiet when the token layer moved, and
 * as `check-tokens` rule 6 silently covering 77% of what it claimed: silence
 * that reads as a pass.
 */
describe('the report says what it looked at', () => {
  it('names the file count beside the rule count', () => {
    const out = formatReport([], { totalRules: 104, version: '0.7.1', scanned: 41, withStyles: 12 });
    expect(out).toMatch(/41 files/);
  });

  it('separates files that carried styles from files merely opened', () => {
    // `.ts` is style-bearing by extension but a parser contains no styles. The
    // count that matters to a reader is how many had anything to inspect.
    const out = formatReport([], { totalRules: 104, version: '0.7.1', scanned: 41, withStyles: 4 });
    expect(out).toMatch(/4 .*styl/i);
  });

  it('says plainly when there was nothing to inspect', () => {
    const out = formatReport([], { totalRules: 104, version: '0.7.1', scanned: 41, withStyles: 0 });
    expect(out).toMatch(/no file|nothing/i);
    // And must not let that read as a pass.
    expect(out).not.toMatch(/^\s*No findings\.\s*$/m);
  });

  it('carries the counts into the JIG_CHECK record', () => {
    const out = formatReport([], { totalRules: 104, version: '0.7.1', scanned: 41, withStyles: 4 });
    expect(out).toMatch(/JIG_CHECK:.*files=41/);
    expect(out).toMatch(/JIG_CHECK:.*styled=4/);
  });
});

/**
 * A narrowed run must not read like a full one.
 *
 * `check` defaults to the files changed since HEAD and falls back to the whole
 * repo when that diff is empty, so `files=` describes a different population
 * depending on whether the tree is dirty — and nothing in the output said so.
 * A consumer compared two `JIG_CHECK:` lines from the same repo, saw three of
 * six fields move with nothing committed, and had to bisect by reverting files
 * one at a time to work out why.
 */
describe('the report states which population it scanned', () => {
  const base = { totalRules: 104, version: '0.8.2', scanned: 9, withStyles: 3 };

  it('names the scope in the summary when the run was narrowed', () => {
    const out = formatReport([], { ...base, scope: 'changed' as const });
    expect(out).toContain('9 files changed since HEAD');
    expect(out).toContain("jig check --all");
  });

  it('says a clean narrowed run is not a clean project', () => {
    const out = formatReport([], { ...base, scope: 'changed' as const });
    expect(out).toMatch(/nothing in your diff fired, not that the project is clean/);
  });

  it('does not add the caveat to a whole-repo run', () => {
    const out = formatReport([], { ...base, scope: 'all' as const });
    expect(out).toContain('9 files, 3 with styles');
    expect(out).not.toContain('changed since HEAD');
    expect(out).not.toMatch(/not that the project is clean/);
  });

  /**
   * The exempt note is advice, and on a narrowed run it was wrong advice:
   * a correct, tracked path that matched nothing among the changed files was
   * reported as a path to go and debug.
   */
  it('does not tell you to check a path that is fine, on a narrowed run', () => {
    const out = formatReport([], {
      ...base,
      scope: 'changed' as const,
      exempt: [],
      exemptPatterns: [{ pattern: 'src/content/rules.ts', count: 0, tooBroad: false }],
    });
    expect(out).toContain('matches nothing among the changed files');
    expect(out).not.toContain('check the path');
  });

  it('still says check the path when the whole repo was scanned', () => {
    const out = formatReport([], {
      ...base,
      scope: 'all' as const,
      exempt: [],
      exemptPatterns: [{ pattern: 'src/typo.ts', count: 0, tooBroad: false }],
    });
    // Here the advice is right: nothing in the repo matches, so the glob is wrong.
    expect(out).toContain('check the path');
  });
});
