import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { quoteHeld } from './decisions.js';
import { ownerWordProblem } from './owner-word.js';

/**
 * A spec is checked before the owner is asked to confirm it.
 *
 * `spec` checked itself against the decisions, and nothing checked it against
 * the owner's words or the facts it stated: `make` builds a confirmed spec as
 * written, and `critique` compares the page to the spec. On jig-site a
 * confirmed spec for a docs chapter carried seven errors to the built page (a
 * procedure Jig does not have, a lock written at the wrong moment, sentences
 * about the page's own clicks as reader copy), and the owner had confirmed it.
 *
 * What a machine can hold here: a quotation given as the owner's is in the
 * owner's words; a reader other than the writer has checked the spec as it
 * stands (`<name>.checked.json`, by checksum); a fact that reader found false
 * is not put to the owner; and a source it names in the project exists.
 */

/**
 * The spec's checksum, leaving out `confirmed:` and `mockup:`, which the
 * owner's answer sets after the check (a yes, and perhaps "skip the mockup").
 */
export function specChecksum(body: string): string {
  return createHash('sha256').update(body.replace(/^\s*(confirmed|mockup)\s*:.*$/gim, '')).digest('hex');
}

const mockupLine = (body: string) => /^\s*mockup\s*:\s*(.*)$/im.exec(body.split(/^---\s*$/m)[1] ?? '')?.[1]?.trim() ?? '';

/**
 * A mockup approved or skipped is recorded in the owner's words, and a session
 * that recorded it answers for them.
 *
 * On jig-site the owner approved a drawing "with condition: three columns at
 * 1280 and wider", the condition lived only in the conversation, and `make`
 * moved the switch to 1290. The word that lets `make` build without a drawing,
 * or from one, is the owner's; it is quoted, and the quotation is theirs.
 */
export function mockupWordProblems(spec: { path: string; body: string }, then: string, owner: string): string[] {
  const now = mockupLine(spec.body);
  if (now === mockupLine(then)) return [];
  const m = /^(approved|skipped)\b(.*)$/i.exec(now);
  if (!m) return [];
  const word = m[1]!.toLowerCase() as 'approved' | 'skipped';
  const quoted = /["“]([^"”]+)["”]/.exec(m[2]!)?.[1]?.trim();
  if (!quoted) {
    return [`${spec.path}: \`mockup: ${word}\` is recorded without the owner's words. Write \`mockup: ${word} — "<what they said>"\`, quoting the reply that ${word === 'approved' ? 'approved it' : 'said to skip it'}.`];
  }
  const problem = ownerWordProblem(word === 'approved' ? 'approve' : 'skip', quoted, owner, `${spec.path}: \`mockup: ${word}\``);
  return problem ? [problem] : [];
}

/** Whether the spec still waits on the owner's word about a drawing. */
export function mockupPending(body: string): boolean {
  const now = mockupLine(body);
  return !now || /^pending\b/i.test(now);
}

/**
 * Quotations the spec gives as the owner's: `owner` and, within a few words on
 * the same line, a quotation (`the owner: "…"`, `per the owner, "…"`,
 * `(owner: \"…\")` inside a YAML string); or `the user` followed by a verb of
 * saying or a colon. A spec is full of users who click "Save", and those are
 * labels, not rulings.
 */
export function ownerQuotes(body: string): string[] {
  const quote = String.raw`\\?["“]((?:[^"“”\\\n]|\\(?!"))+?)\\?["”]`;
  const patterns = [
    new RegExp(String.raw`\bowner(?:['’]s)?\b[^"“”\n]{0,30}?` + quote, 'gi'),
    new RegExp(String.raw`\buser(?:['’]s words)?\s*(?:(?:said|says|ruled|wrote|asked|answered|replied)\s*[:,]?|:)\s*` + quote, 'gi'),
  ];
  const out: string[] = [];
  for (const pattern of patterns) {
    for (const m of body.matchAll(pattern)) {
      const q = m[1]!.trim();
      // `not given` is the procedure's word for a reason nobody gave, not a quotation.
      if (q.length >= 3 && !/^not given\b/i.test(q) && !out.includes(q)) out.push(q);
    }
  }
  return out;
}

interface Fact { claim?: unknown; source?: unknown; holds?: unknown; note?: unknown }

/**
 * What stops a spec from being put to the owner, or recorded as theirs.
 *
 * `then` is the spec as the session began; only quotations this session added
 * answer to the owner's words here, since an older one was checked when it was
 * written. `owner` is what the owner said in this session, and `decisions` the
 * project's DECISIONS.md, where the owner's words are quoted too.
 */
export function specCheckProblems(root: string, spec: { path: string; slug: string; body: string }, then: string, owner: string, decisions: string): string[] {
  if (spec.body === then) return [];
  const problems: string[] = [];

  const held = new Set(ownerQuotes(then));
  const sources = [owner, then, decisions].join('\n');
  const unheld = ownerQuotes(spec.body).filter((q) => !held.has(q) && !quoteHeld(q, sources));
  if (unheld.length) {
    problems.push(
      `${spec.path} gives ${unheld.length === 1 ? 'a quotation' : `${unheld.length} quotations`} as the owner's that the owner's words do not hold: ` +
        `${unheld.slice(0, 3).map((q) => `"${q.length > 80 ? `${q.slice(0, 80)}…` : q}"`).join(', ')}. ` +
        `Quote the owner as they said it, or say it in your own words without quotation marks and ask them.`,
    );
  }

  const recordPath = `.jig/specs/${spec.slug}.checked.json`;
  let record: { spec?: unknown; quotes?: unknown; facts?: unknown };
  try {
    record = JSON.parse(readFileSync(join(root, recordPath), 'utf8'));
  } catch {
    problems.push(
      `${recordPath} is missing. Before the owner is asked to confirm, a reader who did not write the spec checks its quotations against the owner's words and its facts against their sources, and writes that record (step 3c). The owner checks the spec by the sheet it gives them.`,
    );
    return problems;
  }
  if (record.spec !== specChecksum(spec.body)) {
    problems.push(`${recordPath} is of an earlier spec: the spec changed after it was checked. Have the spec as it stands checked again; the owner confirms what was checked.`);
  }
  if (!Array.isArray(record.quotes) || !Array.isArray(record.facts)) {
    problems.push(`${recordPath} needs \`quotes\` and \`facts\`, each a list: every quotation given as the owner's, and every statement of how something works with the source it was checked against.`);
    return problems;
  }
  const facts = record.facts as Fact[];
  const incomplete = facts.filter((f) => typeof f?.claim !== 'string' || typeof f.source !== 'string' || !f.source.trim() || ![true, false, 'unchecked'].includes(f.holds as never));
  if (incomplete.length) {
    problems.push(`${recordPath}: ${incomplete.length} of its facts lack a \`claim\`, a \`source\` or a \`holds\` of true, false or "unchecked".`);
  }
  const wrong = facts.filter((f) => f?.holds === false);
  if (wrong.length) {
    problems.push(
      `${spec.path} states ${wrong.length === 1 ? 'a fact' : `${wrong.length} facts`} its reader found false at the source: ` +
        `${wrong.slice(0, 3).map((f) => `"${String(f.claim)}" (${String(f.source)})`).join('; ')}. Fix the spec, then have it checked again, before the owner is asked.`,
    );
  }
  const unsaid = facts.filter((f) => f?.holds === 'unchecked' && !(typeof f.note === 'string' && f.note.trim()));
  if (unsaid.length) problems.push(`${recordPath}: ${unsaid.length} unchecked ${unsaid.length === 1 ? 'fact says' : 'facts say'} nothing of why. Say in \`note\` why the source could not be opened; the owner opens it instead.`);
  const missing = facts
    .map((f) => (typeof f?.source === 'string' ? f.source.trim() : ''))
    .filter((s) => s && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s))
    .filter((s) => {
      const [, file, line] = /^(.+?)(?::(\d+)(?:-\d+)?)?$/.exec(s) ?? [];
      if (!file || !existsSync(join(root, file))) return true;
      if (!line) return false;
      try { return Number(line) > readFileSync(join(root, file), 'utf8').split('\n').length; } catch { return true; }
    });
  if (missing.length) {
    problems.push(`${recordPath} cites ${missing.length === 1 ? 'a source' : 'sources'} the project does not have: ${missing.slice(0, 4).join(', ')}. A fact is checked at a source that exists: \`source\` is a path from the project root, \`path:line\`, or a URL, and nothing else; what you found there goes in \`note\`.`);
  }
  return problems;
}
