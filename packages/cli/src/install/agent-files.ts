import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BLOCK_END, BLOCK_START } from '../adapters/types.js';
import { lf } from '../text.js';
import { writeFileAtomic } from './atomic.js';
import { upsertBlock } from './vendor.js';

/**
 * The project's agent instructions: Jig's block in `AGENTS.md`, and for Claude
 * Code a `CLAUDE.md` that imports it.
 *
 * Most people run Jig through an agent. `AGENTS.md` is the file agents read at
 * the start of every session (Codex, Cursor, Gemini CLI, opencode and others),
 * so Jig keeps a short block there: load the skill before UI work, how the loop
 * runs, and what each of Jig's files is for. Claude Code reads `CLAUDE.md`
 * instead, and imports a file named in it with `@`, so its block is one import.
 *
 * Jig owns only what sits between its markers. The rest of either file is the
 * project's, never read or rewritten, and a file that does not exist is created.
 */
export const AGENTS_FILE = 'AGENTS.md';
export const CLAUDE_FILE = 'CLAUDE.md';

export function agentsGuide(): string {
  return [
    BLOCK_START,
    '',
    '# Jig: the design system for this project\'s UI',
    '',
    'Before building or reviewing any interface, load the Jig skill and follow it:',
    '`.agents/skills/jig/SKILL.md`, or `skills/jig/SKILL.md` in your agent\'s own',
    'folder (`.claude/skills/jig/SKILL.md` for Claude Code). It says which rule',
    'files to load for the task.',
    '',
    '## How work goes',
    '',
    '- `/jig decide`, once: the project\'s design decisions, from the owner.',
    '- For each page or feature: `/jig spec`, then `/jig mockup` (or skip it), then',
    '  `/jig make`, then `/jig critique` (now, or left for `/jig ship`).',
    '- A small change to a built page: `/jig tweak`.',
    '- Before a release: `/jig ship`.',
    '- After any change to UI files: `jig check`.',
    '',
    'With no slash commands, ask in plain words: "run jig spec for the pricing page".',
    '',
    '## The owner\'s word',
    '',
    'A spec confirmed, a drawing approved or skipped, a critique left for later, a',
    'decision\'s reason: each is recorded in the owner\'s own words. Never infer one',
    'from something else they said; ask.',
    '',
    '## Jig\'s files',
    '',
    '- `jig.config.json`: the mode each route uses, files `check` skips (`exempt`),',
    '  and when pages are critiqued.',
    '- The token folder: `brand.*.css` is the project\'s identity, edit it freely;',
    '  `mode.*.css` is Jig\'s, refreshed by `jig update`; `theme.css` imports both.',
    '- `DECISIONS.md`, beside the tokens: the project\'s decisions, written by',
    '  `/jig decide` and `/jig tweak` only.',
    '- `.jig/specs/`: what each page must be; `<name>.checked.json` is its check.',
    '- `.jig/mockups/`: approved drawings.',
    '- `.jig/critique/<page>/`: a critique\'s verdicts, its report and its lock.',
    '- `.jig/state.json`: what Jig wrote, so `jig update` leaves your edits alone.',
    '',
    'Jig keeps this block current. Write your own instructions above or below it.',
    '',
    BLOCK_END,
    '',
  ].join('\n');
}

export function claudeImport(): string {
  return [
    BLOCK_START,
    '',
    'Jig\'s instructions for this project are in AGENTS.md, imported here:',
    '',
    `@${AGENTS_FILE}`,
    '',
    BLOCK_END,
    '',
  ].join('\n');
}

/** Whether Claude Code has Jig installed, for this project or for the user. */
export function claudeInstalled(projectRoot: string, homeDir = homedir()): boolean {
  return existsSync(join(projectRoot, '.claude', 'skills', 'jig', 'SKILL.md'))
    || existsSync(join(homeDir, '.claude', 'skills', 'jig', 'SKILL.md'));
}

/** Jig's block in `text`, markers included, or undefined when there is none. */
function blockIn(text: string): string | undefined {
  const t = lf(text);
  const start = t.indexOf(BLOCK_START);
  const end = t.indexOf(BLOCK_END, start);
  return start >= 0 && end > start ? t.slice(start, end + BLOCK_END.length) : undefined;
}

const expected = (block: string) => block.trim();

/**
 * Puts Jig's blocks in place: `AGENTS.md` always, `CLAUDE.md` when `claude`.
 * Creates a missing file, adds a missing block, refreshes an out-of-date one,
 * and leaves the rest of each file as it was. Returns the files it wrote.
 */
export function ensureAgentFiles(projectRoot: string, opts: { claude: boolean }): string[] {
  const wanted: Array<[string, string]> = [[AGENTS_FILE, agentsGuide()]];
  if (opts.claude) wanted.push([CLAUDE_FILE, claudeImport()]);
  const written: string[] = [];
  for (const [file, block] of wanted) {
    const path = join(projectRoot, file);
    const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (blockIn(before) === expected(block)) continue;
    writeFileAtomic(path, upsertBlock(before, block));
    written.push(file);
  }
  return written;
}

/**
 * What is wrong with the project's agent instructions, if anything: a file
 * missing, Jig's block missing, or the block edited or out of date. Checked in
 * a project Jig has set up (it has `.jig/state.json`).
 */
export function agentFileProblems(projectRoot: string, homeDir = homedir()): string[] {
  if (!existsSync(join(projectRoot, '.jig', 'state.json'))) return [];
  const wanted: Array<[string, string]> = [[AGENTS_FILE, agentsGuide()]];
  if (claudeInstalled(projectRoot, homeDir)) wanted.push([CLAUDE_FILE, claudeImport()]);
  const problems: string[] = [];
  for (const [file, block] of wanted) {
    const path = join(projectRoot, file);
    if (!existsSync(path)) {
      problems.push(`${file} is missing, so an agent starts without Jig's instructions.`);
      continue;
    }
    const found = blockIn(readFileSync(path, 'utf8'));
    if (!found) problems.push(`${file} has no Jig block, so an agent starts without Jig's instructions.`);
    else if (found !== expected(block)) problems.push(`${file}: Jig's block has been edited or is out of date.`);
  }
  return problems.map((p) => `${p} Run \`jig update\` to put it back; your own text in the file stays as it is.`);
}
