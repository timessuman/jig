import { describe, it, expect } from 'vitest';
import { formatReport } from '../src/check/report.js';

/**
 * `check` reads plain stylesheets only (`.css`, `.scss`, `.less`) — a
 * deliberate scope, since separating style text from application code in
 * `.tsx`/`.vue`/`.astro` needs real parsing and a regex would either miss most
 * of it or false-positive on unrelated code.
 *
 * The scope is defensible. Staying silent about it is not. A Tailwind v4
 * project whose stylesheet imports the tokens — so it *does* participate in the
 * token layer, suppressing the existing "H-47 was not run" notice — while every
 * actual value lives in `className="bg-[#6D28D9] p-[13px]"` gets:
 *
 *     No findings.
 *     0 errors · 104 rules, 0 fired
 *
 * A clean bill of health for a project where nothing was examined. The report
 * must say what it did not look at.
 */
describe('the check report names what it could not scan', () => {
  it('says so when styling-bearing files were skipped', () => {
    const report = formatReport([], {
      totalRules: 104,
      version: '0.4.0',
      mode: 'product',
      unscanned: { count: 3, extensions: ['.tsx', '.vue'] },
    });
    expect(report).toMatch(/\.tsx/);
    expect(report).toMatch(/3/);
    // And it must not read as an unqualified clean result.
    expect(report).toMatch(/not scanned|did not scan|invisible/i);
  });

  it('stays quiet when there is nothing unscanned to report', () => {
    const report = formatReport([], { totalRules: 104, version: '0.4.0', mode: 'product' });
    expect(report).not.toMatch(/not scanned/i);
  });
});

describe('the summary line does not understate the system', () => {
  it('names the specs alongside the indexed rule count', () => {
    // "104 rules, 1 fired" is the INDEXED rule count, and reads as the whole
    // system. It is not: 14 pattern and mode specs are citable too, and sit
    // outside the index by design. Saying so costs a clause and stops the
    // report implying that `P-06` is not a real rule.
    const report = formatReport([], {
      totalRules: 104,
      totalSpecs: 14,
      version: '0.4.0',
      mode: 'product',
    });
    expect(report).toContain('104 rules');
    expect(report).toMatch(/14 (pattern and mode )?specs/);
  });

  it('says only the rule count when there are no specs to mention', () => {
    const report = formatReport([], { totalRules: 104, version: '0.4.0', mode: 'product' });
    expect(report).toContain('104 rules');
    expect(report).not.toMatch(/specs/);
  });
});
