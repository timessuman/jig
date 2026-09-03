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
