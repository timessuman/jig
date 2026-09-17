import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

const tmpl = readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');
const section = (name: string) => {
  const start = tmpl.indexOf(`\n## ${name}\n`);
  // Command headings are lower-case single words; `## Unresolved` inside a
  // fenced example is not one.
  const next = tmpl.slice(start + 1).search(/\n## [a-z]+\n/);
  return tmpl.slice(start, next === -1 ? undefined : start + 1 + next);
};

/**
 * From the second Haiku arm test: one build skipped check and shipped 53
 * errors, one offered 36 as "non-blocking", one reported "matched exactly"
 * against a mockup whose phone menu it never built.
 */
describe("make's finish is a gate", () => {
  const make = section('make');

  it('requires a pasted JIG_CHECK line with mechanical=pass', () => {
    expect(make).toMatch(/check --all/);
    expect(make).toMatch(/`mechanical=fail:<n>` means not done/);
    expect(make).toMatch(/No mechanical finding is non-blocking/);
    expect(make).toMatch(/A report with no `JIG_CHECK:` line, or one you typed yourself,\s+is not a finished\s+build/);
  });

  it('compares a render to the approved mockup at each width, region by region', () => {
    expect(make).toMatch(/360px, 768px and 1280px/);
    expect(make).toMatch(/\| Size \| Mockup region \| In the build\? \|/);
    expect(make).toMatch(/Never\s+write "matches" without the table/);
    expect(make).toMatch(/Every \*\*no\*\* is either fixed now or appended to `deviations:`/);
  });

  it('counts a drawn control as built only if it works', () => {
    expect(make).toMatch(/only if it works: tap it/);
  });
});

describe('spec refuses a value that names nobody', () => {
  const spec = section('spec');

  it('turns a deferral into a lookup, not a quoted phrase', () => {
    expect(spec).toMatch(/"The design system decides" is not a value/);
    expect(spec).toMatch(/pattern for the component/);
    expect(spec).toMatch(/`L-01`'s five\s+steps/);
  });

  it('reads every field back before confirmation', () => {
    expect(spec).toMatch(/refuse any value that\s+names nobody/);
  });

  it('asks about unresolved decisions instead of settling them', () => {
    expect(spec).toMatch(/\*\*Unresolved\*\* section, ask the user\s+about it by name/);
  });
});

describe('decide records what is open, and only reasons the owner gave', () => {
  const decide = section('decide');

  it('asks by name what is still undecided', () => {
    expect(decide).toMatch(/Round 3 also asks, by name, what is still undecided/);
  });

  it('has an Unresolved section that does not fail the gate', () => {
    expect(decide).toMatch(/^## Unresolved$/m);
    expect(decide).toMatch(/This\s+section is not a placeholder and does not fail the gate/);
    expect(decide).toMatch(/None named by the\s+owner\./);
  });

  it('never supplies a reason', () => {
    expect(decide).toMatch(/The reason is the owner's, or it is not written/);
    expect(decide).toMatch(/`\*\*Why:\*\* not given`/);
  });

  it('maps every answer to where it was recorded before confirming', () => {
    expect(decide).toMatch(/account for every answer/);
    expect(decide).toMatch(/every\s+`Why:` in the file must trace to something the user said/);
  });
});

describe('init says surfaces declared later need init again', () => {
  it('is in the procedure', () => {
    expect(section('init')).toMatch(/Surfaces declared after `init` do not reach the page until `init` runs again/);
  });
});
