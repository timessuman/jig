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
