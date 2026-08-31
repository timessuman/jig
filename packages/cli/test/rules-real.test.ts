import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from '../src/rules/parse.js';
import { loadRules } from '../src/rules/load.js';

describe('real rule file', () => {
  it('parses all 87 rules from 00-anti-patterns.md', () => {
    const md = readFileSync(join(process.cwd(), '../../rules/00-anti-patterns.md'), 'utf8');
    const rules = parseRules(md, '00-anti-patterns.md');
    expect(rules.length).toBeGreaterThanOrEqual(87);
    expect(rules.find((r) => r.id === 'A-01')).toBeDefined();
    expect(rules.find((r) => r.id === 'H-48')).toBeDefined();
    expect(rules.every((r) => r.title.length > 0)).toBe(true);
  });
});

describe('real index', () => {
  it('has an entry for every rule and no orphans', () => {
    expect(() =>
      loadRules(join(process.cwd(), '../../rules'), join(process.cwd(), '../../rules.index.json')),
    ).not.toThrow();
  });
});
