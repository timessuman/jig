import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding } from './types.js';

/**
 * A warning waived where it stands: `jig-allow I-118: <why>` on the finding's
 * line or the line above, in whatever comment syntax the file uses.
 *
 * Why this exists: `gate` holds an agent until the warnings in the files it
 * changed are resolved, and some warnings are a detector's guess. `A-01` is
 * violet as an *unchosen* default, and cannot tell it from a violet brand; `A-09`
 * reads a word list. Without a way to say "this one is right", an agent either
 * damages a correct page to satisfy the guess or waits out the gate's three
 * refusals, which teaches it that the gate is something to wait out. The only
 * other exemption, a whole file in `jig.config.json`, switches off every other
 * rule on that file too.
 *
 * Deliberately narrow:
 * - **warnings only.** An error is a rule the corpus is sure enough of to fail
 *   CI on; a waiver naming one waives nothing.
 * - **a reason is required.** `jig-allow I-118` with nothing after the colon is
 *   not a waiver, because a waiver nobody can read the case for is a silence.
 * - **the line, not the file.** It covers the one finding it sits beside.
 *
 * Every waiver `check` honours is printed in its report, rule, place and
 * reason, on every run. An exemption list is only safe while it is visible.
 */
export interface Waived extends Finding {
  reason: string;
}

const WAIVER = /jig-allow\s+([A-Z]-\d+(?:\s*,\s*[A-Z]-\d+)*)\s*:(.*)$/;

/** The ids and reason a line carries, or nothing if it waives nothing. */
export function readWaiver(line: string): { ids: string[]; reason: string } | undefined {
  const m = WAIVER.exec(line);
  if (!m) return undefined;
  // The comment's own closer is not part of the reason: `*/`, `-->`, `*/}`.
  const reason = m[2]!.replace(/\s*(\*\/\s*\}?|-->|#\})\s*$/, '').trim();
  if (!/\w/.test(reason)) return undefined;
  return { ids: m[1]!.split(/\s*,\s*/), reason };
}

export function applyWaivers(root: string, findings: Finding[]): { findings: Finding[]; waived: Waived[] } {
  const lines = new Map<string, string[]>();
  const linesOf = (file: string): string[] => {
    let cached = lines.get(file);
    if (!cached) {
      try {
        cached = readFileSync(join(root, file), 'utf8').split('\n');
      } catch {
        cached = [];
      }
      lines.set(file, cached);
    }
    return cached;
  };

  const kept: Finding[] = [];
  const waived: Waived[] = [];
  for (const f of findings) {
    if (f.severity !== 'warning') {
      kept.push(f);
      continue;
    }
    const source = linesOf(f.file);
    const waiver = [source[f.line - 1], source[f.line - 2]]
      .map((l) => (l === undefined ? undefined : readWaiver(l)))
      .find((w) => w?.ids.includes(f.ruleId));
    if (waiver) waived.push({ ...f, reason: waiver.reason });
    else kept.push(f);
  }
  return { findings: kept, waived };
}
