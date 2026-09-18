import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assetRoot } from '../paths.js';
import { citableIds } from '../rules/citations.js';
import { probeContradictions, readProbes } from '../probe/check.js';
import { decisionNames } from '../check/decisions.js';

/**
 * Verifies a critique's verdict files, and computes its counts.
 *
 * `critique`'s reader arms write one verdict per rule id:
 *   .jig/critique/<surface>/screen.json  { rendered, artefacts, verdicts: [{ id, verdict, reason }] }
 *   .jig/critique/<surface>/code.json    { verdicts: [...] }
 *
 * Why the CLI and not the agent: a live Haiku run of `critique` produced arms
 * that invented rule ids, judged 1 screen rule of 30 and filed it as a review,
 * reported `code=ran:97` against 67 and `ran:100` against both, and ran arms in
 * the builder's own head. Every one of those was already forbidden in the
 * procedure's prose. Numbers an agent writes are a target; numbers this command
 * computes are a measurement.
 */

export type ArmState = 'ran' | 'incomplete' | 'missing' | 'skipped';

export interface ArmResult {
  state: ArmState;
  judged: number;
  total: number;
  findings: number;
}

export interface VerdictsResult {
  ok: boolean;
  errors: string[];
  screen: ArmResult;
  code: ArmResult;
  /** The project's own decisions, judged against the page. */
  decisions: ArmResult;
  rendered: boolean;
  line: string;
}

interface Verdict {
  id?: unknown;
  verdict?: unknown;
  reason?: unknown;
}

const VERDICTS = ['ok', 'finding', 'n/a'];

// An n/a is a verdict about the rule. "Rule not found" is not — it says the arm
// never read the rule, and a live run wrote exactly that about C-68 and D-27,
// both of which resolve.
const ABSENCE = /\b(rule (not found|does not exist)|context unavailable|cannot (find|read|access) (the )?rule|not in (the )?(accessible )?corpus)\b/i;

function readJson(path: string, errors: string[]): { rendered?: unknown; artefacts?: unknown; verdicts?: unknown } | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${path}: not valid JSON (${(e as Error).message})`);
    return {};
  }
}

/** A navigation region in any size of the spec requires a verdict on P-14. */
function specNeedsNav(projectRoot: string, surface: string): boolean {
  const path = join(projectRoot, '.jig', 'specs', `${surface}.spec.md`);
  if (!existsSync(path)) return false;
  const front = readFileSync(path, 'utf8').split(/^---\s*$/m)[1] ?? '';
  const navField = [...front.matchAll(/^\s*nav:\s*(.+)$/gim)].some((m) => !/^\s*(none|n\/a|-)\b/i.test(m[1]));
  const navRegion = /^\s*-\s*(nav|navigation)\s*:/im.test(front);
  return navField || navRegion;
}

function checkArm(
  name: 'screen' | 'code',
  file: ReturnType<typeof readJson>,
  required: string[],
  otherPass: Map<string, string>,
  extraAllowed: Set<string>,
  extraRequired: string[],
  errors: string[],
): ArmResult {
  const total = required.length + extraRequired.length;
  if (file === null) {
    errors.push(`${name}.json is missing — the ${name} arm has not run, or did not write its verdicts.`);
    return { state: 'missing', judged: 0, total, findings: 0 };
  }
  const list = Array.isArray(file.verdicts) ? (file.verdicts as Verdict[]) : [];
  if (!Array.isArray(file.verdicts)) errors.push(`${name}.json has no "verdicts" array.`);

  const seen = new Set<string>();
  let findings = 0;
  for (const v of list) {
    const written = typeof v.id === 'string' ? v.id.trim() : '';
    const id = written.toUpperCase();
    if (!id) { errors.push(`${name}.json: a verdict has no id.`); continue; }
    if (seen.has(id)) { errors.push(`${name}.json: ${id} is judged more than once.`); continue; }
    seen.add(id);

    const pass = otherPass.get(id);
    if (!required.includes(id) && !extraAllowed.has(id)) {
      errors.push(pass === 'mechanical'
        ? `${name}.json: ${id} is a mechanical rule — \`jig check\` decides it, so it has no verdict here. Remove it.`
        : pass
        ? `${name}.json: ${id} is a pass: ${pass} rule — it belongs to the other arm.`
        : `${name}.json: ${written} is not a rule or spec in this corpus. Run \`jig explain ${written}\`; an id that does not resolve is not a verdict.`);
      continue;
    }
    if (typeof v.verdict !== 'string' || !VERDICTS.includes(v.verdict)) {
      errors.push(`${name}.json: ${id} has verdict ${JSON.stringify(v.verdict)} — it must be ok, finding or n/a.`);
      continue;
    }
    const reason = typeof v.reason === 'string' ? v.reason.trim() : '';
    if (!reason) errors.push(`${name}.json: ${id} has no reason.`);
    else if (ABSENCE.test(reason)) errors.push(`${name}.json: ${id} — "${reason}" says the rule was not read. Read it with \`jig explain ${id}\` and judge it.`);
    if (v.verdict === 'finding') findings++;
  }

  const missing = [...required, ...extraRequired].filter((id) => !seen.has(id));
  if (missing.length) {
    errors.push(`${name}.json: ${missing.length} of ${total} ids have no verdict: ${missing.join(', ')}. Re-run the arm; never report a short pass.`);
  }
  const judged = total - missing.length;
  return { state: missing.length ? 'incomplete' : 'ran', judged, total, findings };
}

/**
 * `.jig/critique/<surface>/decisions.json`: one verdict per named decision.
 *
 * A project with no `DECISIONS.md` has nothing to judge, and says so with
 * `decisions=ran:0` rather than a complaint.
 */
function checkDecisions(projectRoot: string, dir: string, errors: string[]): ArmResult {
  const required = decisionNames(projectRoot);
  if (required.length === 0) return { state: 'ran', judged: 0, total: 0, findings: 0 };

  const file = readJson(join(dir, 'decisions.json'), errors);
  if (!file) {
    errors.push(
      `decisions.json is missing. Every decision in DECISIONS.md is judged against the built page, ` +
        `one verdict each: ${required.slice(0, 4).join(', ')}${required.length > 4 ? `, and ${required.length - 4} more` : ''}. ` +
        `A page can satisfy every rule and still break what this project decided.`,
    );
    return { state: 'missing', judged: 0, total: required.length, findings: 0 };
  }

  const list = Array.isArray(file.verdicts) ? (file.verdicts as Array<{ decision?: unknown; verdict?: unknown; reason?: unknown }>) : [];
  if (!Array.isArray(file.verdicts)) errors.push('decisions.json has no "verdicts" array.');

  const seen = new Set<string>();
  let findings = 0;
  for (const v of list) {
    const name = typeof v.decision === 'string' ? v.decision.trim() : '';
    if (!name) { errors.push('decisions.json: a verdict names no decision.'); continue; }
    const match = required.find((r) => r.toLowerCase() === name.toLowerCase());
    if (!match) {
      errors.push(`decisions.json: "${name}" is not a heading in DECISIONS.md. Judge the decisions the project made, not ones you name yourself.`);
      continue;
    }
    if (seen.has(match)) { errors.push(`decisions.json: "${match}" is judged more than once.`); continue; }
    seen.add(match);
    if (typeof v.verdict !== 'string' || !VERDICTS.includes(v.verdict)) {
      errors.push(`decisions.json: "${match}" has verdict ${JSON.stringify(v.verdict)} — it must be ok, finding or n/a.`);
      continue;
    }
    const reason = typeof v.reason === 'string' ? v.reason.trim() : '';
    if (!reason) errors.push(`decisions.json: "${match}" has no reason. Name what on the page satisfies it, or what does not.`);
    else if (ABSENCE.test(reason)) errors.push(`decisions.json: "${match}" — "${reason}" says the decision was not read.`);
    if (v.verdict === 'finding') findings++;
  }

  const missing = required.filter((r) => !seen.has(r));
  if (missing.length) {
    errors.push(`decisions.json: ${missing.length} of ${required.length} decisions have no verdict: ${missing.join(', ')}.`);
  }
  return { state: missing.length ? 'incomplete' : 'ran', judged: required.length - missing.length, total: required.length, findings };
}

export function verifyVerdicts(opts: { projectRoot: string; surface: string; packageRoot?: string }): VerdictsResult {
  const root = opts.packageRoot ?? assetRoot();
  const errors: string[] = [];
  const index = JSON.parse(readFileSync(join(root, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
  const judgment = index.filter((r) => r.bucket === 'judgment');
  const screenIds = judgment.filter((r) => r.pass === 'screen').map((r) => r.id);
  const codeIds = judgment.filter((r) => r.pass === 'code').map((r) => r.id);
  // Mechanical ids are real rules; a verdict naming one is misfiled, not
  // invented, and saying "not a rule" sent an agent to look for a typo.
  const passOf = new Map([
    ...index.filter((r) => r.bucket === 'mechanical').map((r) => [r.id, 'mechanical'] as [string, string]),
    ...judgment.map((r) => [r.id, r.pass ?? ''] as [string, string]),
  ]);
  const specIds = new Set(citableIds(root).filter((id) => /^[PMLRT]-\d+$/.test(id)));

  const dir = join(opts.projectRoot, '.jig', 'critique', opts.surface);
  const screenFile = readJson(join(dir, 'screen.json'), errors);
  const codeFile = readJson(join(dir, 'code.json'), errors);

  const screenExtraRequired = specNeedsNav(opts.projectRoot, opts.surface) ? ['P-14'] : [];
  const screen = checkArm('screen', screenFile, screenIds, passOf, specIds, screenExtraRequired, errors);
  const code = checkArm('code', codeFile, codeIds, passOf, specIds, [], errors);

  let rendered = false;
  if (screenFile && screenFile.rendered === true) {
    const artefacts = Array.isArray(screenFile.artefacts) ? (screenFile.artefacts as unknown[]).filter((a): a is string => typeof a === 'string') : [];
    const absent = artefacts.filter((a) => !existsSync(resolve(opts.projectRoot, a)));
    if (artefacts.length === 0) errors.push('screen.json says rendered: true but lists no artefacts. A render leaves a screenshot.');
    else if (absent.length) errors.push(`screen.json says rendered: true, but these artefacts do not exist: ${absent.join(', ')}.`);
    else rendered = true;
  }

  // A rendered review is measured, not only described. See probe/script.ts.
  const probes = readProbes(opts.projectRoot, dir, errors);
  if (screenFile && screenFile.rendered === true) {
    const widths = new Set(probes.map((p) => p.width));
    const missing = [360, 768, 1280].filter((w) => !widths.has(w));
    if (missing.length) {
      errors.push(`screen.json says rendered: true, but there is no probe at ${missing.join(', ')}px. At each width run \`jig probe\` in the browser and save its output as probe-<width>.json.`);
      rendered = false;
    }
  }
  const screenVerdicts = Array.isArray(screenFile?.verdicts) ? (screenFile!.verdicts as Verdict[]) : [];
  const verdictOf = (id: string) => {
    const v = screenVerdicts.find((x) => typeof x.id === 'string' && x.id.trim().toUpperCase() === id);
    return typeof v?.verdict === 'string' ? v.verdict : undefined;
  };
  errors.push(...probeContradictions(probes, verdictOf));

  // The screen pass is defined as judged on a render. Three live critiques
  // returned 30 screen verdicts each with `rendered: false` — read from the
  // source and reported as a full pass. Without a render the arm did not run.
  if (screen.state === 'ran' && !rendered) screen.state = 'skipped';

  // The project's decisions are judged like the rules: the CLI cannot say
  // whether a page honours "the accent appears exactly twice", but it can say
  // whether anyone looked. Two pages in a live round broke a decision each and
  // passed every rule.
  const decisions = checkDecisions(opts.projectRoot, dir, errors);

  const field = (a: ArmResult) => (a.state === 'ran' ? `ran:${a.judged}` : `${a.state}:${a.judged}${a.state === 'incomplete' ? `/${a.total}` : ''}`);
  const line =
    `JIG_VERDICTS: surface=${opts.surface} screen=${field(screen)} code=${field(code)} ` +
    `decisions=${field(decisions)} rendered=${rendered ? 'yes' : 'no'} ` +
    `findings=${screen.findings + code.findings + decisions.findings}`;
  return { ok: errors.length === 0, errors, screen, code, decisions, rendered, line };
}
