import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

const read = (f: string) => readFileSync(join(repoRoot, f), 'utf8');
const command = read('templates/COMMAND.md.tmpl');
const section = (name: string) => {
  const start = command.indexOf(`\n## ${name}\n`);
  const next = command.slice(start + 1).search(/\n## [a-z]+\n/);
  return command.slice(start, next === -1 ? undefined : start + 1 + next);
};

/**
 * Build the simple version, fix it while it can be used, then move on. Before
 * this, critique ended at its attestation and a weak agent read the findings
 * as the end of the job.
 */
describe('the cycle goes back to make before the next feature', () => {
  const critique = section('critique');

  it('sends findings to make, then critique again', () => {
    expect(critique).toMatch(/### 5\. Then the cycle goes round again/);
    expect(critique).toMatch(/the next step is `\{\{command_prefix\}\}make`\s+to fix them — not the next feature/);
    expect(critique).toMatch(/Run `\{\{command_prefix\}\}critique` again on the same surface/);
  });

  it('only counts acceptance the user gave, by id', () => {
    expect(critique).toMatch(/accepted each\s+one that is left \*\*by id, in their own words\*\*/);
    expect(critique).toMatch(/Your\s+judgment that a finding is minor is not acceptance/);
  });

  it('is stated in make and in the skill loop too', () => {
    expect(section('make')).toMatch(/After a critique,\*\* `make` is how its findings get fixed/);
    expect(read('templates/SKILL.md.tmpl')).toMatch(/Critique findings go back to\s+`make`, then `critique` again/);
  });
});

/**
 * Colour goes on top of a hierarchy that already works. Agents render now, so
 * the squint test is run on a grayscale render, and the reading-the-source
 * analogue is only the fallback.
 */
describe('L-01 squint test runs on a grayscale render', () => {
  it('renders with grayscale before falling back to the analogue', () => {
    const patterns = read('rules/03-patterns.md');
    expect(patterns).toMatch(/When the page can be rendered, test it without colour/);
    expect(patterns).toMatch(/filter: grayscale\(1\)/);
    expect(patterns).toMatch(/When nothing can render it, use the analogue/);
    expect(patterns).not.toMatch(/An agent cannot squint/);
  });

  it('is part of critique step 2', () => {
    expect(section('critique')).toMatch(/render\s+each size once more with `filter: grayscale\(1\)` on the root/);
  });
});
