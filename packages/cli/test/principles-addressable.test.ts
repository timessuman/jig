import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { explain } from '../src/commands/explain.js';
import { loadSpecs } from '../src/rules/specs.js';
import { repoRoot } from './helpers/registered-commands.js';

const version = '0.0.0-test';
const flat = (s: string) => s.replace(/\s+/g, ' ');

/**
 * `04-principles.md` was 0% addressable — 141 lines, twelve distinct units, not
 * one of them citable.
 *
 * That was worse here than anywhere else in the corpus, because of when the file
 * is read. The protocol says to load it "only when two rules conflict", which is
 * the moment a reader wants exactly one tiebreaker and not the whole document.
 * The one thing they could not do was ask for it.
 */
describe('principles are addressable', () => {
  const specs = () => loadSpecs(join(repoRoot, 'rules'));

  it('gives all twelve an id', () => {
    const r = specs().filter((s) => s.id.startsWith('R-'));
    expect(r).toHaveLength(12);
  });

  it('keeps frames and tiebreakers distinguishable in the title', () => {
    // Two kinds doing opposite work — generative and adjudicative. Losing that
    // in the rename would make R-01 and R-06 look interchangeable.
    const by = Object.fromEntries(specs().map((s) => [s.id, s.title]));
    expect(by['R-01']).toMatch(/Frame/);
    expect(by['R-12']).toMatch(/Tiebreaker/);
  });

  it('resolves one by id, with its body', () => {
    const out = explain({ ruleId: 'R-08', version });
    expect(out).toContain('R-08');
    expect(out).toMatch(/recoverable beats correct/i);
    expect(flat(out)).toMatch(/choose undo/i);
  });

  it('calls a principle a principle, not a rule or a specification', () => {
    const out = explain({ ruleId: 'R-08', version });
    expect(out).toMatch(/principle/i);
    expect(out).not.toMatch(/component anatomy|judgment · note|detector:/);
  });

  it('finds them by searching for what they are for', () => {
    const out = explain({ ruleId: 'tiebreaker', version });
    expect(out).toMatch(/R-0[6-9]|R-1[0-2]/);
  });
});

describe('the protocol sends a reader to the entry, not the file', () => {
  it.each(['AGENTS.md', 'templates/SKILL.md.tmpl'])('%s cites the tiebreakers', (file) => {
    const src = flat(readFileSync(join(repoRoot, file), 'utf8'));
    expect(src).toMatch(/R-06/);
    // The point is the swap: conflict → one tiebreaker, not 141 lines.
    expect(src).toMatch(/conflict/i);
  });
});

/**
 * Promoting the tiebreakers from `###` to `##` was not cosmetic.
 *
 * The RULE parser claims `^### [A-Z]-\d+`, so `### R-06` would have been read as
 * a rule, and `loadRules` throws on a rule with no `rules.index.json` entry —
 * which R-06 correctly does not have, having no ❌/✅ pair and no detector.
 */
describe('principles stay out of the rule index', () => {
  it('parses as specs, not rules, and the index does not know them', () => {
    const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8'));
    expect(index.some((e: { id: string }) => e.id.startsWith('R-'))).toBe(false);
  });

  it('leaves no `### R-` heading behind for the rule parser to claim', () => {
    const src = readFileSync(join(repoRoot, 'rules/04-principles.md'), 'utf8');
    expect(src).not.toMatch(/^### [A-Z]-\d+/m);
  });
});


/**
 * `02-tokens.md` was the largest unaddressable block in the corpus: 517 lines at
 * 0%. The protocol sends a reader there "for setup or when adding a token",
 * which wants one contract, not the file.
 */
describe('token guidance is addressable', () => {
  const specs = () => loadSpecs(join(repoRoot, 'rules'));

  it('gives every top-level section an id', () => {
    const t = specs().filter((s) => s.id.startsWith('T-'));
    expect(t.length).toBe(10);
  });

  it('resolves the contract a reader is most likely to want', () => {
    const out = explain({ ruleId: 'T-08', version });
    expect(out).toContain('Contrast contract');
    expect(flat(out)).toMatch(/WCAG 2\.1 AA/);
  });

  it('calls it a token contract, not a rule', () => {
    const out = explain({ ruleId: 'T-08', version });
    expect(out).toMatch(/token contract/i);
    expect(out).not.toMatch(/judgment · note|detector:/);
  });

  it('keeps subsections inside their parent rather than orphaning them', () => {
    // APCA is a `###` under the contrast contract, and `Optional: Tailwind
    // utility classes` a `###` under consuming. Promoting either to `##` would
    // have split its parent; leaving them means the parent carries them.
    const by = Object.fromEntries(specs().map((s) => [s.id, s.body]));
    expect(by['T-08']).toMatch(/APCA/);
    expect(by['T-10']).toMatch(/Tailwind/);
  });

  it('leaves the token layer the only place values live', () => {
    // The id makes the guidance citable. It must not make it a second home for
    // the numbers themselves — that is the defect this repo keeps finding.
    const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8'));
    expect(index.some((e: { id: string }) => e.id.startsWith('T-'))).toBe(false);
  });
});
