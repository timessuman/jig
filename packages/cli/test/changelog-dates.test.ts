import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * jig-site's Versions page lists every release with its date, and it builds
 * from the npm package, which carries no git history. The CHANGELOG is the one
 * place the date travels with the release, so every released heading has one.
 */
describe('CHANGELOG headings', () => {
  const headings = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('## '));

  it('date every release, and leave only Unreleased undated', () => {
    const bad = headings.filter((h) => h !== '## Unreleased' && !/^## \d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)$/.test(h));
    expect(bad).toEqual([]);
  });

  it('run newest first', () => {
    const dates = headings.map((h) => h.match(/\((\d{4}-\d{2}-\d{2})\)$/)?.[1]).filter(Boolean) as string[];
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
