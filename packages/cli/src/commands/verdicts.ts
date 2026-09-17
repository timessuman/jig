import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assetRoot } from '../paths.js';
import { citableIds } from '../rules/citations.js';

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

export type ArmState = 'ran' | 'incomplete' | 'missing';

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

  const field = (a: ArmResult) => (a.state === 'ran' ? `ran:${a.judged}` : `${a.state}:${a.judged}${a.state === 'incomplete' ? `/${a.total}` : ''}`);
  const line =
    `JIG_VERDICTS: surface=${opts.surface} screen=${field(screen)} code=${field(code)} ` +
    `rendered=${rendered ? 'yes' : 'no'} findings=${screen.findings + code.findings}`;
  return { ok: errors.length === 0, errors, screen, code, rendered, line };
}
