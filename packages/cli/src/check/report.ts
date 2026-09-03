import type { Finding, Severity } from './types.js';

export interface ReportMeta {
  totalRules: number;
  version: string;
  /** True when no scanned file references a Jig token. H-47 is skipped for
   *  such files by design, so the report says why rather than staying silent
   *  and looking like a clean bill of health. */
  noTokenLayer?: boolean;
  /** The mode this run resolved from `jig.config.json`, when there is one.
   *  Part of the `JIG_CHECK:` contract: the CLI fills what it can determine
   *  and says `unknown` for the rest, rather than dropping the field and
   *  emitting a differently-shaped record under the same label. */
  mode?: string;
  /**
   * Files carrying styling that the detector suite does not read — `.tsx`,
   * `.vue`, `.astro`, and friends. The scope is deliberate (separating style
   * text from application code needs real parsing), but silence about it turns
   * a narrow check into a false clean bill of health: a Tailwind project whose
   * stylesheet imports the tokens, with every value in `className`, otherwise
   * reports "No findings" having examined none of them.
   */
  unscanned?: { count: number; extensions: string[] };
}

/** Rows beyond this many, for one rule in one file, collapse into a count.
 *  A wall of identical-shaped lines is not a report. */
const MAX_ROWS_PER_RULE_PER_FILE = 3;

const SEVERITY_SYMBOL: Record<Severity, string> = { error: '✗', warning: '⚠', note: '·' };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Keyed by rule id, engine tagged (`[mechanical]` / `[hybrid]`) but not
 * foregrounded — the bucket sits at the end of the line rather than up
 * front, so an agent-produced judgment finding can join this same list
 * later without changing the format. The first time a given rule id
 * appears, its row carries a `--explain`-style pointer at the vendored
 * correction, so a user (or agent) hitting the finding can go read why.
 */
export function formatReport(findings: Finding[], meta: ReportMeta): string {
  const lines: string[] = [];
  const seenRule = new Set<string>();

  const rows = findings.map((f) => {
    const symbol = SEVERITY_SYMBOL[f.severity] ?? '·';
    const loc = `${f.file}:${f.line}`;
    const firstOccurrence = !seenRule.has(f.ruleId);
    seenRule.add(f.ruleId);
    // No project-relative path is guaranteed to exist any more — the rules
    // live beside whichever skill directory `jig install` used (global or
    // project, and adapter-specific). Point at the rule id in the installed
    // skill's own reference material instead of a path that may not resolve.
    const hint = firstOccurrence ? `  (see rule ${f.ruleId} in your installed jig skill's rules/)` : '';
    return { symbol, ruleId: f.ruleId, message: f.message, loc, fileOnly: f.file, bucket: f.bucket, hint };
  });

  if (rows.length > 0) {
    const msgW = Math.max(0, ...rows.map((r) => r.message.length));
    const locW = Math.max(0, ...rows.map((r) => r.loc.length));

    // Collapse a run of the same rule in the same file. Presentation only —
    // `--json` always returns every finding, because a machine consumer must
    // never receive a truncated list.
    const shown = new Map<string, number>();
    const suppressed = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.ruleId}\u0000${r.fileOnly}`;
      const n = (shown.get(key) ?? 0) + 1;
      shown.set(key, n);
      if (n <= MAX_ROWS_PER_RULE_PER_FILE) {
        lines.push(
          `  ${r.symbol} ${r.ruleId.padEnd(6)}${r.message.padEnd(msgW)}  ${r.loc.padEnd(locW)}   [${r.bucket}]${r.hint}`,
        );
      } else {
        suppressed.set(key, (suppressed.get(key) ?? 0) + 1);
      }
    }
    for (const [key, n] of suppressed) {
      const [ruleId, file] = key.split('\u0000');
      lines.push(`          … ${n} more ${ruleId} in ${file}. Run with --json for all of them.`);
    }
    lines.push('');
  } else {
    lines.push('  No findings.');
    lines.push('');
    if (meta.noTokenLayer) {
      lines.push('  No file references a Jig token, so H-47 (hard-coded values) was not run.');
      lines.push("  Run 'jig init' to generate a brand file and wire it (with a mode file) into your CSS.");
      lines.push('');
    }
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const notes = findings.filter((f) => f.severity === 'note').length;
  const summaryParts = [plural(errors, 'error')];
  if (warnings > 0) summaryParts.push(plural(warnings, 'warning'));
  if (notes > 0) summaryParts.push(plural(notes, 'note'));

  const rulesFired = new Set(findings.map((f) => f.ruleId)).size;
  lines.push(`  ${summaryParts.join(', ')} · ${meta.totalRules} rules, ${rulesFired} fired`);

  if (meta.unscanned && meta.unscanned.count > 0) {
    const exts = meta.unscanned.extensions.join(', ');
    lines.push('');
    lines.push(
      `  ${meta.unscanned.count} file(s) were not scanned (${exts}) — no style extraction exists ` +
        `for them, so any CSS they carry is invisible to this check and a clean result above does ` +
        `not cover it.`,
    );
  }

  const mechanicalErrors = findings.filter((f) => f.bucket === 'mechanical' && f.severity === 'error').length;
  const mechStatus = `${mechanicalErrors > 0 ? 'fail' : 'pass'}:${mechanicalErrors}`;
  // One label, one record. The CLI can determine version, mode and the
  // mechanical result; it cannot run the judgment rules, so it reports
  // `judgment=not-run` rather than omitting the field. An agent completing a
  // task emits the same four with `judgment=ran`. See templates/SKILL.md.tmpl.
  lines.push(
    `  JIG_CHECK: version=${meta.version} mode=${meta.mode ?? 'unknown'} ` +
      `mechanical=${mechStatus} judgment=not-run`,
  );

  return lines.join('\n');
}
