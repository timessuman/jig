import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check } from './check.js';
import { verifyVerdicts } from './verdicts.js';
import { selectFiles } from '../check/files.js';
import { isStyleBearing } from '../check/ext.js';

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
 * - `check` runs only when style-bearing files changed since HEAD, and only its
 *   mechanical errors block — the same line `make` is told must pass;
 * - `verdicts` runs only for a critique that has written verdict files.
 * After MAX_BLOCKS blocks in one session it lets the agent stop and says so,
 * because a gate the agent cannot satisfy must not trap it in a loop.
 */
export const MAX_BLOCKS = 3;

export interface GateInput {
  session_id?: string;
  stop_hook_active?: boolean;
}

export interface GateResult {
  block: boolean;
  reason: string;
}

export function gate(opts: { projectRoot: string; version: string; input: GateInput }): GateResult {
  const root = opts.projectRoot;
  if (!existsSync(join(root, 'jig.config.json')) && !existsSync(join(root, '.jig'))) {
    return { block: false, reason: '' };
  }

  const problems: string[] = [];

  const selection = selectFiles(root, false);
  const changedStyles = selection.mode === 'changed' && selection.files.some((f) => isStyleBearing(f));
  if (changedStyles) {
    const result = check({ projectRoot: root, homeDir: '', version: opts.version, all: false, ci: false });
    const errors = result.findings.filter((f) => f.bucket === 'mechanical' && f.severity === 'error');
    if (errors.length > 0) {
      const shown = errors.slice(0, 8).map((f) => `  ${f.ruleId} ${f.file}:${f.line} ${f.message}`);
      problems.push(
        `jig check: ${errors.length} mechanical error(s) in the files you changed. Fix every one, then run \`jig check\` again.\n` +
          shown.join('\n') + (errors.length > shown.length ? `\n  … and ${errors.length - shown.length} more` : ''),
      );
    }
  }

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

  const session = opts.input.session_id ?? 'unknown';
  const stateFile = join(root, '.jig', 'gate.json');
  let state: Record<string, number> = {};
  try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { /* first run */ }

  if (problems.length === 0) {
    if (state[session]) { delete state[session]; save(stateFile, state); }
    return { block: false, reason: '' };
  }

  const count = (state[session] ?? 0) + 1;
  if (count > MAX_BLOCKS) {
    return {
      block: false,
      reason: `jig gate: still failing after ${MAX_BLOCKS} attempts; letting you stop. Tell the user plainly that the work is not finished:\n${problems.join('\n\n')}`,
    };
  }
  state[session] = count;
  save(stateFile, state);
  return {
    block: true,
    reason:
      `Not finished — Jig's gate failed (attempt ${count} of ${MAX_BLOCKS}). ` +
      `Fix these before you stop, and do not report the work as done until they pass:\n\n${problems.join('\n\n')}`,
  };
}

function save(file: string, state: Record<string, number>): void {
  try {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, JSON.stringify(state), 'utf8');
  } catch { /* a read-only tree must not turn the gate into a crash */ }
}
