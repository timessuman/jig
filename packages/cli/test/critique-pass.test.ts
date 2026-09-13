import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateIndex } from '../src/rules/schema.js';
import { repoRoot } from './helpers/registered-commands.js';

const index = () =>
  validateIndex(JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')));
const tmpl = () => readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');

/**
 * `pass` exists so two commands cannot return different verdicts on one rule.
 *
 * `bucket` says who can decide a rule; `pass` says what they must look at. The
 * system this was learned from does not make that split — `impeccable`'s `audit`
 * scores "Anti-Patterns" while its `critique` assesses "AI Slop Detection", both
 * against the same guidelines by different routes, free to disagree.
 *
 * The concrete failure being designed out: a page whose stylesheet 404s passes
 * every file-based check ever written. One of these two commands has to be the
 * one that looks, and the other has to know it did not.
 */
describe('every judgment rule declares which pass owns it', () => {
  it('assigns code or screen to all of them', () => {
    const judgment = index().filter((r) => r.bucket === 'judgment');
    expect(judgment.length).toBeGreaterThan(90);
    for (const r of judgment) {
      expect(['code', 'screen'], `${r.id} has no pass`).toContain(r.pass);
    }
  });

  it('splits them rather than routing everything one way', () => {
    // A split that is 95/0 either way means the field was filled in, not
    // decided — and the command that owns nothing would quietly do nothing.
    const judgment = index().filter((r) => r.bucket === 'judgment');
    const screen = judgment.filter((r) => r.pass === 'screen');
    expect(screen.length).toBeGreaterThan(10);
    expect(screen.length).toBeLessThan(judgment.length - 10);
  });

  it('routes the spatial rules to screen, where they can actually be seen', () => {
    // D-25 proximity hierarchy, D-70 broken left edge, D-27 optical alignment.
    // None of these is in a file; they are in what the files render to.
    const by = Object.fromEntries(index().map((r) => [r.id, r.pass]));
    for (const id of ['D-25', 'D-70', 'D-27', 'D-71', 'D-72']) {
      expect(by[id], `${id} should be judged on the rendered page`).toBe('screen');
    }
  });

  it('routes the copy rules to code, where reading is enough', () => {
    const by = Object.fromEntries(index().map((r) => [r.id, r.pass]));
    for (const id of ['I-53', 'I-83', 'I-85', 'I-89']) {
      expect(by[id], `${id} is decidable by reading`).toBe('code');
    }
  });

  it('rejects a judgment rule with no pass', () => {
    expect(() =>
      validateIndex([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' }]),
    ).toThrow(/pass/i);
  });

  it('rejects a pass that is neither', () => {
    expect(() =>
      validateIndex([
        { id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0', pass: 'vibes' },
      ]),
    ).toThrow(/pass/i);
  });
});

describe('the two commands divide the work rather than overlapping', () => {
  it('check judges only the code rules, and says who owns the rest', () => {
    const check = tmpl().split('\n## check\n')[1].split('\n## ')[0];
    expect(check).toMatch(/pass: ?`?code/);
    expect(check).toMatch(/critique/);
  });

  it('check admits it never looked at a page', () => {
    // The precise over-claim being prevented: `judgment=ran` reads as "reviewed"
    // when it can only mean "the files were read".
    const check = tmpl().split('\n## check\n')[1].split('\n## ')[0];
    expect(check).toMatch(/stylesheet never loaded|does not mean the page was\s+reviewed/i);
  });

  it('critique names evidence, not effort, as the difference', () => {
    const c = tmpl().split('\n## critique\n')[1];
    expect(c).toMatch(/not\*{0,2} a second `?check/i);
    expect(c).toMatch(/in no\s+file/i);
  });

  it('critique requires isolation and forbids the build conversation', () => {
    const c = tmpl().split('\n## critique\n')[1];
    expect(c).toMatch(/cannot see each other|may not see the other/i);
    expect(c).toMatch(/build conversation/i);
  });

  it('critique requires rendering at two widths when a browser exists', () => {
    const c = tmpl().split('\n## critique\n')[1];
    expect(c).toMatch(/400/);
    expect(c).toMatch(/1280/);
    // composition vs dimensions is the decidable form of RESPONSIVE-03
    expect(c).toMatch(/composition/i);
  });

  it('critique carries rendered= in its attestation', () => {
    expect(tmpl()).toMatch(/rendered=<yes\|no>/);
  });

  it('critique refuses to write the spec it is about to check against', () => {
    // A spec derived from the page agrees with the page by construction.
    const c = tmpl().split('\n## critique\n')[1];
    expect(c).toMatch(/by construction/i);
  });
});
