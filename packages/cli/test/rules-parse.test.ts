import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRules } from '../src/rules/parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(here, 'fixtures', 'sample-rules.md'), 'utf8');

/** The real shipped rules file, not the fixture. Some properties are only
 *  meaningful against the actual corpus — a fixture that happens to carry
 *  prose proves the parser can, not that the rules do. */
const realFile = () =>
  readFileSync(join(here, '..', '..', '..', 'rules', '00-anti-patterns.md'), 'utf8');

describe('parseRules', () => {
  const rules = parseRules(md, '00-anti-patterns.md');

  it('finds every rule heading and ignores prose', () => {
    expect(rules.map((r) => r.id)).toEqual(['A-01', 'A-02', 'E-29']);
  });

  it('splits the id into section and number', () => {
    expect(rules[2].section).toBe('E');
    expect(rules[2].number).toBe(29);
  });

  it('captures the title without the id', () => {
    expect(rules[0].title).toBe('Purple and violet as the unspecified default');
  });

  it('captures the wrong and correction lines', () => {
    expect(rules[0].wrong).toContain('violet or indigo fill');
    expect(rules[0].correction).toContain('--color-brand');
  });

  it('stops the correction at the first line after it', () => {
    expect(rules[1].correction).toBe('Solid `--color-text-strong`.');
  });

  it('builds a source anchor', () => {
    expect(rules[2].source).toBe('00-anti-patterns.md#e-29');
  });

  it('returns an empty array for markdown with no rules', () => {
    expect(parseRules('# Title\n\nJust prose.', 'x.md')).toEqual([]);
  });
});

/**
 * The prose after the correction is shipped documentation, and until now it was
 * unreachable.
 *
 * `parseRules` kept the first ❌ and the first ✅ and dropped everything after.
 * 40 of the 104 rules carry real prose past their correction — 96 lines — and
 * `jig explain` showed none of it. `A-04` explains WHY glassmorphism and
 * neumorphism fail (shadow-only definition cannot hold 3:1); `C-22` loses
 * sixteen lines. The rules were written with that reasoning and then shipped
 * without it.
 */
describe('prose after the correction', () => {
  it('keeps the reasoning A-04 ships and explain never showed', () => {
    const rules = parseRules(realFile(), '00-anti-patterns.md');
    const a04 = rules.find((r) => r.id === 'A-04')!;
    // 'neumorphism' also appears in A-04's ❌ line, so asserting on it would
    // pass against the unfixed parser. These two phrases exist ONLY in the
    // prose that was being dropped.
    expect(a04.notes.join(' ')).toContain('Experiment freely');
    expect(a04.notes.join(' ')).toContain('almost by construction');
  });

  it('leaves notes empty for a rule that has none', () => {
    const rules = parseRules(realFile(), '00-anti-patterns.md');
    expect(rules.find((r) => r.id === 'A-02')!.notes).toEqual([]);
  });

  it('stops at the next heading rather than swallowing the following rule', () => {
    const rules = parseRules(
      ['### A-01 First', '❌ bad', '✅ good', 'reasoning here', '', '### A-02 Second', '❌ x', '✅ y'].join('\n'),
      'f.md',
    );
    expect(rules.find((r) => r.id === 'A-01')!.notes).toEqual(['reasoning here']);
    expect(rules.find((r) => r.id === 'A-02')!.notes).toEqual([]);
  });

  it('drops separators, which carry no information', () => {
    const rules = parseRules(['### A-01 T', '❌ b', '✅ g', '---'].join('\n'), 'f.md');
    expect(rules.find((r) => r.id === 'A-01')!.notes).toEqual([]);
  });
});

