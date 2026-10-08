import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * The skill and the spec procedure tell an agent to run `L-01`'s steps, and
 * say how many. `L-01` gained a sixth step (how a screen collapses) and both
 * kept saying "five", so an agent ran the five and stopped before the one that
 * gives the phone composition. In a control run, a spec on Jig's own
 * reflow text chose a sideways-scrolling code block on an editorial phone.
 */
const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

describe("L-01's step count", () => {
  const l01 = read('rules/03-patterns.md').split('## L-01 · Layout method')[1]!.split(/\n## /)[0]!;
  const steps = [...l01.matchAll(/^### Step (\d+):/gm)].map((m) => Number(m[1]));

  it('numbers its steps from 1 without a gap', () => {
    expect(steps).toEqual(steps.map((_, i) => i + 1));
  });

  it('is the count the skill and the commands give', () => {
    const word = WORDS[steps.length]!;
    for (const file of ['templates/SKILL.md.tmpl', 'templates/COMMAND.md.tmpl']) {
      const said = [...read(file).replace(/\s+/g, ' ').matchAll(/(?:L-01`'s|run its) (\w+) steps/g)].map((m) => m[1]);
      expect(said.length, `${file} names no count`).toBeGreaterThan(0);
      for (const n of said) expect(n, file).toBe(word);
    }
  });
});
