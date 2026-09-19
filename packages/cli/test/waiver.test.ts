import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyWaivers, readWaiver } from '../src/check/waiver.js';
import type { Finding } from '../src/check/types.js';

describe('readWaiver', () => {
  it('reads the id and reason in any comment syntax, without the closer', () => {
    expect(readWaiver('/* jig-allow A-01: the brand is violet, declared in DECISIONS.md */')).toEqual({ ids: ['A-01'], reason: 'the brand is violet, declared in DECISIONS.md' });
    expect(readWaiver('<!-- jig-allow I-118: a quoted title keeps its dash -->')).toEqual({ ids: ['I-118'], reason: 'a quoted title keeps its dash' });
    expect(readWaiver('{/* jig-allow D-112: the hero is a full-screen video */}')?.reason).toBe('the hero is a full-screen video');
    expect(readWaiver('// jig-allow A-09, A-10: sample copy in a style guide page')).toEqual({ ids: ['A-09', 'A-10'], reason: 'sample copy in a style guide page' });
  });

  // A waiver nobody can read the case for is a silence, not a decision.
  it('is not a waiver without a reason', () => {
    expect(readWaiver('/* jig-allow A-01 */')).toBeUndefined();
    expect(readWaiver('/* jig-allow A-01: */')).toBeUndefined();
    expect(readWaiver('<!-- jig-allow I-118: -->')).toBeUndefined();
  });
});

describe('applyWaivers', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'jig-waiver-')); });
  const finding = (over: Partial<Finding>): Finding => ({
    ruleId: 'I-118', detector: 'em-dash', bucket: 'mechanical', severity: 'warning', file: 'a.html', line: 2, message: 'm', ...over,
  });

  it('waives a warning from its own line or the line above, and nothing else', () => {
    writeFileSync(join(root, 'a.html'), [
      '<!-- jig-allow I-118: a quoted title -->',
      '<p>One — two</p>',
      '<p>Three — four</p>',
      '<p>Five — six</p> <!-- jig-allow I-118: same line -->',
    ].join('\n'));
    const r = applyWaivers(root, [finding({ line: 2 }), finding({ line: 3 }), finding({ line: 4 })]);
    expect(r.waived.map((w) => [w.line, w.reason])).toEqual([[2, 'a quoted title'], [4, 'same line']]);
    expect(r.findings.map((f) => f.line)).toEqual([3]);
  });

  it('waives only the rule it names', () => {
    writeFileSync(join(root, 'a.html'), '<!-- jig-allow A-09: other rule -->\n<p>One — two</p>');
    expect(applyWaivers(root, [finding({})]).waived).toEqual([]);
  });

  it('never waives an error', () => {
    writeFileSync(join(root, 'a.css'), '/* jig-allow C-19: looks fine to me */\nbody { color: #777; }');
    const r = applyWaivers(root, [finding({ ruleId: 'C-19', severity: 'error', file: 'a.css' })]);
    expect(r.waived).toEqual([]);
    expect(r.findings).toHaveLength(1);
  });
});

describe('check reports what it waived', () => {
  it('lists each waiver with its reason, and leaves it out of warnings=', async () => {
    const { execFileSync } = await import('node:child_process');
    const { check } = await import('../src/commands/check.js');
    const root = mkdtempSync(join(tmpdir(), 'jig-waived-'));
    execFileSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(join(root, 'a.html'),
      '<!doctype html><html><head><title>t</title><meta name="description" content="d"></head><body><main>\n' +
      '<!-- jig-allow I-118: a quoted book title keeps its dash -->\n<p>One — two</p>\n</main></body></html>');
    const r = check({ projectRoot: root, homeDir: '', version: 't', all: true, ci: false });
    expect(r.waived.map((w) => w.ruleId)).toEqual(['I-118']);
    expect(r.findings.some((f) => f.ruleId === 'I-118')).toBe(false);
    expect(r.report).toMatch(/1 warning waived in the source with jig-allow:\n\s+I-118 a\.html:3  "a quoted book title keeps its dash"/);
    expect(r.report).toMatch(/warnings=0/);
  });
});
