import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { assetRoot } from '../paths.js';
import { citableIds } from '../rules/citations.js';
import { probeCheck, readProbes } from '../probe/check.js';
import { PROBE_WIDTHS } from '../probe/save.js';
import { decisionHeadings, decisionNames, decisionsFile } from '../check/decisions.js';
import { specIndexableField } from '../check/spec-shape.js';
import { lf, readText } from '../text.js';

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
  /** Findings the owner has already ruled on, each citing the decision: reported, not counted as findings. */
  ruled?: number;
  /** Decisions recorded after this critique judged the page; the next critique judges them. */
  since?: string[];
}

export interface VerdictsResult {
  ok: boolean;
  errors: string[];
  screen: ArmResult;
  code: ArmResult;
  /** The project's own decisions, judged against the page. */
  decisions: ArmResult;
  rendered: boolean;
  /**
   * What the render probe measured the page failing, whatever the verdicts say:
   * findings on the page for make or tweak to fix. They leave the critique
   * complete; `ok` speaks only for the review.
   */
  measured: string[];
  line: string;
  /** Each earlier finding, set against this critique: fixed, still open, or new. */
  previous?: PreviousFindings;
}

export interface PreviousFindings {
  /** The commit whose verdicts this critique is compared with. */
  commit: string;
  /** Findings now judged ok or n/a, where the source they point at changed. */
  fixed: string[];
  /**
   * Findings now judged ok or n/a where the lines they cited did not change: a
   * different reading, or a fix made somewhere the finding did not point (on
   * jig-site, H-46 cited the inline-code recipe in prose.ts and was fixed in the
   * page that had not used it). Worth a look, not a verdict of its own.
   */
  unchanged: string[];
  open: string[];
  added: string[];
  ruled: string[];
}

interface Verdict {
  id?: unknown;
  verdict?: unknown;
  reason?: unknown;
  ruling?: unknown;
}

const VERDICTS = ['ok', 'finding', 'n/a'];

/**
 * A rule verdict may also be `ruled`: the page breaks the rule because the
 * owner decided it should, and the verdict names that decision in `ruling`.
 *
 * On jig-site the header critique counted 15 findings, five of them recorded
 * owner rulings (the icon-only toggle, the mono wordmark, the menu at every
 * phone width). Labelled "owner-ruled" in prose and counted as findings, they
 * inflated every count and went back to make, which could only leave them.
 */
const RULE_VERDICTS = [...VERDICTS, 'ruled'];

// An n/a is a verdict about the rule. "Rule not found" is not — it says the arm
// never read the rule, and a live run wrote exactly that about C-68 and D-27,
// both of which resolve.
const ABSENCE = /\b(rule (not found|does not exist)|context unavailable|cannot (find|read|access) (the )?rule|not in (the )?(accessible )?corpus)\b/i;

/**
 * A reason written to be replaced. On jig-site a render arm stopped with 33 of
 * 34 verdicts reading "DRAFT, being refined", and every count still passed:
 * each rule had a verdict, and each verdict had a reason.
 */
const PLACEHOLDER = /^\W*(draft|tbd|todo|placeholder|wip|fixme|xxx|lorem ipsum)\W*($|[,.;:(\u2014-])|\bbeing refined\b|\bto be (judged|written|refined|filled in|completed)\b|\bfill (this )?in later\b/i;

/** A reason shared word for word by this many judged verdicts was not written for any of them. */
const REPEAT_LIMIT = 4;

/**
 * Reasons that say nothing about the page: placeholders, and one sentence
 * pasted across many rules. `n/a` verdicts may share a reason, since one
 * absence (no form on the page) rightly clears many rules.
 */
function reasonProblems(file: string, judged: Array<{ label: string; verdict: string; reason: string }>, errors: string[]): void {
  const shared = new Map<string, string[]>();
  for (const { label, verdict, reason } of judged) {
    const bare = reason.replace(/^[A-Z]{1,2}-\d+[a-z0-9-]*\s*[:\u2014-]?\s*/i, '');
    if (PLACEHOLDER.test(bare)) {
      errors.push(`${file}: ${label} — "${reason}" is a placeholder, not a judgment. Judge it against the page and write what you saw.`);
      continue;
    }
    if (verdict === 'n/a') continue;
    const key = reason.toLowerCase().replace(/\s+/g, ' ');
    shared.set(key, [...(shared.get(key) ?? []), label]);
  }
  for (const [, labels] of shared) {
    if (labels.length < REPEAT_LIMIT) continue;
    const reason = judged.find((j) => j.label === labels[0])!.reason;
    errors.push(`${file}: ${labels.length} verdicts give the same reason, "${reason}" (${labels.slice(0, 5).join(', ')}${labels.length > 5 ? ', …' : ''}). A reason names what on this page holds or breaks that one rule; judge each of them.`);
  }
}

function readJson(path: string, errors: string[]): { rendered?: unknown; artefacts?: unknown; verdicts?: unknown } | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${path}: not valid JSON (${(e as Error).message})`);
    return {};
  }
}

/**
 * Whether this surface is meant to be found: the spec's `indexable:` when it
 * says, otherwise the mode — `editorial` is first-visit content, `product` and
 * `operator` are what somebody reaches after signing in.
 */
function specIndexable(projectRoot: string, surface: string): boolean {
  const path = join(projectRoot, '.jig', 'specs', `${surface}.spec.md`);
  let front = '';
  try {
    front = readText(path).split(/^---\s*$/m)[1] ?? '';
  } catch { /* no spec: fall through to the mode */ }
  const declared = specIndexableField(front);
  if (declared === true || declared === false) return declared;
  const mode = /^\s*mode\s*:\s*(\w+)/im.exec(front)?.[1]?.toLowerCase();
  return mode !== 'product' && mode !== 'operator';
}

/** A navigation region in any size of the spec requires a verdict on P-14. */
function specNeedsNav(projectRoot: string, surface: string): boolean {
  const path = join(projectRoot, '.jig', 'specs', `${surface}.spec.md`);
  if (!existsSync(path)) return false;
  const front = readText(path).split(/^---\s*$/m)[1] ?? '';
  const navField = [...front.matchAll(/^\s*nav:\s*(.+)$/gim)].some((m) => !/^\s*(none|n\/a|-)\b/i.test(m[1]));
  const navRegion = /^\s*-\s*(nav|navigation)\s*:/im.test(front);
  return navField || navRegion;
}

/**
 * Fields a verdict file holds that Jig does not read, where they could hold
 * judgments: a list or an object. On jig-site arms carried findings under ids
 * the corpus does not have; a field of their own would carry them past every
 * count the same way. A note in plain text is left alone.
 */
export function unreadFields(label: string, file: Record<string, unknown> | null, known: string[]): string[] {
  if (!file || typeof file !== 'object') return [];
  return Object.entries(file)
    .filter(([k, v]) => !known.includes(k) && v !== null && typeof v === 'object' && Object.keys(v).length > 0)
    .map(([k]) => `${label}: \`${k}\` is not a field Jig reads, so nothing counts what it holds. A rule's verdict goes in \`verdicts\`; what no rule names, in \`differences\`; a note, in the report.`);
}

function checkArm(
  name: 'screen' | 'code',
  file: ReturnType<typeof readJson>,
  required: string[],
  otherPass: Map<string, string>,
  extraAllowed: Set<string>,
  extraRequired: string[],
  errors: string[],
  decisionList: string[] = [],
): ArmResult {
  const total = required.length + extraRequired.length;
  if (file === null) {
    errors.push(`${name}.json is missing — the ${name} arm has not run, or did not write its verdicts.`);
    return { state: 'missing', judged: 0, total, findings: 0 };
  }
  const list = Array.isArray(file.verdicts) ? (file.verdicts as Verdict[]) : [];
  if (!Array.isArray(file.verdicts)) errors.push(`${name}.json has no "verdicts" array.`);

  const seen = new Set<string>();
  const reasons: Array<{ label: string; verdict: string; reason: string }> = [];
  let findings = 0;
  let ruled = 0;
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
        : `${name}.json: ${written} is not a rule or spec in this corpus. Run \`jig explain ${written}\`; an id that does not resolve is not a verdict. A difference from the spec, or from a source the page quotes, is not a rule: list it under \`differences\` in the same file.`);
      continue;
    }
    if (typeof v.verdict !== 'string' || !RULE_VERDICTS.includes(v.verdict)) {
      errors.push(`${name}.json: ${id} has verdict ${JSON.stringify(v.verdict)} — it must be ok, finding, ruled or n/a.`);
      continue;
    }
    if (v.verdict === 'ruled') {
      const ruling = typeof v.ruling === 'string' ? v.ruling.trim() : '';
      const match = decisionList.find((d) => d.toLowerCase() === ruling.toLowerCase());
      if (!ruling) errors.push(`${name}.json: ${id} is ruled, but names no \`ruling\`. A ruled verdict cites the DECISIONS.md heading that decided it; with none, it is a finding.`);
      else if (!match) errors.push(`${name}.json: ${id} cites the ruling "${ruling}", which is not a heading in DECISIONS.md. Cite the decision as its heading reads, or judge it a finding.`);
      else ruled++;
    }
    const reason = typeof v.reason === 'string' ? v.reason.trim() : '';
    if (!reason) errors.push(`${name}.json: ${id} has no reason.`);
    else if (ABSENCE.test(reason)) errors.push(`${name}.json: ${id} — "${reason}" says the rule was not read. Read it with \`jig explain ${id}\` and judge it.`);
    else reasons.push({ label: id, verdict: v.verdict, reason });
    if (v.verdict === 'finding') findings++;
  }
  reasonProblems(`${name}.json`, reasons, errors);

  // What no rule names: the page against its spec, or against a source it
  // quotes. On jig-site both arms of one critique invented ids to carry these
  // (`page-vs-corpus-1`), and the parent had to move them into its report by
  // hand. Each counts as a finding until it is fixed or ruled on.
  const differences = (file as { differences?: unknown }).differences;
  if (differences !== undefined) {
    if (!Array.isArray(differences)) errors.push(`${name}.json: \`differences\` is not a list.`);
    else for (const d of differences as Array<{ what?: unknown; where?: unknown; against?: unknown }>) {
      const said = (x: unknown) => typeof x === 'string' && x.trim() !== '';
      if (!said(d?.what) || !said(d?.where) || !said(d?.against)) {
        errors.push(`${name}.json: a difference needs \`what\` (what differs), \`where\` (the page's file and line) and \`against\` (the spec line or source it differs from).`);
      } else findings++;
    }
  }

  errors.push(...unreadFields(`${name}.json`, file as Record<string, unknown>, ['verdicts', 'differences', 'rendered', 'artefacts']));

  const missing = [...required, ...extraRequired].filter((id) => !seen.has(id));
  if (missing.length) {
    errors.push(`${name}.json: ${missing.length} of ${total} ids have no verdict: ${missing.join(', ')}. Re-run the arm; never report a short pass.`);
  }
  const judged = total - missing.length;
  return { state: missing.length ? 'incomplete' : 'ran', judged, total, findings, ...(ruled ? { ruled } : {}) };
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
  errors.push(...unreadFields('decisions.json', file as Record<string, unknown>, ['verdicts']));

  const seen = new Set<string>();
  const reasons: Array<{ label: string; verdict: string; reason: string }> = [];
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
      errors.push(v.verdict === 'ruled'
        ? `decisions.json: "${match}" is marked ruled. A decision is not excused by a decision: judge whether the page follows it, ok, finding or n/a. \`ruled\` is for a rule in screen.json or code.json that a decision overrides.`
        : `decisions.json: "${match}" has verdict ${JSON.stringify(v.verdict)} — it must be ok, finding or n/a.`);
      continue;
    }
    const reason = typeof v.reason === 'string' ? v.reason.trim() : '';
    if (!reason) errors.push(`decisions.json: "${match}" has no reason. Name what on the page satisfies it, or what does not.`);
    else if (ABSENCE.test(reason)) errors.push(`decisions.json: "${match}" — "${reason}" says the decision was not read.`);
    else reasons.push({ label: `"${match}"`, verdict: v.verdict, reason });
    if (v.verdict === 'finding') findings++;
  }
  reasonProblems('decisions.json', reasons, errors);

  const unjudged = required.filter((r) => !seen.has(r));
  const since = decisionsSince(projectRoot, dir, unjudged);
  const missing = unjudged.filter((r) => !since.includes(r));
  const total = required.length - since.length;
  if (missing.length) {
    errors.push(`decisions.json: ${missing.length} of ${total} decisions have no verdict: ${missing.join(', ')}.`);
  }
  return { state: missing.length ? 'incomplete' : 'ran', judged: total - missing.length, total, findings, ...(since.length ? { since } : {}) };
}

/**
 * The unjudged decisions that were recorded after this critique's verdicts.
 *
 * A critique judges the decisions that existed when it ran. On jig-site one
 * `/jig decide` session added eight decisions, every finished critique turned
 * "incomplete", and the gate stopped an unrelated spec session over records
 * that could not have judged them. Git says when each was written: a decision
 * whose heading was added in a commit the verdicts' commit does not contain, or
 * is not committed yet, is newer than the critique; the next critique judges it.
 *
 * Strict wherever that cannot be shown: no git, a `decisions.json` never
 * committed or with changes of its own (a critique in progress judges every
 * decision), or a heading already in history when the verdicts were committed.
 */
function decisionsSince(projectRoot: string, dir: string, unjudged: string[]): string[] {
  if (unjudged.length === 0) return [];
  const path = decisionsFile(projectRoot);
  if (!path) return [];
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const verdictFile = relative(projectRoot, join(dir, 'decisions.json')).split(sep).join('/');
    if (git(['status', '--porcelain', '--', verdictFile])) return [];
    const judgedIn = git(['log', '-1', '--format=%H', '--', verdictFile]);
    if (!judgedIn) return [];
    const headings = decisionHeadings(projectRoot);
    return unjudged.filter((name) => {
      const line = headings.get(name);
      if (!line) return false;
      // Newest first, so the last commit is the one that added the heading.
      const addedIn = git(['log', '--format=%H', '-S', line, '--', path]).split('\n').filter(Boolean).pop();
      if (!addedIn) return true; // not committed yet
      try {
        git(['merge-base', '--is-ancestor', addedIn, judgedIn]);
        return false; // in history when the verdicts were written
      } catch {
        return true;
      }
    });
  } catch {
    return [];
  }
}

export function verifyVerdicts(opts: { projectRoot: string; surface: string; packageRoot?: string }): VerdictsResult {
  const root = opts.packageRoot ?? assetRoot();
  const errors: string[] = [];
  const index = JSON.parse(readFileSync(join(root, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
  // A hybrid rule with a pass has a judgment half its detector cannot reach, and
  // the arm judges it there. 0.17 moved ten rules from judgment to hybrid when
  // they got detectors, kept their `pass: code`, and every verdict on them came
  // back "not a rule": a critique that did what the rules said could not pass.
  const judgment = index.filter((r) => r.bucket === 'judgment' || (r.bucket === 'hybrid' && r.pass !== undefined));
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
  const decisionList = decisionNames(opts.projectRoot);
  const screen = checkArm('screen', screenFile, screenIds, passOf, specIds, screenExtraRequired, errors, decisionList);
  const code = checkArm('code', codeFile, codeIds, passOf, specIds, [], errors, decisionList);

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
    const missing = PROBE_WIDTHS.filter((w) => !widths.has(w));
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
  const measured: string[] = [];
  let specFront = '';
  try {
    specFront = readText(join(opts.projectRoot, '.jig', 'specs', `${opts.surface}.spec.md`)).split(/^---\s*$/m)[1] ?? '';
  } catch { /* no spec */ }
  if (specIndexableField(specFront) === 'unreadable') {
    errors.push(`.jig/specs/${opts.surface}.spec.md: \`indexable:\` is neither true nor false, so this review cannot tell whether the page is meant to be found and does not guess. Write \`indexable: true\` or \`indexable: false\`, and put the reason in the spec's body.`);
  } else {
    const probed = probeCheck(probes, verdictOf, specIndexable(opts.projectRoot, opts.surface));
    errors.push(...probed.contradictions);
    // Text on the page is the same at every width: one failure, not four.
    const seen = new Set<string>();
    for (const failure of probed.failures) {
      const what = failure.replace(/^probe-\d+\.json: /, '');
      if (!seen.has(what)) { seen.add(what); measured.push(failure); }
    }
  }

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
    `findings=${screen.findings + code.findings + decisions.findings}` +
    `${(screen.ruled ?? 0) + (code.ruled ?? 0) ? ` ruled=${(screen.ruled ?? 0) + (code.ruled ?? 0)}` : ''}` +
    `${measured.length ? ` measured=${measured.length}` : ''}`;
  const previous = previousFindings(opts.projectRoot, dir);
  return { ok: errors.length === 0, errors, screen, code, decisions, rendered, measured, line, ...(previous ? { previous } : {}) };
}

/**
 * Each finding of the critique before this one, set against this one: fixed,
 * still open, or ruled since; and the findings that are new.
 *
 * A critique's arms read the page and not its history, so that they judge
 * what is there rather than confirm what was said. That left nobody to say
 * which of the last round's findings the make round fixed: on jig-site the
 * owner read two reports side by side to find out. Git has both rounds, so
 * the CLI says it.
 *
* The earlier round is the committed verdicts when this critique's are not
 * committed yet, and otherwise the commit before the one that wrote them.
 *
 * A finding judged ok this time is only fixed if something changed where it
 * pointed. On jig-site `verdicts` reported seven fixed; four of them had
 * flipped because this round's readers read the same unchanged lines
 * differently, and the critique had to correct the count by hand. A finding
 * that cites `file:line` is fixed when one of those lines changed (a file cited
 * with no line, when the file did); one that cites nothing, when anything
 * outside `.jig/` did. The rest are `unchanged`.
 */
export function previousFindings(projectRoot: string, dir: string): PreviousFindings | undefined {
  const git = (args: string[]) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const rel = relative(projectRoot, dir).split('\\').join('/');
  const files = ['screen.json', 'code.json', 'decisions.json'];
  const paths = files.map((f) => `${rel}/${f}`);
  let commit: string;
  let target: string | undefined;
  try {
    const dirty = git(['status', '--porcelain', '--', ...paths]).trim() !== '';
    const touched = git(['log', '--format=%H', '-2', '--', ...paths]).split('\n').filter(Boolean);
    commit = dirty ? touched[0] ?? '' : touched[1] ?? '';
    target = dirty ? undefined : touched[0];
  } catch {
    return undefined;
  }
  if (!commit) return undefined;
  const read = (f: string, at?: string): Map<string, { verdict: string; reason: string }> => {
    const out = new Map<string, { verdict: string; reason: string }>();
    let text: string;
    try { text = at ? lf(git(['show', `${at}:./${rel}/${f}`])) : readText(join(dir, f)); } catch { return out; }
    let body: { verdicts?: unknown };
    try { body = JSON.parse(text); } catch { return out; }
    for (const v of Array.isArray(body.verdicts) ? (body.verdicts as Array<Record<string, unknown>>) : []) {
      const key = String(v.id ?? v.decision ?? '').trim();
      if (key && typeof v.verdict === 'string') out.set(f === 'decisions.json' ? `"${key}"` : key.toUpperCase(), { verdict: v.verdict, reason: String(v.reason ?? '') });
    }
    return out;
  };
  const before = new Map<string, { verdict: string; reason: string }>();
  const now = new Map<string, { verdict: string; reason: string }>();
  for (const f of files) {
    for (const [k, v] of read(f, commit)) before.set(k, v);
    for (const [k, v] of read(f)) now.set(k, v);
  }
  const changed = sourceChanges(git, commit, target);
  const result: PreviousFindings = { commit: commit.slice(0, 7), fixed: [], unchanged: [], open: [], added: [], ruled: [] };
  for (const [k, v] of before) {
    if (v.verdict !== 'finding') continue;
    const after = now.get(k)?.verdict;
    if (after === 'finding') result.open.push(k);
    else if (after === 'ruled') result.ruled.push(k);
    else if (after === 'ok' || after === 'n/a') (changed(v.reason) ? result.fixed : result.unchanged).push(k);
  }
  for (const [k, v] of now) if (v.verdict === 'finding' && before.get(k)?.verdict !== 'finding') result.added.push(k);
  return result;
}

/** A cited path, and the lines cited in it (none: the whole file). */
const CITATION = /([\w@.\-[\]/]*[\w\]-]\.[a-z][a-z0-9]{0,5})(?::(\d+(?:-\d+)?(?:,\s*\d+(?:-\d+)?)*))?/gi;

/**
 * Whether the source a finding's reason points at changed between `from` and
 * `to` (the working tree when `to` is undefined). Paths are matched against
 * the files `from` tracked outside `.jig/`, by suffix, so `prose.ts:76` finds
 * `src/lib/prose.ts`; a word that only looks like a file name matches nothing.
 */
function sourceChanges(git: (args: string[]) => string, from: string, to: string | undefined): (reason: string) => boolean {
  const range = to ? [from, to] : [from];
  let tracked: string[] = [];
  let changedFiles = new Set<string>();
  try {
    tracked = git(['ls-tree', '-r', '--name-only', from]).split('\n').filter((f) => f && !f.startsWith('.jig/'));
    changedFiles = new Set(git(['diff', '--name-only', ...range, '--', '.', ':(exclude).jig']).split('\n').filter(Boolean));
  } catch { /* no history to compare: nothing counts as changed */ }
  const hunks = new Map<string, Array<[number, number]>>();
  const oldRanges = (file: string): Array<[number, number]> => {
    let out = hunks.get(file);
    if (out) return out;
    out = [];
    try {
      for (const m of git(['diff', '-U0', ...range, '--', file]).matchAll(/^@@ -(\d+)(?:,(\d+))? /gm)) {
        const start = Number(m[1]);
        const count = m[2] === undefined ? 1 : Number(m[2]);
        // A pure insertion (count 0) lands between line `start` and the next.
        out.push(count === 0 ? [start, start + 1] : [start, start + count - 1]);
      }
    } catch { /* unreadable diff: no lines changed */ }
    hunks.set(file, out);
    return out;
  };
  return (reason: string) => {
    let cited = false;
    for (const m of reason.matchAll(CITATION)) {
      const path = m[1]!.replace(/^\.\//, '');
      const matches = tracked.filter((f) => f === path || f.endsWith(`/${path}`));
      if (!matches.length) continue;
      cited = true;
      const lines = (m[2] ?? '').split(',').map((r) => r.trim()).filter(Boolean).map((r) => {
        const [a, b] = r.split('-').map(Number);
        return [a!, b ?? a!] as [number, number];
      });
      for (const file of matches) {
        if (!changedFiles.has(file)) continue;
        if (!lines.length) return true;
        if (oldRanges(file).some(([hs, he]) => lines.some(([s, e]) => hs <= e && he >= s))) return true;
      }
    }
    return cited ? false : changedFiles.size > 0;
  };
}
