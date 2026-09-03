import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * Invariants on `rules.index.json` that `loadRules` does not already enforce.
 *
 * `loadRules` checks that the indexed ids and the parsed rules agree in both
 * directions. What it does not check is whether each entry's own metadata is
 * coherent — that a mechanical rule names a detector it could actually be
 * checked by, that a judgment rule does not, that no id is duplicated. Those
 * are asserted here.
 *
 * Scope note: the index covers the `### X-NN Title` rules — the ones with a
 * ❌/✅ pair, which is what a bucket and a detector are meaningful for. The
 * `## P-NN · Name` pattern specs in 03-patterns.md and `## M-NN` mode specs in
 * 01-modes.md are deliberately outside it; they are specifications, not
 * checkable rules, and `parseRules` does not emit them. Agents do cite them
 * (baseline reviews cited P-02, P-05, P-06, P-08 and M-02, all real), so
 * whether they deserve an index of their own is an open question — see
 * docs/known-follow-ups.md. Adding them to this one makes `loadRules` throw,
 * which is the system correctly rejecting two different kinds of thing in one
 * list.
 */
const rulesDir = join(repoRoot, 'rules');

/** The `### X-NN` rules, matching what `parseRules` recognises. */
function idsInFiles(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(join(rulesDir, file), 'utf8');
    for (const m of text.matchAll(/^### ([A-Z]-\d+)\s/gm)) {
      found.set(m[1], file);
    }
  }
  return found;
}

/** The `## P-NN ·` / `## M-NN ·` specs, which the index deliberately excludes. */
function specIdsInFiles(): string[] {
  const found: string[] = [];
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(join(rulesDir, file), 'utf8');
    for (const m of text.matchAll(/^## ([PM]-\d+)\s/gm)) found.push(m[1]);
  }
  return found;
}

interface IndexedRule {
  id: string;
  bucket: string;
  severity: string;
  detector?: string;
  since: string;
}

const index: IndexedRule[] = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8'));

describe('rules.index.json agrees with the rule files', () => {
  it('finds rule headings at all (guards the parser itself)', () => {
    expect(idsInFiles().size).toBeGreaterThan(100);
  });

  it('indexes every rule the files define', () => {
    const indexed = new Set(index.map((r) => r.id));
    const missing = [...idsInFiles()].filter(([id]) => !indexed.has(id));
    expect(
      missing.map(([id, file]) => `${id} (${file})`),
      'rules defined in the files but absent from rules.index.json',
    ).toEqual([]);
  });

  it('defines every rule the index names', () => {
    const inFiles = idsInFiles();
    const orphaned = index.map((r) => r.id).filter((id) => !inFiles.has(id));
    expect(orphaned, 'rules in rules.index.json with no heading in rules/').toEqual([]);
  });

  it('gives every indexed rule a known bucket and severity', () => {
    for (const rule of index) {
      expect(['mechanical', 'hybrid', 'judgment'], `${rule.id} bucket`).toContain(rule.bucket);
      expect(['error', 'warning', 'note'], `${rule.id} severity`).toContain(rule.severity);
      expect(rule.since, `${rule.id} since`).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('gives a detector to every mechanical or hybrid rule, and to no judgment rule', () => {
    // The bucket is a claim about who can check the rule. A mechanical rule with
    // no detector cannot be checked by anyone; a judgment rule with one is
    // misfiled.
    for (const rule of index) {
      if (rule.bucket === 'judgment') {
        expect(rule.detector, `${rule.id} is judgment but names a detector`).toBeUndefined();
      } else {
        expect(rule.detector, `${rule.id} is ${rule.bucket} but names no detector`).toBeTruthy();
      }
    }
  });

  it('keeps the pattern and mode specs out of the index', () => {
    // Not a nicety: putting them in makes `loadRules` throw, because
    // `parseRules` does not emit them and it checks both directions.
    const indexed = new Set(index.map((r) => r.id));
    const specs = specIdsInFiles();
    expect(specs.length, 'no P-/M- specs found — the parser may have drifted').toBeGreaterThan(10);
    expect(specs.filter((id) => indexed.has(id)), 'specs wrongly added to the rule index').toEqual([]);
  });

  it('never reuses or renumbers an id', () => {
    const ids = index.map((r) => r.id);
    expect(new Set(ids).size, 'duplicate rule ids in the index').toBe(ids.length);
  });
});
