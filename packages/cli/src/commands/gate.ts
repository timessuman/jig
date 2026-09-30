import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { newFieldProblems, navProblems, specFor, specProblems } from '../check/spec-shape.js';
import { findChrome } from '../probe/browser.js';
import { check } from './check.js';
import { approvedDrawingProblems, mockupDrawingProblems, specRegions } from '../check/mockup-drawing.js';
import { execFileSync } from 'node:child_process';
import { verifyVerdicts } from './verdicts.js';
import { selectFiles } from '../check/files.js';
import { isReaderText, isStyleBearing } from '../check/ext.js';
import { decisionsFile, quoteHeld, quotesNotFrom, unsourcedReasons } from '../check/decisions.js';
import { critiqueAtShip, pageChecksum, ship } from './ship.js';
import { mockupPending, mockupWordProblems, specCheckProblems } from '../check/spec-checked.js';
import { ownerWordProblem } from '../check/owner-word.js';
import { checksum } from '../install/manifest.js';
import { recordedPage } from '../probe/save.js';
import { lf, readText } from '../text.js';
import { agentFileProblems } from '../install/agent-files.js';

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
  return lastJigInvocation(transcriptPath)?.command;
}

/**
 * The command and its first argument (the surface, where it names one), from
 * what the user sent: a slash command's tags, or a message that opens with
 * `/jig`. Only the user's own messages count. Matching any line that mentioned
 * `/jig critique` read the command file Jig loads into the session, and the
 * tool results quoting it, as commands: a `tweak` session on jig-site was
 * judged as a `critique` from its second stop on.
 */
export function lastJigInvocation(transcriptPath: string | undefined): { command: string; surface?: string } | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) return undefined;
  let text: string;
  try {
    text = readFileSync(transcriptPath, 'utf8');
  } catch {
    return undefined;
  }
  let found: { command: string; surface?: string } | undefined;
  for (const line of text.split('\n')) {
    if (!line.includes('/jig')) continue;
    let entry: { type?: string; isMeta?: boolean; message?: { content?: unknown } };
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== 'user' || entry.isMeta) continue;
    const content = entry.message?.content;
    const texts = typeof content === 'string'
      ? [content]
      : Array.isArray(content)
      ? content.filter((b): b is { type: string; text: string } => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text)
      : [];
    for (const t of texts) {
      // Up to the closing tag, not the first `<`: on jig-site a tweak's words
      // named `<name>.checked.json`, the command read as none, and the session
      // went on without the gate knowing it was a tweak.
      const args = /<command-name>\/?jig<\/command-name>[\s\S]{0,200}?<command-args>([\s\S]*?)<\/command-args>/.exec(t)?.[1]
        ?? /^\s*\/jig\s+([^\n]*)/.exec(t)?.[1];
      const [command, surface] = (args ?? '').trim().split(/\s+/);
      if (command && /^[a-z]+$/i.test(command)) found = { command: command.toLowerCase(), ...(surface && /^[\w.-]+$/.test(surface) ? { surface } : {}) };
    }
  }
  return found;
}

/**
 * Everything the owner said in this session: the text of their own messages,
 * not the command file Jig loads (`isMeta`) and not tool results, which
 * arrive under the same `user` role.
 */
export function ownerWords(transcriptPath: string | undefined): string {
  if (!transcriptPath || !existsSync(transcriptPath)) return '';
  const said: string[] = [];
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      if (!line.includes('"user"')) continue;
      let entry: { type?: string; isMeta?: boolean; message?: { content?: unknown } };
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry.type !== 'user' || entry.isMeta) continue;
      const content = entry.message?.content;
      if (typeof content === 'string') said.push(content);
      else if (Array.isArray(content)) {
        for (const b of content as Array<{ type?: string; text?: unknown }>) if (b?.type === 'text' && typeof b.text === 'string') said.push(b.text);
      }
    }
  } catch {
    return '';
  }
  return said.join('\n');
}

/**
 * The spec a `spec` session works on: the file its command names, exactly, or
 * none. Falling back to the newest spec checked another page's: on jig-site a
 * session for a new chapter drafted its spec outside `.jig/specs/`, and the gate
 * checked the chapter before it and let the draft go to the owner unchecked.
 */
function namedSpec(root: string, surface: string | undefined): { path: string; slug: string; body: string } | undefined {
  if (!surface) return specFor(root, undefined);
  return existsSync(join(root, '.jig', 'specs', `${surface}.spec.md`)) ? specFor(root, surface) : undefined;
}

/** Whether a spec's front matter says `confirmed: true`. */
function isConfirmed(body: string): boolean {
  return /^\s*confirmed\s*:\s*true\b/im.test(body.split(/^---\s*$/m)[1] ?? '');
}

/**
 * What the owner said after the agent last asked them something matching
 * `asked`: their answer to that question, and nothing said before it. Undefined
 * when the agent never asked.
 */
export function ownerReplyAfter(transcriptPath: string | undefined, asked: RegExp): string | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) return undefined;
  const turns: Array<{ who: 'owner' | 'agent'; text: string }> = [];
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      let entry: { type?: string; isMeta?: boolean; message?: { content?: unknown } };
      try { entry = JSON.parse(line); } catch { continue; }
      if ((entry.type !== 'user' && entry.type !== 'assistant') || entry.isMeta) continue;
      const content = entry.message?.content;
      const texts = typeof content === 'string' ? [content] : Array.isArray(content) ? (content as Array<{ type?: string; text?: unknown }>).filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text as string) : [];
      for (const text of texts) turns.push({ who: entry.type === 'user' ? 'owner' : 'agent', text });
    }
  } catch {
    return undefined;
  }
  // The latest question the owner answered: an agent turn matching `asked`
  // with an owner turn after it, and that answer up to the agent's next turn.
  // Taking the last agent turn that mentions it read the agent's own report
  // after the answer ("`confirmed: true` is set") as the question, and found
  // no reply: on jig-site a confirmed spec was held for want of a second yes.
  let answer: string | undefined;
  turns.forEach((t, i) => {
    if (t.who !== 'agent' || !asked.test(t.text)) return;
    const reply: string[] = [];
    for (let j = i + 1; j < turns.length && turns[j]!.who === 'owner'; j++) reply.push(turns[j]!.text);
    if (reply.length) answer = reply.join('\n');
  });
  return answer;
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
const ASKS_THE_OWNER = new Set(['decide', 'spec', 'mockup', 'tweak']);

/** When this session began: the first timestamp in its transcript. */
export function sessionStart(transcriptPath: string | undefined): number | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) return undefined;
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      const m = /"timestamp"\s*:\s*"([^"]+)"/.exec(line);
      if (m) {
        const t = Date.parse(m[1]!);
        if (!Number.isNaN(t)) return t;
      }
    }
  } catch { /* unreadable: treat as unknown */ }
  return undefined;
}

/**
 * When a critique's verdicts last changed. Only the verdict files count: a
 * make round that saved a probe into the folder measured the page, it did not
 * review it, and judging that folder asked make for verdicts only critique may
 * write. The gate's own lock is not a verdict file either.
 */
function verdictsMtime(dir: string): number {
  let newest = 0;
  for (const name of VERDICT_FILES) {
    try { newest = Math.max(newest, statSync(join(dir, name)).mtimeMs); } catch { /* not written */ }
  }
  return newest;
}

/**
 * The critiques this session is answerable for.
 *
 * Checking every critique on every stop blocked unrelated work three times on
 * one site: a spec for one page could not finish because another page's
 * critique predated a release that added rules, and a record the project had
 * set aside still failed for screenshots that no longer existed. A stop is
 * judged on what it touched: a critique whose verdict files changed since this
 * session began, and the current spec's surface when the session ran
 * `critique`. A directory whose name starts with `_` is set aside and never
 * judged. With no transcript to date the session (the gate run by hand), every
 * critique is.
 */
export function surfacesInPlay(root: string, command: string | undefined, transcriptPath: string | undefined, surface?: string): string[] {
  const critiqueDir = join(root, '.jig', 'critique');
  if (!existsSync(critiqueDir)) return [];
  const all = readdirSync(critiqueDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map((d) => d.name);
  const start = sessionStart(transcriptPath);
  if (start === undefined) return all;
  // Named by the spec's file, as the critique's directory is: the spec's
  // `surface:` field is a description, and on jig-site it was a sentence.
  const current = command === 'critique' || command === 'tweak' ? specFor(root, surface)?.slug : undefined;
  // A second of slack: file times and transcript times come from different clocks' rounding.
  return all.filter((s) => s === current || verdictsMtime(join(critiqueDir, s)) >= start - 1000);
}

/**
 * The critiques whose probes the Stop hook refreshes before it judges: the
 * ones it is about to judge, and no others.
 *
 * It refreshed every critique's probes on every stop. A change every page
 * shares (the header gaining a link) makes every page's probes stale, so on
 * jig-site each stop of a Guide session re-rendered home, the Reference, the
 * header and Versions and left sixty probe files changed that no one had asked
 * for; three sessions committed them. A page's probes are refreshed when its
 * own critique or tweak runs, which is when anything reads them.
 */
export function surfacesToProbe(root: string, input: GateInput): string[] {
  const invocation = lastJigInvocation(input.transcript_path);
  return surfacesInPlay(root, invocation?.command, input.transcript_path, invocation?.surface);
}

/**
 * A file as it stood when this session began: its content at the last commit
 * made before then, or at HEAD when the session has no start to date it. Empty
 * when git has no copy, so everything in the file counts as this session's.
 */
function fileAtSessionStart(root: string, path: string, start: number | undefined): string {
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  // A file this session never wrote is as it found it, committed or not. Read
  // from git alone, an uncommitted draft counted as all this session's work: on
  // jig-site a fresh session found a spec holding the owner's quotations from an
  // earlier session, was told they were unsupported, and turned them into
  // paraphrase.
  try {
    if (start !== undefined && statSync(join(root, path)).mtimeMs < start - 1000) return readText(join(root, path));
  } catch { /* no such file: git decides */ }
  try {
    const base = start === undefined ? 'HEAD' : git(['rev-list', '-1', `--before=@${Math.floor(start / 1000)}`, 'HEAD']).trim();
    return base ? lf(git(['show', `${base}:./${path}`])) : '';
  } catch {
    return '';
  }
}

/**
 * Tracked files outside .jig/ that differ from the commit this session began
 * on, and files outside .jig/ created since it began. With no start to date
 * the session, only uncommitted changes count.
 */
function changedOutsideRecords(root: string, start: number | undefined): string[] {
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const base = start === undefined ? 'HEAD' : git(['rev-list', '-1', `--before=@${Math.floor(start / 1000)}`, 'HEAD']).trim();
    if (!base) return [];
    const changed = git(['diff', '--name-only', base, '--', '.', ':(exclude).jig']).split('\n').filter(Boolean);
    const created = git(['ls-files', '--others', '--exclude-standard', '--', '.', ':(exclude).jig']).split('\n').filter(Boolean)
      .filter((f) => {
        try { return start === undefined || statSync(join(root, f)).mtimeMs >= start - 1000; } catch { return false; }
      });
    return [...new Set([...changed, ...created])].sort();
  } catch {
    return [];
  }
}

/** The approval commit, short, when the drawing differs from what it recorded. */
function drawingChangedAfterApproval(root: string, specPath: string, at: string): string | undefined {
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const approvedIn = git(['log', '-1', '--format=%H', '-G', '^mockup[[:space:]]*:[[:space:]]*approved', '--', specPath]).trim();
    if (!approvedIn) return undefined;
    const then = lf(git(['show', `${approvedIn}:./${at}`]));
    return then !== readText(join(root, at)) ? approvedIn.slice(0, 7) : undefined;
  } catch {
    return undefined;
  }
}

/** What each command must have left behind, checked after it ran. */
function commandProblems(root: string, command: string, surface?: string, start?: number, owner = ''): string[] {
  const problems: string[] = [];
  const spec = specFor(root, surface);

  if (command === 'decide') {
    const found = decisionsFile(root);
    if (!found) problems.push('decide wrote no DECISIONS.md beside the token layer.');
    else {
      const body = readText(join(root, found));
      if (!/^##\s+Unresolved\s*$/im.test(body)) {
        problems.push('DECISIONS.md has no `## Unresolved` section. Round 3 asks by name what is still undecided; write what the owner named, or `None named by the owner.`');
      }
      if (/\[TODO\]/.test(body)) problems.push('DECISIONS.md still contains [TODO] markers.');
      // Only the reasons this session wrote. An amendment answers for the Why it
      // adds, not for one an earlier round wrote: on jig-site three amendments
      // in a row had to relabel another round's reason before the gate let go.
      const then = fileAtSessionStart(root, found, start);
      problems.push(...unsourcedReasons(body, then, { newWhysOnly: true }).map((p) => `DECISIONS.md: ${p}`));
      if (owner) problems.push(...quotesNotFrom(body, then, owner, 'the owner\'s words in this session').map((p) => `DECISIONS.md: ${p}`));
    }
  }

  if (command === 'spec' && surface && !existsSync(join(root, '.jig', 'specs', `${surface}.spec.md`))) {
    problems.push(`spec wrote no .jig/specs/${surface}.spec.md. The spec is that file: a draft anywhere else is read by no later step and checked by nothing.`);
    return problems;
  }
  if (command === 'spec' || command === 'mockup' || command === 'make' || command === 'critique' || command === 'tweak') {
    if (!spec) problems.push(`${command} needs a spec: there is no file in .jig/specs/.`);
    else {
      problems.push(...specProblems(spec));
      problems.push(...newFieldProblems(spec, fileAtSessionStart(root, spec.path, start)));
      if (problems.length === 0) problems.push(...navProblems(spec));
    }
  }

  if (command === 'spec' && spec) problems.push(...specChecked(root, spec, start, owner));

  // The owner's word on the drawing, approved or skipped, is quoted and theirs.
  if ((command === 'spec' || command === 'mockup' || command === 'make') && spec) {
    problems.push(...mockupWordProblems(spec, fileAtSessionStart(root, spec.path, start), owner));
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
    if (at && /\.html?$/i.test(at) && existsSync(join(root, at))) problems.push(...mockupDrawingProblems(root, spec.body, at));
  }

  if (command === 'tweak' && spec) problems.push(...tweakProblems(root, spec, owner, start));

  // A spec that changed after its drawing was approved no longer has one.
  if ((command === 'spec' || command === 'make') && spec) {
    const front = spec.body.split(/^---\s*$/m)[1] ?? '';
    const mockup = /^\s*mockup\s*:\s*(\S+)/im.exec(front)?.[1] ?? '';
    const at = /^\s*mockup_at\s*:\s*(.+)$/im.exec(front)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
    if (/^approved/i.test(mockup) && /\.html?$/i.test(at) && !/^https?:/i.test(at)) {
      const drift = approvedDrawingProblems(root, spec.body, at);
      if (drift.length) {
        problems.push(
          `${spec.path} says \`mockup: approved\`, but the approved drawing no longer shows what the spec lists: ${drift.join(' ')} ` +
            (command === 'spec'
              ? `The spec changed after the owner approved the drawing. Set \`mockup: pending\` in the spec; \`/jig mockup\` redraws it for the owner.`
              : `make builds from a drawing the owner approved of this spec, and this one is of an earlier spec. Stop, and ask for \`/jig mockup\`.`),
        );
      }
    }
  }

  // spec, mockup and critique write records, under .jig/, and nothing else.
  // On jig-site a critique swapped the rule its page demonstrates to get past
  // a block, then re-judged the page it had changed; a mockup session wrote
  // the site's stylesheet. A review that fixes what it reviews grades itself.
  if (command === 'spec' || command === 'mockup' || command === 'critique') {
    const outside = changedOutsideRecords(root, start);
    if (outside.length) {
      problems.push(
        `${command} writes under .jig/ only, and this session changed ${outside.slice(0, 6).join(', ')}${outside.length > 6 ? ` and ${outside.length - 6} more` : ''}. ` +
          `Put them back as they were when the session began, and hand the change to \`/jig make\` (or \`/jig tweak\` for a small one to a built page). ` +
          (command === 'critique' ? 'A critique that changes the page it judges is grading its own work; report the finding instead.' : 'The build is make\'s.'),
      );
    }
  }

  // An approval is of the drawing as the owner saw it. On jig-site the session
  // that recorded one then redrew frames and moved a switch, and the record
  // still said approved.
  if (command === 'mockup' && spec) {
    const front = spec.body.split(/^---\s*$/m)[1] ?? '';
    const mockup = /^\s*mockup\s*:\s*(\S+)/im.exec(front)?.[1] ?? '';
    const at = /^\s*mockup_at\s*:\s*(.+)$/im.exec(front)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
    if (/^approved/i.test(mockup) && at && !/^https?:/i.test(at) && existsSync(join(root, at))) {
      const changedAfter = drawingChangedAfterApproval(root, spec.path, at);
      if (changedAfter) {
        problems.push(`${at} has changed since the owner approved it (${changedAfter}). An approval is of the drawing as the owner saw it: set \`mockup: pending\` in ${spec.path} and ask again.`);
      }
    }
  }

  // Decisions are the owner's, through decide (or tweak's own decide step).
  // On jig-site one make round added a decision and another rewrote one to
  // match the tokens it had just switched to; the next critique judged the page
  // against text the build had written.
  if (command === 'make') {
    const found = decisionsFile(root);
    if (found) {
      let now = '';
      try { now = readText(join(root, found)); } catch { /* unreadable: nothing to compare */ }
      const then = fileAtSessionStart(root, found, start);
      if (then && now !== then) {
        problems.push(`${found} changed in a \`make\` session. make carries decisions out; it does not take them. Restore it (\`git checkout -- ${found}\`, or \`git show <commit>:${found}\` if the change is committed), and put what the owner must decide to them: \`/jig decide\`, or \`/jig tweak\` for a small change to a built page.`);
      }
    }
  }

  // A tweak's decision is recorded the way decide records one: the owner's
  // words in quotation marks, and here the owner's words are the tweak's own
  // record of them. On jig-site a tweak shown a screenshot wrote an exception
  // to a rule "given directly by the owner ... by reference rather than words".
  if (command === 'tweak' && spec) {
    const found = decisionsFile(root);
    if (found) {
      let now = '';
      try { now = readText(join(root, found)); } catch { /* unreadable: nothing to compare */ }
      const then = fileAtSessionStart(root, found, start);
      if (now && now !== then) {
        problems.push(...unsourcedReasons(now, then, { newWhysOnly: true }).map((p) => `${found}: ${p}`));
        const change = readTweak(join(root, '.jig', 'critique', spec.slug))?.change;
        if (change) problems.push(...quotesNotFrom(now, then, change).map((p) => `${found}: ${p}`));
      }
    }
  }

  // A mode file is Jig's: `update` refreshes it, and a hand edit is flagged
  // by its checksum. On jig-site a make round, told its three columns must fit
  // at 1280, narrowed `--size-rail` in mode.editorial.css itself, which would
  // have resized every editorial rail and been reported at the next update.
  if (command !== 'update' && command !== 'init' && command !== 'install') {
    for (const file of modeFiles(root)) {
      let now = '';
      try { now = readText(join(root, file)); } catch { continue; }
      const then = fileAtSessionStart(root, file, start);
      if (then && now !== then) {
        problems.push(`${file} changed in this session. A mode file is Jig's, refreshed by \`update\`; a value this project needs of its own goes in its brand file or its own stylesheet. Restore it (\`git checkout -- ${file}\`, or \`git show <commit>:${file}\` if the change is committed).`);
      }
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
    const own = specFor(root, surface)?.slug;
    if (own && surfaces.includes(own)) problems.push(...reportOmissions(join(dir, own), own));
    if (surfaces.length === 0) {
      problems.push('critique wrote no verdict files. Each reader arm writes .jig/critique/<surface>/screen.json or code.json, and `jig verdicts <surface>` — not your own count — decides whether the review is complete. A report without them is not a review.');
    }
  }

  return problems;
}

/**
 * A drawing is put to the owner only once it shows what the spec lists.
 *
 * The pause for approval skipped every check, so a drawing whose frames lacked
 * regions went to the owner; and where the question did not read as one, the
 * same check blocked the stop three times and let go, and on jig-site two
 * mockup sessions reported that as "waiting on owner review". The owner then
 * approved a drawing the gate refused make for. The shape is the agent's to fix
 * before asking; approval is the owner's after.
 */
function drawingBeforeAsking(root: string, surface?: string): string[] {
  const spec = specFor(root, surface);
  if (!spec) return [];
  const front = spec.body.split(/^---\s*$/m)[1] ?? '';
  const named = /^\s*mockup_at\s*:\s*(.+)$/im.exec(front)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
  const at = named || `.jig/mockups/${spec.slug}.html`;
  if (/^https?:/i.test(at) || !/\.html?$/i.test(at) || !existsSync(join(root, at))) return [];
  const found = mockupDrawingProblems(root, spec.body, at);
  return found.length ? [`Fix the drawing before you put it to the owner; they approve what the spec lists, drawn. ${found.join(' ')}`] : [];
}

/**
 * A spec is put to the owner, and recorded as confirmed, only once a reader
 * who did not write it has checked it (see `specCheckProblems`). Checked when
 * the spec asks for confirmation as well as when it finishes: the owner
 * confirms by the sheet that check produces.
 */
function specChecked(root: string, spec: { path: string; slug: string; body: string }, start: number | undefined, owner: string): string[] {
  const found = decisionsFile(root);
  let decisions = '';
  try { if (found) decisions = readText(join(root, found)); } catch { /* unreadable: no quotations to find there */ }
  return specCheckProblems(root, spec, fileAtSessionStart(root, spec.path, start), owner, decisions);
}

/** The mode files Jig installed here, as `.jig/state.json` records them. */
function modeFiles(root: string): string[] {
  try {
    const state = JSON.parse(readFileSync(join(root, '.jig', 'state.json'), 'utf8')) as { files?: Record<string, string> };
    return Object.keys(state.files ?? {}).filter((f) => /(^|\/)mode\.[\w-]+\.css$/.test(f));
  } catch {
    return [];
  }
}

/**
 * Findings the verdict files hold that the critique's written report does not
 * name.
 *
 * The report is what the owner and the next `make` read. On jig-site the
 * Guide's first critique held seven findings in its verdict files and listed
 * six in REPORT.md: I-83 was in the files and nowhere in the report, and make
 * would have left it. Checked where the project keeps a REPORT.md beside the
 * verdicts; a rule by its id, a decision by its name.
 */
function reportOmissions(dir: string, surface: string): string[] {
  let report: string;
  try { report = readText(join(dir, 'REPORT.md')).toLowerCase(); } catch { return []; }
  const missing: string[] = [];
  for (const f of VERDICT_FILES) {
    let file: { verdicts?: unknown };
    try { file = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    for (const v of Array.isArray(file.verdicts) ? (file.verdicts as Array<Record<string, unknown>>) : []) {
      if (v.verdict !== 'finding') continue;
      const key = String(v.id ?? v.decision ?? '').trim();
      if (key && !report.includes(key.toLowerCase())) missing.push(v.id ? key : `"${key}"`);
    }
  }
  if (!missing.length) return [];
  return [`.jig/critique/${surface}/REPORT.md leaves out ${missing.length === 1 ? 'a finding' : `${missing.length} findings`} the verdict files hold: ${missing.slice(0, 8).join(', ')}. The report is what the owner and \`make\` read; name every finding in it, by id (a decision by its name).`];
}

/**
 * A tweak: a change the approved mockup does not show, decided, specced, built
 * and re-judged in one pass.
 *
 * On jig-site, half the rounds in a day were changes of that kind (a word that
 * wrapped, a link's colour, how a version is written), and each went through
 * decide, spec, make and a full two-page critique. The alternative is an edit
 * by hand, which is the drift Jig exists to catch. So `tweak` is bounded by
 * what the gate can check: the page's structure is as the owner approved it,
 * the drawing is untouched, and the review re-judges what it says it did.
 */
function tweakProblems(root: string, spec: { path: string; slug: string; body: string }, owner = '', start?: number): string[] {
  const problems: string[] = [];
  const front = spec.body.split(/^---\s*$/m)[1] ?? '';
  if (!/^\s*confirmed\s*:\s*true\b/im.test(front)) problems.push(`${spec.path} is not confirmed. A tweak changes a page the owner has confirmed; an unconfirmed spec goes through \`spec\`.`);
  const mockup = /^\s*mockup\s*:\s*(\S+)/im.exec(front)?.[1] ?? '';
  if (!/^(approved|skipped)/i.test(mockup)) problems.push(`${spec.path}: \`mockup:\` is ${mockup || 'empty'}. A tweak changes a page whose drawing the owner has approved (or skipped); take a new page through \`mockup\` and \`make\`.`);
  else problems.push(...structureSinceApproval(root, spec, front));

  const surface = spec.slug;
  const record = readTweak(join(root, '.jig', 'critique', surface));
  if (!record) {
    problems.push(`.jig/critique/${surface}/tweak.json is missing. It names the change in the owner's words (\`change\`), when it was made (\`at\`) and the rule ids and decisions re-judged for it (\`ids\`).`);
  } else {
    if (!record.change) problems.push(`.jig/critique/${surface}/tweak.json has no \`change\`: the owner's words for what changed.`);
    // `change` is the owner's words, and every check of this tweak's decisions
    // reads it as theirs. Held when this session wrote it.
    else if (owner && fileAtSessionStart(root, `.jig/critique/${surface}/tweak.json`, start) !== readText(join(root, '.jig', 'critique', surface, 'tweak.json')) && !quoteHeld(record.change.replace(/^["“]|["”]$/g, ''), owner)) {
      problems.push(`.jig/critique/${surface}/tweak.json: \`change\` is "${record.change.length > 90 ? `${record.change.slice(0, 90)}…` : record.change}", which the owner did not say in this session. It is their words for the change, as they gave them; what you made of them goes in the spec's Tweak entry.`);
    }
    try {
      const raw = JSON.parse(readFileSync(join(root, '.jig', 'critique', surface, 'tweak.json'), 'utf8')) as Record<string, unknown>;
      const extra = Object.keys(raw).filter((k) => !['at', 'change', 'ids', 'deferred'].includes(k));
      if (extra.length) problems.push(`.jig/critique/${surface}/tweak.json: ${extra.map((k) => `\`${k}\``).join(', ')} ${extra.length === 1 ? 'is not a field' : 'are not fields'} Jig reads. tweak.json holds \`at\`, \`change\`, \`ids\` and \`deferred\`; what else you have to say goes in the spec's Tweak entry.`);
    } catch { /* unreadable: readTweak already said so */ }
    if (!record.ids.length) problems.push(`.jig/critique/${surface}/tweak.json names nothing to re-judge. A change that no rule and no decision could see needs no tweak; name the ones it can.`);
    // The re-judge can wait for the page's next critique, or `ship`, when the
    // owner says so: in their words here, or once for the project in
    // jig.config.json. The ids stay named, for whoever judges it.
    if (record.deferred !== undefined) {
      const said = typeof record.deferred === 'string' ? ownerWordProblem('defer', record.deferred, owner, `.jig/critique/${surface}/tweak.json: \`deferred\``) : undefined;
      if (typeof record.deferred === 'string' ? said !== undefined : !critiqueAtShip(root, spec.body)) {
        problems.push(
          `.jig/critique/${surface}/tweak.json defers its re-judge, and nobody said to. \`deferred\` quotes the owner telling you to leave it for later, ` +
            `or is \`true\` where the page's spec says \`critique: at-ship\` (or, the spec silent, jig.config.json says \`"critique": "at-ship"\`). Otherwise re-judge what it names.` +
            (said ? ` ${said}` : ''),
        );
      }
      return problems;
    }
    const unjudged = unjudgedTweakIds(join(root, '.jig', 'critique', surface), record);
    if (unjudged.length) {
      problems.push(
        `.jig/critique/${surface}: tweak.json names ${unjudged.slice(0, 6).join(', ')}${unjudged.length > 6 ? ' and more' : ''} but no verdict for ${unjudged.length === 1 ? 'it' : 'them'} carries \`"tweak": "${record.at}"\`. ` +
          `Each named verdict is re-judged on the changed page by a reader that did not make the change.`,
      );
    }
  }
  return problems;
}

/**
 * The structure the page had when it was last judged: each size's regions
 * (count, and names where the spec gives short ones), and the drawing itself,
 * as they stood in the commit that recorded the surface's critique lock.
 * Region wording is left out, so a copy change inside a region's description is
 * still a tweak.
 *
 * The baseline was the commit that set `mockup: approved`. A re-approval leaves
 * that line as it was, so on jig-site the header was held to a structure two
 * days and five owner rounds old, each round confirmed and critiqued since.
 * What a tweak changes is the page as last judged; the last critique is where
 * that is recorded. With no committed lock, the approval commit stands in.
 */
function structureSinceApproval(root: string, spec: { path: string; slug: string; body: string }, front: string): string[] {
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  let baseline: string;
  let judged = true;
  try {
    baseline = git(['log', '-1', '--format=%H', '--', `.jig/critique/${spec.slug}/${LOCK}`]).trim();
    if (!baseline) {
      judged = false;
      baseline = git(['log', '-1', '--format=%H', '-G', '^mockup[[:space:]]*:', '--', spec.path]).trim();
    }
  } catch {
    return [];
  }
  if (!baseline) return [];
  const when = judged ? `when the last critique judged it (${baseline.slice(0, 7)})` : `when the owner approved the mockup (${baseline.slice(0, 7)})`;
  const problems: string[] = [];
  let thenBody = '';
  try { thenBody = lf(git(['show', `${baseline}:./${spec.path}`])); } catch { return []; }
  const shape = (body: string) => JSON.stringify(Object.entries(specRegions(body)).sort(([a], [b]) => a.localeCompare(b)).map(([size, regions]) => [size, regions.length, regions.map((r) => r.name ?? '')]));
  if (shape(thenBody) !== shape(spec.body)) {
    problems.push(`${spec.path}: the regions under \`sizes:\` differ from the ones the page had ${when}. A change to what the page holds is not a tweak: take it through \`spec\` and \`mockup\`.`);
  }
  const at = /^\s*mockup_at\s*:\s*(.+)$/im.exec(front)?.[1]?.trim().replace(/^["']|["']$/g, '');
  if (at && !/^https?:/i.test(at) && existsSync(join(root, at))) {
    try {
      if (lf(git(['show', `${baseline}:./${at}`])) !== readText(join(root, at))) {
        problems.push(`${at} has changed since ${when.replace(/^when /, '')}. A tweak leaves the drawing as approved; a change the drawing must show goes through \`mockup\`.`);
      }
    } catch { /* the drawing was added after that commit, or never committed */ }
  }
  return problems;
}

interface TweakRecord { at: string; change: string; ids: string[]; deferred?: string | boolean }

function readTweak(dir: string): TweakRecord | undefined {
  try {
    const raw = JSON.parse(readFileSync(join(dir, 'tweak.json'), 'utf8')) as Partial<TweakRecord>;
    const deferred = typeof raw.deferred === 'string' || raw.deferred === true ? raw.deferred : undefined;
    return { at: String(raw.at ?? ''), change: String(raw.change ?? '').trim(), ids: Array.isArray(raw.ids) ? raw.ids.map(String) : [], ...(deferred !== undefined ? { deferred } : {}) };
  } catch {
    return undefined;
  }
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
  const spec = specFor(projectRoot, surface);
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

  const invocation = lastJigInvocation(opts.input.transcript_path);
  const command = invocation?.command;
  // Waiting on the owner is not finishing. The command's own output is checked
  // on the stop after the owner has answered, not while the question is open;
  // `check` below still runs either way.
  const waiting = command !== undefined && ASKS_THE_OWNER.has(command) && asksOwner(lastAssistantText(opts.input.transcript_path));
  const start = sessionStart(opts.input.transcript_path);
  const owner = command === 'decide' || command === 'spec' || command === 'mockup' || command === 'make' || command === 'tweak' ? ownerWords(opts.input.transcript_path) : '';
  const problems: string[] = command && !waiting ? commandProblems(root, command, invocation?.surface, start, owner).map((p) => `/jig ${command}: ${p}`) : [];
  if (waiting && command === 'mockup') problems.push(...drawingBeforeAsking(root, invocation?.surface).map((p) => `/jig mockup: ${p}`));
  // ship is where nothing is optional. It finishes when `jig ship` passes, or
  // tells the owner plainly what still stands in the way.
  if (command === 'ship' && !asksOwner(lastAssistantText(opts.input.transcript_path))) {
    const result = ship({ projectRoot: root, version: opts.version });
    if (!result.ready) problems.push(`/jig ship: the project is not ready to ship. Critique what is owed, fix what the critiques find or record the owner's ruling, and run \`jig ship\` again.\n${result.report}`);
  }
  // make builds from a drawing the owner approved, or from the spec alone once
  // they said to skip it. Nobody having said either, it asks; it does not finish.
  if (command === 'make') {
    const spec = specFor(root, invocation?.surface);
    if (spec && mockupPending(spec.body) && !asksOwner(lastAssistantText(opts.input.transcript_path))) {
      problems.push(`/jig make: ${spec.path} still says \`mockup: pending\`: nobody has said whether to draw it. Ask the owner, draw it with \`/jig mockup\` or skip it; if they skip it, write \`mockup: skipped — "<their words>"\` and build from the spec alone.`);
    }
  }
  // A spec is confirmed by the owner's yes to being asked. Nothing checked
  // that: an agent could write `confirmed: true` having asked nobody.
  if (command === 'spec' && !waiting) {
    const spec = namedSpec(root, invocation?.surface);
    if (spec && isConfirmed(spec.body) && !isConfirmed(fileAtSessionStart(root, spec.path, start))) {
      const reply = ownerReplyAfter(opts.input.transcript_path, /\bconfirm/i);
      const said = reply === undefined ? undefined : ownerWordProblem('confirm', reply.slice(0, 400), reply, `${spec.path}: \`confirmed: true\``);
      if (reply === undefined) problems.push(`/jig spec: ${spec.path} is recorded as confirmed, and the owner was never asked to confirm it. Put it to them with its sheet and stop; record \`confirmed: true\` when they say yes.`);
      else if (said) problems.push(`/jig spec: ${spec.path} is recorded as confirmed, but the owner's reply to being asked does not confirm it ("${reply.trim().slice(0, 120)}"). Record \`confirmed: true\` only on their yes.`);
    }
  }

  if (waiting && command === 'spec') {
    const spec = namedSpec(root, invocation?.surface);
    // Asking the owner to confirm a spec that is not where Jig reads it puts an
    // unchecked draft to them: every check below reads that file.
    if (!spec && invocation?.surface && /\bconfirm/i.test(lastAssistantText(opts.input.transcript_path) ?? '')) {
      problems.push(`/jig spec: you are asking the owner to confirm a spec that is not at .jig/specs/${invocation.surface}.spec.md. Write it there, with \`confirmed: false\`, have it checked (step 3c), and ask again: the checks the owner relies on read that file, and a draft kept anywhere else is checked by nothing.`);
    }
    if (spec) problems.push(...specChecked(root, spec, start, owner).map((p) => `/jig spec: ${p}`));
    // A spec put to the owner is held to its shape too, once it is put to them
    // (its check record exists): earlier rounds ask questions of a draft. On
    // jig-site a spec went to the owner with a `motion:` line the shape check
    // refuses, because that check ran only after the owner had answered.
    if (spec && existsSync(join(root, '.jig', 'specs', `${spec.slug}.checked.json`))) {
      problems.push(...[...specProblems(spec), ...newFieldProblems(spec, fileAtSessionStart(root, spec.path, start))].map((p) => `/jig spec: ${p}`));
    }
  }

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

  problems.push(...verdictGuard(root, command, surfacesInPlay(root, command, opts.input.transcript_path, invocation?.surface)));
  problems.push(...probesLeftBehind(root, surfacesInPlay(root, command, opts.input.transcript_path, invocation?.surface)));
  // AGENTS.md (and CLAUDE.md) carry Jig's instructions for every agent. A
  // session that edited or removed Jig's block is held until it is put back;
  // one that only found it out of date is told so by `check`.
  const touched = ['AGENTS.md', 'CLAUDE.md'].some((f) => {
    const now = existsSync(join(root, f)) ? readText(join(root, f)) : '';
    return fileAtSessionStart(root, f, start) !== now;
  });
  if (touched) problems.push(...agentFileProblems(root).map((p) => `Jig's agent instructions: ${p}`));

  const critiqueDir = join(root, '.jig', 'critique');
  if (existsSync(critiqueDir)) {
    for (const surface of surfacesInPlay(root, command, opts.input.transcript_path, invocation?.surface)) {
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

  // Run by hand there is no transcript, so no command: a tweak's re-judged
  // verdicts read as a builder's edits. On jig-site an agent ran `jig gate` in
  // its shell three times mid-tweak, was told its verdicts had been tampered
  // with and that it had spent its attempts, and reported a finished tweak as
  // failing. The Stop hook, which has the transcript, passed it.
  if (!opts.input.transcript_path && !opts.input.session_id) {
    if (problems.length === 0) return { block: false, reason: '' };
    return {
      block: false,
      reason:
        `jig gate, run by hand: with no session transcript it cannot tell which /jig command this session ran, so it judges the files as if none did. ` +
        `A tweak's re-judged verdicts read here as edits; the Stop hook, which sees the command, is what decides. No attempt was counted.\n\n${problems.join('\n\n')}`,
    };
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

/** Each verdict by file and id (or decision name), so a lock can say which one changed. */
function verdictDigests(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of VERDICT_FILES) {
    let file: { verdicts?: unknown };
    try { file = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    for (const v of Array.isArray(file.verdicts) ? (file.verdicts as Array<Record<string, unknown>>) : []) {
      const key = String(v.id ?? v.decision ?? '').trim();
      if (key) out[`${f}:${key}`] = checksum(JSON.stringify(v));
    }
  }
  return out;
}

/**
 * The lock also records the page the verdicts were taken on: the file its
 * probes name, and its checksum then. A critique can wait until `ship`, and
 * `ship` needs to know which pages changed after they were judged; a probe's
 * own stamp cannot say, since refreshing the probes moves it.
 */
function writeLock(root: string, surface: string, lockPath: string, dir: string, now: string): void {
  const pageFile = recordedPage(root, surface);
  let page: { file: string; checksum: string } | undefined;
  try { if (pageFile) page = { file: pageFile, checksum: pageChecksum(readFileSync(join(root, pageFile), 'utf8')) }; } catch { /* page gone: record none */ }
  // And the tweak it saw, so a re-judge that tweak deferred reads as settled
  // once a critique or a later tweak has judged the page.
  const tweakAt = readTweak(dir)?.at;
  try { writeFileSync(lockPath, JSON.stringify({ checksum: now, verdicts: verdictDigests(dir), ...(page ? { page } : {}), ...(tweakAt ? { tweak: tweakAt } : {}) }) + '\n', 'utf8'); } catch { /* read-only tree */ }
}

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
export function verdictGuard(root: string, command: string | undefined, inPlay?: string[]): string[] {
  const critiqueDir = join(root, '.jig', 'critique');
  if (!existsSync(critiqueDir)) return [];
  const problems: string[] = [];
  for (const surface of readdirSync(critiqueDir)) {
    if (surface.startsWith('_')) continue;
    const dir = join(critiqueDir, surface);
    const now = verdictChecksum(dir);
    if (!now) continue;
    const lockPath = join(dir, LOCK);
    // Lock only what this critique session touched. Locking every critique
    // stamped the catalog's folder during a rule-page session, and the next
    // stop read that stamp as the catalog having been touched.
    // `ship` critiques what is owed, by the same procedure, so it locks the
    // critiques it ran the way `critique` does.
    if ((command === 'critique' || command === 'ship') && (!inPlay || inPlay.includes(surface))) {
      writeLock(root, surface, lockPath, dir, now);
      problems.push(...lockLeftBehind(root, surface));
      continue;
    }
    let lock: { checksum?: string; verdicts?: Record<string, string> } = {};
    try { lock = JSON.parse(readFileSync(lockPath, 'utf8')); } catch { continue; }
    const locked = lock.checksum;
    // A tweak re-judges what its change could affect, and only that: the
    // verdicts it names may change and must be re-judged; every other verdict
    // stays as critique left it.
    if (command === 'tweak' && (!inPlay || inPlay.includes(surface)) && locked !== now) {
      const own = tweakVerdictProblems(dir, surface, lock.verdicts);
      problems.push(...own);
      if (own.length === 0) {
        writeLock(root, surface, lockPath, dir, now);
        problems.push(...lockLeftBehind(root, surface));
      }
      continue;
    }
    if (locked && locked !== now) {
      problems.push(
        `.jig/critique/${surface}: the verdict files changed after \`/jig critique\` wrote them${command ? `, in a session that ran \`/jig ${command}\`` : ''}. ` +
          `Verdicts are the review's, not the builder's: restore them (\`git checkout -- .jig/critique/${surface}\`) and run \`/jig critique\` to judge the fix.`,
      );
    }
  }
  return problems;
}

/**
 * A lock this stop just wrote, beside verdicts that are already committed.
 *
 * The gate writes the lock when the session stops, which is after the agent
 * has committed its work, so every critique and tweak on jig-site left
 * `verdicts.lock` behind and the owner committed it by hand, three times in a
 * day. Stopping once more to commit it costs one turn; the next stop writes
 * the same lock and passes. Verdicts that are not committed yet mean nobody is
 * committing, and the lock waits with them.
 */
function lockLeftBehind(root: string, surface: string): string[] {
  const rel = `.jig/critique/${surface}`;
  try {
    const status = (paths: string[]) => execFileSync('git', ['status', '--porcelain', '--', ...paths], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!status([`${rel}/${LOCK}`])) return [];
    if (status(VERDICT_FILES.map((f) => `${rel}/${f}`))) return [];
  } catch {
    return [];
  }
  return [`${rel}/${LOCK} was written when you stopped, after the verdicts it records were committed. Commit it on its own (\`git add ${rel}/${LOCK} && git commit -m "chore: record ${surface}'s verdict lock"\`), and nothing else.`];
}

/**
 * Probe files the Stop hook re-took for the pages in play, left behind after
 * the session committed its work.
 *
 * The hook renders a page again when it changed since its probes were taken,
 * and it does that at the stop, after the agent's last commit. On jig-site
 * every critique and tweak left a page's probe files modified, and a brief had
 * to tell each session to commit them. Stopping once more to commit them costs
 * one turn; the next stop finds them current and passes. A session that has
 * left other work uncommitted is not committing, and the probes wait with it.
 */
export function probesLeftBehind(root: string, surfaces: string[]): string[] {
  if (!surfaces.length) return [];
  let lines: string[];
  try {
    lines = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').filter(Boolean);
  } catch {
    return [];
  }
  const path = (l: string) => l.slice(3).replace(/^"|"$/g, '');
  const isProbe = (p: string) => /^\.jig\/critique\/[^/]+\/probe-[^/]+\.json$/.test(p);
  const isLock = (p: string) => /^\.jig\/critique\/[^/]+\/verdicts\.lock$/.test(p);
  if (lines.some((l) => !isProbe(path(l)) && !isLock(path(l)))) return [];
  const left = lines.map(path).filter((p) => isProbe(p) && surfaces.some((s) => p.startsWith(`.jig/critique/${s}/`)));
  if (!left.length) return [];
  const bySurface = [...new Set(left.map((p) => p.split('/')[2]!))];
  return [
    `The gate re-took ${left.length} probe file${left.length === 1 ? '' : 's'} of ${bySurface.join(', ')} when you stopped, after your last commit: the page changed since they were taken. ` +
      `Commit them on their own (\`git add ${bySurface.map((s) => `.jig/critique/${s}/probe-*.json`).join(' ')} && git commit -m "chore: re-take ${bySurface.join(', ')}'s probes"\`), and nothing else.`,
  ];
}

function tweakVerdictProblems(dir: string, surface: string, lockedVerdicts: Record<string, string> | undefined): string[] {
  const record = readTweak(dir);
  if (!record) {
    return [`.jig/critique/${surface}: the verdict files changed in a \`/jig tweak\` session with no tweak.json naming what was re-judged.`];
  }
  const problems: string[] = [];
  const named = new Set(record.ids.map((id) => id.toLowerCase()));
  const nowVerdicts = verdictDigests(dir);
  // Locks written before 0.19 hold one checksum and no per-verdict digests;
  // the first tweak on such a record cannot tell which verdicts it changed, so
  // it is taken on trust once and the lock it writes can tell from then on.
  if (lockedVerdicts) {
    const keys = new Set([...Object.keys(lockedVerdicts), ...Object.keys(nowVerdicts)]);
    const outside = [...keys]
      .filter((k) => lockedVerdicts[k] !== nowVerdicts[k])
      .map((k) => k.slice(k.indexOf(':') + 1))
      .filter((id) => !named.has(id.toLowerCase()));
    if (outside.length) {
      problems.push(
        `.jig/critique/${surface}: a tweak changed verdicts it did not name (${[...new Set(outside)].slice(0, 6).join(', ')}). ` +
          `A tweak re-judges only what its change could affect, listed in tweak.json's \`ids\`; restore the others (\`git checkout -- .jig/critique/${surface}\`).`,
      );
    }
  }
  return problems;
}

/** The ids a tweak named whose verdicts were not re-judged for it. */
function unjudgedTweakIds(dir: string, record: TweakRecord): string[] {
  const stamped = new Set<string>();
  for (const f of VERDICT_FILES) {
    let file: { verdicts?: unknown };
    try { file = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    for (const v of Array.isArray(file.verdicts) ? (file.verdicts as Array<Record<string, unknown>>) : []) {
      if (record.at && v.tweak === record.at) stamped.add(String(v.id ?? v.decision ?? '').toLowerCase());
    }
  }
  return record.ids.filter((id) => !stamped.has(id.toLowerCase()));
}

function save(file: string, state: Record<string, number>): void {
  try {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, JSON.stringify(state), 'utf8');
  } catch { /* a read-only tree must not turn the gate into a crash */ }
}
