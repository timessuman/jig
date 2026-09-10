import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from '../src/rules/parse.js';
import { loadRules } from '../src/rules/load.js';
import { repoRoot } from './helpers/registered-commands.js';

// Paths come from the package location, never `process.cwd()`. With cwd these
// two tests passed under `npm test` (which runs with cwd = packages/cli) and
// failed with ENOENT from anywhere else — `vitest packages/cli/test/...` at the
// repo root looked for `/home/<user>/rules/`. A test whose result depends on
// which directory you were standing in is worse than no test.

describe('real rule file', () => {
  it('parses all 87 rules from 00-anti-patterns.md', () => {
    const md = readFileSync(join(repoRoot, 'rules/00-anti-patterns.md'), 'utf8');
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
      loadRules(join(repoRoot, 'rules'), join(repoRoot, 'rules.index.json')),
    ).not.toThrow();
  });
});
