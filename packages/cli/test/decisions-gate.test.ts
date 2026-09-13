import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * `DECISIONS.md` is the layer Jig did not have.
 *
 * The corpus holds rules true of every project. The token layer holds values.
 * `jig.config.json` holds mode. None of them can hold a *reason* — so a project
 * decision that needs a sentence ("our accent arrives as a whole field or not at
 * all") had nowhere to live, and an agent rediscovered it, or did not, on every
 * task.
 *
 * It blocks rather than nudges. That is a deliberate divergence from the system
 * this borrows from, where `PRODUCT.md` blocks and `DESIGN.md` only nudges once
 * per session and then proceeds.
 */
const skill = () => readFileSync(join(repoRoot, 'templates/SKILL.md.tmpl'), 'utf8');

/**
 * Prose in these templates is hard-wrapped, so a sentence that reads as one line
 * contains newlines and indentation at unpredictable points. Three assertions
 * across this branch have already failed on that — matching `in no file` against
 * `in no\nfile` — and each time the instinct is to reword the prose to suit the
 * regex, which is backwards.
 *
 * Collapse whitespace before matching anything that spans more than two words.
 */
const flat = (s: string) => s.replace(/\s+/g, ' ');
const tmpl = () => readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');
const decide = () => tmpl().split('\n## decide\n')[1] ?? '';

describe('the gate blocks', () => {
  it('makes step 0 two preconditions, not one', () => {
    const s = skill();
    expect(s).toMatch(/two preconditions/i);
    expect(s).toMatch(/stop on either/i);
  });

  it('names DECISIONS.md and where it lives', () => {
    const s = skill();
    expect(s).toContain('DECISIONS.md');
    // Beside the tokens, and it moves with them — a project that relocated its
    // token layer must not be told to look in a directory it does not have.
    expect(s).toMatch(/beside the token files/i);
    expect(s).toMatch(/brand.*puts them/is);
  });

  it('treats a placeholder file as an unwritten one', () => {
    // "Exists" is too weak a check: a file containing [TODO] passes it while
    // recording nothing, which is how a gate becomes a formality.
    expect(skill()).toContain('[TODO]');
  });

  it('forbids the agent writing it from the task prompt', () => {
    // The whole point is that these are the PROJECT's decisions. A file the
    // agent authors alone records the agent's decisions under the same name.
    expect(flat(skill())).toMatch(/opposite thing wearing the same name/i);
  });

  it('points at the command that produces it', () => {
    expect(skill()).toMatch(/\{\{command_prefix\}\}decide/);
  });
});

describe('decide — what belongs in it', () => {
  it('has a section at all', () => {
    expect(decide().length).toBeGreaterThan(500);
  });

  it('excludes what the tokens and the rules already hold', () => {
    const d = decide();
    // Two places to change one value is the defect this repo keeps finding.
    expect(d).toMatch(/that is a token/i);
    expect(d).toMatch(/universal rule copied into a project file/i);
  });

  it('states the test for whether something belongs', () => {
    expect(decide()).toMatch(/derived from the tokens, the mode, or a numbered rule/i);
  });

  it('requires a reason, not just an instruction', () => {
    const d = decide();
    expect(d).toMatch(/\*\*Why:\*\*/);
    // A reason is what lets a later reader tell when the rule does not apply.
    expect(d).toMatch(/when the rule does not apply/i);
  });

  it('interviews rather than infers', () => {
    const d = decide();
    expect(d).toMatch(/two or three questions/i);
    expect(d).toMatch(/do not infer/i);
  });
});
