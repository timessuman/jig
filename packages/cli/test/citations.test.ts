import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { citableIds, isCitable } from '../src/rules/citations.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * Everything an agent may legitimately cite: the indexed `X-NN` rules AND the
 * `P-`/`M-` specs, which are outside `rules.index.json` by design.
 *
 * Without one list, anything validating a citation had only the rule index, and
 * would reject `P-06` — a real rule, cited in every baseline run of this
 * release. That is the remaining half of M10.
 */
const root = repoRoot;

describe('citableIds', () => {
  it('includes both the indexed rules and the specs', () => {
    const ids = citableIds(root);
    expect(ids).toContain('C-19');
    expect(ids).toContain('P-06');
    expect(ids).toContain('M-03');
    expect(ids.length).toBeGreaterThan(110);
  });

  it('has no duplicates and is sorted', () => {
    const ids = citableIds(root);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe('isCitable', () => {
  it('accepts a rule and a spec alike', () => {
    expect(isCitable('C-19', root)).toBe(true);
    expect(isCitable('P-06', root)).toBe(true);
  });

  it('is case- and whitespace-insensitive, as a citation in prose will be', () => {
    expect(isCitable(' c-19 ', root)).toBe(true);
  });

  it('rejects an id that does not exist', () => {
    expect(isCitable('C-999', root)).toBe(false);
    expect(isCitable('not-an-id', root)).toBe(false);
  });
});
