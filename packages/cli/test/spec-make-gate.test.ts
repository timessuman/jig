import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * `spec` and `make` are agent procedures: the section in `COMMAND.md.tmpl` is
 * not documentation for an implementation elsewhere, it IS the implementation.
 * So these assert on the text, because the text is the code.
 *
 * What they pin is the finding from the control experiment. Making the layout
 * method addressable changed nothing: the agent opened `L-01` and built exactly
 * as the arm without it did. Adding one line — write the result to a file before
 * any markup — produced an 83-line plan covering all five steps, written four
 * minutes before the first markup. Reading a procedure and running it are
 * different acts, and only the obligation closes the gap.
 *
 * The gate is therefore the load-bearing part of this command pair, and the
 * failure mode it guards against is specific: an agent writing a spec and
 * accepting it in the same breath, which satisfies every check while being
 * exactly the thing confirmation exists to prevent.
 */
const tmpl = () => readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');

const section = (name: string): string => {
  const src = tmpl();
  const start = src.indexOf(`\n## ${name}\n`);
  expect(start, `no '## ${name}' section`).toBeGreaterThan(-1);
  const next = src.indexOf('\n## ', start + 1);
  return src.slice(start, next === -1 ? undefined : next);
};

describe('spec — the interaction is required, not optional', () => {
  it('tells the agent to ask and wait, not to hand over a questionnaire', () => {
    const s = section('spec');
    expect(s).toMatch(/two or three questions/i);
    expect(s).toMatch(/\bwait\b/i);
  });

  it('forbids synthesising a spec and presenting it for approval', () => {
    // The failure that looks most like success: a complete spec produced from a
    // one-line prompt and handed over for a yes.
    expect(section('spec')).toMatch(/first response/i);
  });

  it('asks about structure, and says why not appearance', () => {
    const s = section('spec');
    expect(s).toMatch(/structure/i);
    // Colour and type are settled at init. Re-deciding them per screen is the
    // second-source-of-truth defect this project keeps finding.
    expect(s).toMatch(/second source of truth/i);
  });

  it('routes the structural half through L-01 rather than restating it', () => {
    // If the spec restated the layout method, the two would drift. It cites.
    expect(section('spec')).toContain('L-01');
  });
});

describe('spec — confirmation means the user said so', () => {
  it('carries a confirmed field that starts false', () => {
    expect(section('spec')).toMatch(/confirmed:\s*false/);
  });

  it('forbids the agent setting it on the user behalf', () => {
    const s = section('spec');
    expect(s).toMatch(/may not set it on their behalf/i);
    // Absence of objection is not agreement — the loophole worth closing by name.
    expect(s).toMatch(/absence of objection/i);
  });
});

describe('make — refuses without a confirmed spec', () => {
  it('refuses when no spec exists', () => {
    const s = section('make');
    expect(s).toMatch(/no `?\.jig\/specs/i);
  });

  it('refuses when the spec is unconfirmed', () => {
    expect(section('make')).toMatch(/confirmed:\s*false/);
  });

  it('closes the write-your-own-spec loophole explicitly', () => {
    // Without this line the gate is trivially satisfiable: write a spec, accept
    // it, proceed. Naming it is the only thing that makes the gate real.
    expect(section('make')).toMatch(/same breath/i);
  });

  it('requires deviations to be recorded back', () => {
    const s = section('make');
    expect(s).toMatch(/deviations:/);
    // The point is not that the spec was wrong — it is that a spec which
    // silently stops describing the page makes a later review validate fiction.
    expect(s).toMatch(/fiction/i);
  });
});

describe('the dispatcher distinguishes the two kinds of subcommand', () => {
  it('says agent procedures have no binary to run', () => {
    const src = tmpl();
    expect(src).toMatch(/no binary/i);
    expect(src).toMatch(/is\*{0,2} the command/i);
  });

  it('does not tell the agent to run a CLI for every subcommand', () => {
    // The original header said "Run the matching CLI command with
    // {{scripts_path}}" unconditionally, which is false for `spec` and `make`
    // and would send an agent to run a command that does not exist.
    const header = tmpl().split('\n## ')[0];
    expect(header).toMatch(/CLI-backed/);
  });
});
