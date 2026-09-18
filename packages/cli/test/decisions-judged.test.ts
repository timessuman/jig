import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decisionNames } from '../src/check/decisions.js';
import { verifyVerdicts } from '../src/commands/verdicts.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * Arm test 9: Haiku shipped "start free trial" on two plans after the owner
 * had killed trials; Sonnet used Title Case against a lowercase decision.
 * Both pages satisfied all 115 rules. Nothing read the file written to hold
 * what the project itself had chosen.
 */
const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
const ids = (pass: string) => index.filter((r) => r.bucket === 'judgment' && r.pass === pass).map((r) => ({ id: r.id, verdict: 'ok', reason: `${r.id} holds here` }));

let project: string;
const dir = () => join(project, '.jig', 'critique', 'pricing');
const run = () => verifyVerdicts({ projectRoot: project, surface: 'pricing', packageRoot: repoRoot });
const decisions = (body: string) => { mkdirSync(join(project, 'jig'), { recursive: true }); writeFileSync(join(project, 'jig', 'DECISIONS.md'), body); };
const write = (name: string, body: unknown) => writeFileSync(join(dir(), name), JSON.stringify(body));

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-decisions-'));
  mkdirSync(dir(), { recursive: true });
  write('screen.json', { rendered: false, verdicts: ids('screen') });
  write('code.json', { verdicts: ids('code') });
  decisions('# Decisions\n\n## Voice\n\nlowercase.\n\n## Trial and onboarding\n\nno trials.\n\n## Unresolved\n\nstatus page.\n');
});

describe('decisionNames', () => {
  it('reads each heading as a decision, and Unresolved as none', () => {
    expect(decisionNames(project)).toEqual(['Voice', 'Trial and onboarding']);
  });

  it('finds the file wherever the token layer put it, and copes with none', () => {
    const empty = mkdtempSync(join(tmpdir(), 'jig-none-'));
    expect(decisionNames(empty)).toEqual([]);
  });
});

describe('jig verdicts judges the project decisions too', () => {
  it('reports the file as missing, naming what should have been judged', () => {
    const r = run();
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/decisions\.json is missing.*Voice, Trial and onboarding/s);
    expect(r.line).toMatch(/decisions=missing:0/);
  });

  it('passes when every decision carries a verdict, and counts a finding', () => {
    write('decisions.json', { verdicts: [
      { decision: 'Voice', verdict: 'finding', reason: 'headings are Title Case; the decision says lowercase' },
      { decision: 'Trial and onboarding', verdict: 'ok', reason: 'no trial language anywhere on the page' },
    ] });
    const r = run();
    expect(r.errors.filter((e) => e.includes('decisions'))).toEqual([]);
    expect(r.line).toMatch(/decisions=ran:2/);
    expect(r.line).toMatch(/findings=1/);
  });

  it('names a decision left unjudged', () => {
    write('decisions.json', { verdicts: [{ decision: 'Voice', verdict: 'ok', reason: 'lowercase throughout' }] });
    expect(run().errors.join('\n')).toMatch(/1 of 2 decisions have no verdict: Trial and onboarding/);
  });

  it('refuses a decision nobody made, an empty reason, and one judged twice', () => {
    write('decisions.json', { verdicts: [
      { decision: 'Voice', verdict: 'ok', reason: 'lowercase' },
      { decision: 'Voice', verdict: 'ok', reason: 'again' },
      { decision: 'Trial and onboarding', verdict: 'ok', reason: '' },
      { decision: 'Something I invented', verdict: 'ok', reason: 'x' },
    ] });
    const errors = run().errors.join('\n');
    expect(errors).toMatch(/"Voice" is judged more than once/);
    expect(errors).toMatch(/"Trial and onboarding" has no reason/);
    expect(errors).toMatch(/"Something I invented" is not a heading in DECISIONS\.md/);
  });

  it('says ran:0 in a project that has decided nothing yet', () => {
    const bare = mkdtempSync(join(tmpdir(), 'jig-bare-'));
    mkdirSync(join(bare, '.jig', 'critique', 'pricing'), { recursive: true });
    writeFileSync(join(bare, '.jig', 'critique', 'pricing', 'screen.json'), JSON.stringify({ rendered: false, verdicts: ids('screen') }));
    writeFileSync(join(bare, '.jig', 'critique', 'pricing', 'code.json'), JSON.stringify({ verdicts: ids('code') }));
    expect(verifyVerdicts({ projectRoot: bare, surface: 'pricing', packageRoot: repoRoot }).line).toMatch(/decisions=ran:0/);
  });
});
