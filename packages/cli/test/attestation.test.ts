import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * `JIG_CHECK:` is one label, so it must name one record.
 *
 * It did not. The CLI emitted `version= mechanical= judgment=` while the skill
 * file told the agent to emit `version= mode= self_check=` — disjoint field sets
 * under a shared prefix, so anything parsing the line saw two incompatible
 * records depending on who wrote it. Both baseline runs emitted the skill's
 * shape, which is the one a reader is most likely to meet.
 *
 * The fields are the contract; who can fill them is not the same question. An
 * emitter that cannot determine a field says so in the value (`unknown`,
 * `not-run`) rather than dropping it.
 */
const FIELDS = ['version', 'mode', 'mechanical', 'judgment'];

function fieldsOf(text: string): string[] {
  return [...text.matchAll(/(\w+)=/g)].map((m) => m[1]);
}

/**
 * The attestation statement starting at `JIG_CHECK:`, read across line breaks —
 * the emission is a template literal the formatter is free to wrap, and a test
 * that only looked at the first physical line silently saw no fields at all.
 */
function attestationIn(text: string, terminator: RegExp): string {
  // Anchored on `JIG_CHECK: version=` rather than the bare label, so prose
  // mentioning the contract cannot be mistaken for the record itself.
  const start = text.indexOf('JIG_CHECK: version=');
  expect(start, 'no JIG_CHECK record found').toBeGreaterThan(-1);
  const rest = text.slice(start);
  const end = rest.search(terminator);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('the JIG_CHECK attestation line', () => {
  it('is documented in the skill template with the agreed fields, in order', () => {
    const tmpl = readFileSync(join(repoRoot, 'templates/SKILL.md.tmpl'), 'utf8');
    expect(fieldsOf(attestationIn(tmpl, /\n/))).toEqual(FIELDS);
  });

  it('is emitted by the CLI with the same fields, in the same order', () => {
    const report = readFileSync(join(repoRoot, 'packages/cli/src/check/report.ts'), 'utf8');
    // Stop at the end of the template literal, and strip its interpolations so
    // only the field names remain.
    const stmt = attestationIn(report, /`\s*,?\s*\n\s*\)/).replace(/\$\{[^}]*\}/g, 'X');
    expect(fieldsOf(stmt)).toEqual(FIELDS);
  });
});
