import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRules } from '../src/rules/parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(here, 'fixtures', 'sample-rules.md'), 'utf8');

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
