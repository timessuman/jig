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
   * The `P-`/`M-` specs, which sit outside `rules.index.json` by design and so
   * are not part of `totalRules`. Named in the summary because "104 rules"
   * otherwise reads as the whole system, implying a cited `P-06` is not real.
   */
  totalSpecs?: number;
  /**
   * Files carrying styling that the detector suite does not read — `.tsx`,
   * `.vue`, `.astro`, and friends. The scope is deliberate (separating style
   * text from application code needs real parsing), but silence about it turns
   * a narrow check into a false clean bill of health: a Tailwind project whose
   * stylesheet imports the tokens, with every value in `className`, otherwise
   * reports "No findings" having examined none of them.
   */
  unscanned?: { count: number; extensions: string[] };
  /** Files `jig.config.json` excused. Reported by name on every run: an
   *  exemption list grows one entry at a time until it covers the codebase,
   *  and the only defence is that it is never invisible. */
  exempt?: string[];
  /** Per-pattern counts, so an over-broad glob names itself. */
  exemptPatterns?: Array<{ pattern: string; count: number; tooBroad: boolean }>;
  /**
   * How many files the detectors were handed, and how many of those actually
   * contained a style region to inspect.
   *
   * Without these, `0 errors · 104 rules, 0 fired` is byte-identical whether
   * forty components were examined and found clean or nothing was examined at
   * all. That was misread exactly that way while building Jig's own docs site:
   * a green run cited as evidence, on a project whose only styling was the
   * token layer Jig itself generated.
   *
   * Both numbers are needed, not one. `.ts` is style-bearing by extension, so
   * `scanned` counts parsers and config files too; `withStyles` is the number a
   * reader should check against their own expectation of the codebase.
   */
  scanned?: number;
  withStyles?: number;
  /**
   * Which population `scanned` describes.
   *
   * `check` defaults to the working-tree diff and falls back to the whole repo
   * when that diff is empty — so on a clean tree it reads like a full scan, and
   * on a dirty tree the same repo reports a different `files=` minutes later
   * with nothing committed. Nothing said so. Two consequences, both found by a
   * consumer rather than by us: `mechanical=pass:0` before a commit means
   * "nothing in the diff fired", not "the project is clean"; and an exemption
   * that matched nothing was told to "check the path" when the path was right
   * and merely outside the narrowed set.
   */
  scope?: 'changed' | 'all';
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
    // "No findings" is only true if there was something to find them in.
    lines.push(
      meta.withStyles === 0 && meta.scanned !== undefined
        ? '  Nothing inspected.'
        : '  No findings.',
    );
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
  const scope = meta.totalSpecs
    ? `${meta.totalRules} rules (+ ${meta.totalSpecs} pattern and mode specs)`
    : `${meta.totalRules} rules`;
  // The scope is part of the number, not a footnote to it. `31 files` and
  // `9 files` from the same tree are both true and describe different
  // populations; a reader comparing two runs has no other way to know that.
  const examined =
    meta.scanned === undefined
      ? ''
      : ` · ${plural(meta.scanned, 'file')}${
          meta.scope === 'changed' ? ' changed since HEAD' : ''
        }, ${meta.withStyles ?? 0} with styles`;
  lines.push(`  ${summaryParts.join(', ')} · ${scope}${examined}, ${rulesFired} fired`);

  // A run that inspected nothing must not read like a run that found nothing.
  if (meta.scanned !== undefined && meta.withStyles === 0) {
    lines.push('');
    lines.push(
      `  No file carried a style region, so the detectors examined nothing. This is ` +
        `not a pass — a project with no styling and a project with clean styling ` +
        `report the same findings, and only one of them has been checked.`,
    );
  }

  // A narrowed run must not be attested from as though it were a full one.
  if (meta.scope === 'changed') {
    lines.push('');
    lines.push(
      `  Scope: files changed since HEAD, not the whole project — this is the ` +
        `inner-loop default. A clean result here means nothing in your diff fired, ` +
        `not that the project is clean. Run 'jig check --all' for that.`,
    );
  }

  if (meta.exemptPatterns && meta.exemptPatterns.length > 0) {
    const n = meta.exempt?.length ?? 0;
    lines.push(`  ${n} file(s) exempt via jig.config.json and not scanned:`);
    for (const { pattern, count, tooBroad } of meta.exemptPatterns) {
      // The PATTERN leads. Naming only the files told you what had been excused
      // and never which rule excused it — and a pattern excusing thirty files
      // is precisely the one you need to see.
      // "check the path" is wrong advice when the scan was narrowed: the glob
      // is fine and simply matched nothing among the changed files. It sent a
      // user to debug a working config.
      const note = count === 0
        ? meta.scope === 'changed'
          ? 'matches nothing among the changed files — not necessarily wrong'
          : 'matches nothing — check the path'
        : tooBroad
          ? `${count} files — likely too broad, review it`
          : `${count} file${count > 1 ? 's' : ''}`;
      lines.push(`    ${pattern}  (${note})`);
    }
    if (n > 0) {
      lines.push(`    ${meta.exempt!.slice(0, 8).join(', ')}${n > 8 ? `, and ${n - 8} more` : ''}`);
    }
  }

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
  // `files` and `styled` carry the run's scope into the attestation, because
  // the claim is worthless without them: a pass over zero files reads exactly
  // like a clean result on a real codebase. Fields are never dropped — an
  // emitter that cannot determine one says `unknown`, the rule `mode` already
  // follows, so the record keeps a single shape.
  //
  // Keep prose ABOVE this call, never inside the template literal: the contract
  // test reads field names out of that span, and a comment naming a field
  // registers as a duplicate of it.
  lines.push(
    `  JIG_CHECK: version=${meta.version} mode=${meta.mode ?? 'unknown'} ` +
      `mechanical=${mechStatus} judgment=not-run ` +
      `files=${meta.scanned ?? 'unknown'} styled=${meta.withStyles ?? 'unknown'}`,
  );

  return lines.join('\n');
}
