import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules } from '../src/rules/load.js';
import { loadSpecs } from '../src/rules/specs.js';
import { loadSections } from '../src/rules/sections.js';
import { searchEntries, explain } from '../src/commands/explain.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * Every line of guidance Jig ships must be findable by `jig explain`.
 *
 * Twice a part of the corpus was printed but unsearchable: a rule's reasoning
 * was never in the search index, and prose outside any id — `01-modes.md`'s
 * "What mode does not control", every file's introduction — could not be
 * reached at all. Sampling searches missed both for releases. This holds the
 * whole corpus to it instead: take every non-blank line of every rule file and
 * require that some search entry contains it.
 */
describe('search reaches every line of the corpus', () => {
  const dir = join(repoRoot, 'rules');
  const entries = searchEntries(
    loadRules(dir, join(repoRoot, 'rules.index.json')),
    loadSpecs(dir),
    loadSections(dir),
  );
  const haystack = entries.map((e) => `${e.title}\n${e.text}`).join('\n');

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    it(`every line of ${file}`, () => {
      const unreached = readFileSync(join(dir, file), 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^#{1,6}\s/.test(l) && !/^-{3,}$/.test(l) && !/^```/.test(l))
        .map((l) => l.replace(/^[❌✅]\s*/, ''))
        .filter((l) => !haystack.includes(l));
      expect(unreached).toEqual([]);
    });
  }

  // All three parsers treat a line starting with `#` as a heading, including one
  // inside a code fence. A shell comment in a rule's example would end the rule
  // there, and everything after it would silently change owner. Nothing does it
  // today; this keeps it that way.
  it('no rule file puts a heading-shaped line inside a code fence', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      let fence = false;
      readFileSync(join(dir, file), 'utf8').split('\n').forEach((line, i) => {
        if (/^```/.test(line)) fence = !fence;
        else if (fence && /^#/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('finds prose that belongs to no id, and names where it lives', () => {
    const out = explain({ ruleId: 'category error', version: '0.0.0-test' });
    expect(out).toContain('01-modes.md');
    expect(out).toContain('What mode does *not* control');
  });

  it('prints a section when asked for it by its anchor', () => {
    const out = explain({ ruleId: '01-modes.md#the-two-switches', version: '0.0.0-test' });
    expect(out).toMatch(/orthogonal/);
  });

  it('still ranks ids ahead of sections', () => {
    const out = explain({ ruleId: 'layout', version: '0.0.0-test' });
    const first = out.split('\n').find((l) => /^\S/.test(l) && !/entries match/.test(l));
    expect(first).toMatch(/^L-01/);
  });
});
