import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * What the gate holds spec, mockup and tweak sessions to is stated where each
 * command finishes, before the agent writes, and not only in the refusal after
 * it. On jig-site one page's sessions were refused thirteen times by rules the
 * procedure stated nowhere, or far from where the thing was written; each
 * refusal cost a round of fixing, re-checking and committing.
 *
 * Each entry pairs a check (a phrase from the gate's own message, so the check
 * still exists) with the line of the procedure's list that states it. A check
 * the gate adds to the functions below without a line in the list fails here.
 */
const tmpl = readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');
// The gate's messages are template literals; read them as the agent does.
const src = (file: string) => readFileSync(join(repoRoot, 'packages/cli/src', file), 'utf8').replace(/\\`/g, '`');
const list = (command: string) => {
  const after = tmpl.split(`### Before you stop: what the gate holds a ${command} to`)[1];
  return after ? after.split(/\n#{2,3} /)[0]! : '';
};

type Rule = { file: string; check: string; stated: RegExp };
const RULES: Record<'spec' | 'mockup' | 'tweak', Rule[]> = {
  spec: [
    { file: 'commands/gate.ts', check: 'writes under .jig/ only', stated: /writes under `\.jig\/` only/ },
    { file: 'check/spec-shape.ts', check: 'is not a field Jig reads', stated: /Jig's fields and nothing else/ },
    { file: 'check/spec-checked.ts', check: "that the owner's words do not hold", stated: /Quotation marks within a few words after "owner"/ },
    { file: 'check/spec-checked.ts', check: 'is missing. Before the owner is asked to confirm', stated: /`<name>\.checked\.json` is of the spec as it stands/ },
    { file: 'check/spec-checked.ts', check: 'is of an earlier spec', stated: /an edit after the check means a second\s+check/ },
    { file: 'check/spec-checked.ts', check: 'needs `quotes` and `facts`', stated: /`holds` is `true`, `false` or `"unchecked"`/ },
    { file: 'check/spec-checked.ts', check: 'of its facts lack a `claim`', stated: /Each fact has one `source`/ },
    { file: 'check/spec-checked.ts', check: 'its reader found false at the source', stated: /A fact found false is fixed in the spec/ },
    { file: 'check/spec-checked.ts', check: 'nothing of why', stated: /with a `note` for anything but\s+`true`/ },
    { file: 'check/spec-checked.ts', check: 'a path from the project root, `path:line`, or a URL, and nothing else', stated: /a path from the project root, `path:line`, or a\s+URL, and nothing else/ },
    { file: 'commands/gate.ts', check: 'the owner was never asked to confirm it', stated: /only on the owner's yes, in this session, to the sheet/ },
  ],
  mockup: [
    { file: 'commands/gate.ts', check: 'writes under .jig/ only', stated: /A mockup writes under `\.jig\/` only/ },
    { file: 'commands/gate.ts', check: 'Fix the drawing before you put it to the owner', stated: /The drawing shows what the spec lists/ },
    { file: 'commands/gate.ts', check: 'is still pending. It records the user', stated: /stays `pending` until the owner answers/ },
    { file: 'check/owner-word.ts', check: 'Words the owner said about something else are not their word on this', stated: /are about something else, are not their word on the drawing/ },
    { file: 'commands/gate.ts', check: '`mockup_at:` is empty', stated: /`mockup_at:` names the approved drawing/ },
    { file: 'commands/gate.ts', check: 'has changed since the owner approved it', stated: /An approved drawing does not change/ },
  ],
  tweak: [
    { file: 'commands/gate.ts', check: 'is not confirmed. A tweak changes a page', stated: /The spec is confirmed, and its mockup approved or skipped/ },
    { file: 'commands/gate.ts', check: 'A tweak changes a page whose drawing the owner has approved (or skipped)', stated: /its mockup approved or skipped/ },
    { file: 'commands/gate.ts', check: 'the regions under `sizes:` differ', stated: /regions and its approved drawing stay as they were/ },
    { file: 'commands/gate.ts', check: 'tweak.json is missing', stated: /`tweak\.json` holds `at`, `change`, `ids`/ },
    { file: 'commands/gate.ts', check: 'not fields', stated: /and no other field/ },
    { file: 'commands/gate.ts', check: 'has no `change`: the owner', stated: /`change` is the owner's words for the change/ },
    { file: 'commands/gate.ts', check: 'Each named verdict is re-judged on the changed page by a reader that did not make the change', stated: /each is re-judged by a reader\s+that did not make the change/ },
    { file: 'commands/gate.ts', check: 'which the owner did not say in this session. It is their words for the change', stated: /exactly as they gave them in\s+this session/ },
    { file: 'commands/gate.ts', check: 'names nothing to re-judge', stated: /names at least one rule or decision/ },
    { file: 'commands/gate.ts', check: 'defers its re-judge, and nobody said to', stated: /unless `deferred` quotes the owner/ },
  ],
};

describe('the gate\'s rules are stated where each command finishes', () => {
  for (const [command, rules] of Object.entries(RULES)) {
    it(`lists every check on a ${command} session before it stops`, () => {
      const stated = list(command);
      expect(stated, `no "Before you stop" list for ${command}`).not.toBe('');
      for (const rule of rules) {
        expect(src(rule.file), `the gate no longer checks "${rule.check}"`).toContain(rule.check);
        expect(stated, `the ${command} list does not state "${rule.check}"`).toMatch(rule.stated);
      }
    });
  }

  // A new check in these functions with no line in the list fails here.
  const pushes = (file: string, fn: string) => {
    const body = src(file).split(new RegExp(`function ${fn}\\(`))[1]!.split(/\n}\n/)[0]!;
    return body.split('problems.push(').slice(1).map((chunk) => chunk.slice(0, 400));
  };
  it('pairs every refusal of the spec check and of tweak.json with a stated rule', () => {
    const known = [...RULES.spec, ...RULES.tweak].map((r) => r.check);
    for (const [file, fn] of [['check/spec-checked.ts', 'specCheckProblems'], ['commands/gate.ts', 'tweakProblems']] as const) {
      for (const message of pushes(file, fn)) {
        if (message.startsWith('...')) continue; // another function's list, checked where it is written
        expect(known.some((k) => message.includes(k)), `${fn} refuses with a message no stated rule covers: ${message.slice(0, 120)}`).toBe(true);
      }
    }
  });
});
