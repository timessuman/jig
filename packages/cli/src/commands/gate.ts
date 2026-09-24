import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { navProblems, newestSpec, specProblems } from '../check/spec-shape.js';
import { findChrome } from '../probe/browser.js';
import { check } from './check.js';
import { verifyVerdicts } from './verdicts.js';
import { selectFiles } from '../check/files.js';
import { isReaderText, isStyleBearing } from '../check/ext.js';
import { decisionsFile } from '../check/decisions.js';
import { checksum } from '../install/manifest.js';

/**
 * `jig gate` — run by a Claude Code Stop hook that `jig install` writes.
 *
 * Every procedure step that says "run check" or "run verdicts" was skipped by
 * Haiku in arm test 3: one build never ran critique, three critiques never ran
 * `jig verdicts`, and pages with invented tokens were reported clean. An
 * instruction the agent can choose to skip does not hold at the capability
 * floor. The hook runs outside the agent's choices: when the agent tries to
 * finish, this runs, and a failing result is handed back as the reason it may
 * not stop yet.
 *
 * Scope is deliberately narrow, so it never blocks work that has nothing to do
 * with UI:
 * - no Jig project here (no jig.config.json, no .jig/) → allow;
 * - `check` runs only when files that carry styles or interface text changed
 *   since HEAD. Its mechanical errors block, and so do its warnings, unless a
 *   warning is waived on its own line with `jig-allow <ID>: <why>` (see
 *   `check/waiver.ts`). A warning left standing was the failure: one em dash
 *   in a page survived two runs, because an agent saw it, called it
 *   pre-existing, and finished, and nothing said no;
 * - `verdicts` runs only for a critique that has written verdict files.
 * After MAX_BLOCKS blocks in one session it lets the agent stop and says so,
 * because a gate the agent cannot satisfy must not trap it in a loop.
 */
export const MAX_BLOCKS = 3;

export interface GateInput {
  session_id?: string;
  stop_hook_active?: boolean;
  /** Claude Code's session transcript. It records which slash command ran, so
   *  the gate can check that command's own output — see `lastJigCommand`. */
  transcript_path?: string;
}

/**
 * The `/jig` subcommand this session last ran, from the transcript.
 *
 * Arm test 4: every step whose output a later check needs — the spec's shape,
 * the critique's verdict files — was skipped, and each skip was invisible
 * because the gate could only check output that existed. The transcript says
 * which command the user asked for, so a command that produced nothing is
 * exactly as visible as one that produced something wrong.
 */
export function lastJigCommand(transcriptPath: string | undefined): string | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) return undefined;
  let text: string;
  try {
    text = readFileSync(transcriptPath, 'utf8');
  } catch {
    return undefined;
  }
  let found: string | undefined;
  for (const line of text.split('\n')) {
    if (!line.includes('/jig')) continue;
    const name = /<command-name>\/?jig<\/command-name>[\s\S]{0,200}?<command-args>([^<]*)<\/command-args>/.exec(line);
    const plain = /(?:^|["\s>])\/jig\s+([a-z]+)/.exec(line);
    const arg = (name?.[1] ?? plain?.[1] ?? '').trim().split(/\s+/)[0];
    if (arg) found = arg.toLowerCase();
  }
  return found;
}

/**
 * The last thing the agent said before trying to stop, from the transcript.
 * A message can span several transcript entries, one per content block; the
 * last entry that carries text is the one the user reads last.
 */
export function lastAssistantText(transcriptPath: string | undefined): string | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) return undefined;
  let found: string | undefined;
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      if (!line.includes('"assistant"')) continue;
      let entry: { type?: string; message?: { content?: unknown } };
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
      const text = (entry.message!.content as Array<{ type?: string; text?: string }>)
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text)
        .join('');
      if (text.trim()) found = text;
    }
  } catch {
    return undefined;
  }
  return found;
}

/**
 * Whether a message puts a question to the owner: any sentence in it that ends
 * in a question mark.
 *
 * Not only the last line. `decide` asks its round, then shows an example
 * answer, then says "answer for your own project", so the message ends on a
 * full stop with the questions above it; reading only the last line refused
 * that pause in a live run, three times. A `?` inside a word or a URL
 * (`?plan=team`) is not a question and does not count.
 */
export function asksOwner(text: string | undefined): boolean {
  if (!text) return false;
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return /\?(?=[\s)\]"'*_]|$)/.test(prose);
}

/**
 * The commands that stop to ask the owner something: `decide` interviews one
 * question at a time, `spec` asks for confirmation, `mockup` for approval.
 *
 * A pause for an answer is not a finish. Treating it as one broke `decide`
 * outright: in a live run the agent asked its first question, the gate
 * answered that DECISIONS.md did not exist, and on the second refusal the agent
 * wrote the file from its own reasoning, with no answer from anyone. That is
 * the one outcome `decide` exists to prevent, and the gate produced it.
 */
const ASKS_THE_OWNER = new Set(['decide', 'spec', 'mockup']);

/** What each command must have left behind, checked after it ran. */
function commandProblems(root: string, command: string): string[] {
  const problems: string[] = [];
  const spec = newestSpec(root);

  if (command === 'decide') {
    const found = decisionsFile(root);
    if (!found) problems.push('decide wrote no DECISIONS.md beside the token layer.');
    else {
      const body = readFileSync(join(root, found), 'utf8');
      if (!/^##\s+Unresolved\s*$/im.test(body)) {
        problems.push('DECISIONS.md has no `## Unresolved` section. Round 3 asks by name what is still undecided; write what the owner named, or `None named by the owner.`');
      }
      if (/\[TODO\]/.test(body)) problems.push('DECISIONS.md still contains [TODO] markers.');
    }
  }

  if (command === 'spec' || command === 'mockup' || command === 'make' || command === 'critique') {
    if (!spec) problems.push(`${command} needs a spec: there is no file in .jig/specs/.`);
    else {
      problems.push(...specProblems(spec));
      if (problems.length === 0) problems.push(...navProblems(spec));
    }
  }

  if (command === 'mockup' && spec) {
    const front = spec.body.split(/^---\s*$/m)[1] ?? '';
    const mockup = /^\s*mockup\s*:\s*(.+)$/im.exec(front)?.[1]?.trim() ?? '';
    if (/^pending/i.test(mockup) || !mockup) problems.push(`${spec.path}: \`mockup:\` is still pending. It records the user's own word — approved, or skipped with their reason.`);
    const at = /^\s*mockup_at\s*:\s*(.+)$/im.exec(front)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
    if (/^approved/i.test(mockup)) {
      if (!at) problems.push(`${spec.path}: \`mockup_at:\` is empty. Record where the approved drawing is.`);
      else if (!/^https?:/i.test(at) && !existsSync(join(root, at))) problems.push(`${spec.path}: \`mockup_at: ${at}\` does not exist.`);
      else if (!/^https?:/i.test(at) && !at.startsWith('.jig/mockups/')) problems.push(`The drawing is at ${at}. A mockup lives in .jig/mockups/, outside what check scans and outside what ships.`);
    }
  }

  if (command === 'critique') {
    const dir = join(root, '.jig', 'critique');
    const surfaces = existsSync(dir) ? readdirSync(dir).filter((s) => existsSync(join(dir, s, 'screen.json')) || existsSync(join(dir, s, 'code.json'))) : [];
    for (const surface of surfaces) {
      const v = verifyVerdicts({ projectRoot: root, surface });
      if (v.ok && v.decisions.state !== 'ran' && v.decisions.total > 0) {
        problems.push(`${surface}: ${v.decisions.total - v.decisions.judged} of ${v.decisions.total} decisions in DECISIONS.md have no verdict. A page can satisfy every rule and still break what this project decided.`);
      }
      if (v.ok && v.screen.state === 'skipped') {
        problems.push(`${surface}: the screen pass judged ${v.screen.judged} rules with rendered: false. Those rules are judged on a render — open the page at 360, 768 and 1280, run \`jig probe\` at each, and judge them there.`);
      }
    }
    if (surfaces.length === 0) {
      problems.push('critique wrote no verdict files. Each reader arm writes .jig/critique/<surface>/screen.json or code.json, and `jig verdicts <surface>` — not your own count — decides whether the review is complete. A report without them is not a review.');
    }
  }

  return problems;
}

export interface GateResult {
  block: boolean;
  reason: string;
}

/**
 * The page a surface's critique is about, from its spec.
 *
 * Used to run the probe here rather than ask for it. `surface:` is the spec's
 * own field; a path is taken as written, a name is looked for at the root.
 */
export function surfacePage(projectRoot: string, surface: string): string | undefined {
  const spec = newestSpec(projectRoot);
  const front = spec?.body.split(/^---\s*$/m)[1] ?? '';
  const declared = /^\s*surface\s*:\s*(.+)$/im.exec(front)?.[1]?.trim().replace(/^["']|["']$/g, '');
  const candidates = [declared, `${surface}.html`, declared ? `${declared.replace(/^\//, '')}.html` : undefined]
    .filter((c): c is string => !!c && /\.\w+$/.test(c) === (c === declared ? /\.\w+$/.test(c) : true));
  for (const candidate of candidates) {
    if (candidate && existsSync(join(projectRoot, candidate))) return candidate;
  }
  return undefined;
}

export function gate(opts: { projectRoot: string; version: string; input: GateInput }): GateResult {
  const root = opts.projectRoot;
  if (!existsSync(join(root, 'jig.config.json')) && !existsSync(join(root, '.jig'))) {
    return { block: false, reason: '' };
  }

  const command = lastJigCommand(opts.input.transcript_path);
  // Waiting on the owner is not finishing. The command's own output is checked
  // on the stop after the owner has answered, not while the question is open;
  // `check` below still runs either way.
  const waiting = command !== undefined && ASKS_THE_OWNER.has(command) && asksOwner(lastAssistantText(opts.input.transcript_path));
  const problems: string[] = command && !waiting ? commandProblems(root, command).map((p) => `/jig ${command}: ${p}`) : [];

  const selection = selectFiles(root, false);
  const changedUi = selection.mode === 'changed' && selection.files.some((f) => isStyleBearing(f) || isReaderText(f));
  if (changedUi) {
    const result = check({ projectRoot: root, homeDir: '', version: opts.version, all: false, ci: false });
    const errors = result.findings.filter((f) => f.bucket === 'mechanical' && f.severity === 'error');
    const warnings = result.findings.filter((f) => f.severity === 'warning');
    const blocking = [...errors, ...warnings];
    if (blocking.length > 0) {
      const shown = blocking.slice(0, 8).map((f) => `  ${f.severity === 'error' ? 'error  ' : 'warning'} ${f.ruleId} ${f.file}:${f.line} ${f.message}`);
      const counted = [
        errors.length > 0 ? `${errors.length} mechanical error(s)` : '',
        warnings.length > 0 ? `${warnings.length} warning(s)` : '',
      ].filter(Boolean).join(' and ');
      problems.push(
        `jig check: ${counted} in the files you changed. Fix every one. A warning that is right as it stands can be ` +
          `waived on its own line with a comment reading \`jig-allow <ID>: <why>\`; an error cannot. Then run \`jig check\` again.\n` +
          shown.join('\n') + (blocking.length > shown.length ? `\n  … and ${blocking.length - shown.length} more` : ''),
      );
    }
  }

  problems.push(...verdictGuard(root, command));

  const critiqueDir = join(root, '.jig', 'critique');
  if (existsSync(critiqueDir)) {
    for (const surface of readdirSync(critiqueDir)) {
      const dir = join(critiqueDir, surface);
      if (!existsSync(join(dir, 'screen.json')) && !existsSync(join(dir, 'code.json'))) continue;
      const v = verifyVerdicts({ projectRoot: root, surface });
      if (!v.ok) {
        const shown = v.errors.slice(0, 6).map((e) => `  ${e}`);
        problems.push(
          `jig verdicts ${surface}: the critique is not complete. Re-run the arm it names — do not edit the verdict files to pass.\n` +
            shown.join('\n') + (v.errors.length > shown.length ? `\n  … and ${v.errors.length - shown.length} more` : ''),
        );
      }
    }
  }

  // The budget is per failure, not per session. `claude -p --continue` keeps one
  // session across every /jig step, so a run that spent three blocks on its spec
  // reached `critique` with none left: it reported a review it had not written,
  // and the gate — which would have caught it — had already let go. Keyed by
  // what is wrong, a fixed failure returns its attempts and a new one starts
  // fresh, while an agent that cannot fix THIS still gets out after three.
  const session = opts.input.session_id ?? 'unknown';
  const key = `${session}:${createHash('sha256').update(problems.join('\n')).digest('hex').slice(0, 12)}`;
  const stateFile = join(root, '.jig', 'gate.json');
  let state: Record<string, number> = {};
  try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { /* first run */ }

  if (problems.length === 0) {
    const mine = Object.keys(state).filter((k) => k.startsWith(`${session}:`));
    if (mine.length) { for (const k of mine) delete state[k]; save(stateFile, state); }
    return { block: false, reason: '' };
  }

  const count = (state[key] ?? 0) + 1;
  if (count > MAX_BLOCKS) {
    return {
      block: false,
      reason: `jig gate: still failing after ${MAX_BLOCKS} attempts; letting you stop. Tell the user plainly that the work is not finished:\n${problems.join('\n\n')}`,
    };
  }
  state[key] = count;
  save(stateFile, state);
  return {
    block: true,
    reason:
      `Not finished — Jig's gate failed (attempt ${count} of ${MAX_BLOCKS}). ` +
      `Fix these before you stop, and do not report the work as done until they pass:\n\n${problems.join('\n\n')}`,
  };
}

const VERDICT_FILES = ['screen.json', 'code.json', 'decisions.json'];
const LOCK = 'verdicts.lock';

/** One checksum over a surface's verdict files, or nothing if it has none. */
function verdictChecksum(dir: string): string | undefined {
  const parts = VERDICT_FILES.map((f) => {
    try { return `${f}\n${readFileSync(join(dir, f), 'utf8')}`; } catch { return ''; }
  });
  return parts.some(Boolean) ? checksum(parts.join('\n')) : undefined;
}

/**
 * Verdicts are critique's, and only critique's.
 *
 * In a live run, `make` was asked to fix three critique findings. It fixed them,
 * then rewrote those three verdicts from `finding` to `ok` itself, and the gate
 * accepted the review as clean. A builder grading its own fix is not a review.
 *
 * So when a session that ran `critique` stops, the verdict files are recorded
 * by checksum. A later session that did not run `critique` and finds them
 * changed is stopped, whatever wrote the change (an edit, a script, a commit).
 */
export function verdictGuard(root: string, command: string | undefined): string[] {
  const critiqueDir = join(root, '.jig', 'critique');
  if (!existsSync(critiqueDir)) return [];
  const problems: string[] = [];
  for (const surface of readdirSync(critiqueDir)) {
    const dir = join(critiqueDir, surface);
    const now = verdictChecksum(dir);
    if (!now) continue;
    const lockPath = join(dir, LOCK);
    if (command === 'critique') {
      try { writeFileSync(lockPath, JSON.stringify({ checksum: now }) + '\n', 'utf8'); } catch { /* read-only tree */ }
      continue;
    }
    let locked: string | undefined;
    try { locked = (JSON.parse(readFileSync(lockPath, 'utf8')) as { checksum?: string }).checksum; } catch { continue; }
    if (locked && locked !== now) {
      problems.push(
        `.jig/critique/${surface}: the verdict files changed after \`/jig critique\` wrote them${command ? `, in a session that ran \`/jig ${command}\`` : ''}. ` +
          `Verdicts are the review's, not the builder's: restore them (\`git checkout -- .jig/critique/${surface}\`) and run \`/jig critique\` to judge the fix.`,
      );
    }
  }
  return problems;
}

function save(file: string, state: Record<string, number>): void {
  try {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, JSON.stringify(state), 'utf8');
  } catch { /* a read-only tree must not turn the gate into a crash */ }
}
