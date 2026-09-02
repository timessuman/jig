import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveInstalled } from '../install/target.js';
import { validateIndex, type IndexEntry } from '../rules/schema.js';
import { selectFiles } from '../check/files.js';
import { formatReport } from '../check/report.js';
import { participatesInTokenLayer } from '../check/token-layer.js';
import { runChecks } from '../check/run.js';
import { loadTokenMap } from '../check/tokens.js';
import type { Finding } from '../check/types.js';

export interface CheckOptions {
  projectRoot: string;
  homeDir: string;
  version: string;
  /** Whole-repo instead of just changed files (the first-run case). */
  all: boolean;
  /** Mechanical bucket only; the caller should exit non-zero on `hasError`. */
  ci: boolean;
}

export interface CheckResult {
  findings: Finding[];
  /** Rendered report — plain text unless the caller wants JSON, which it
   *  can build itself from `findings`. */
  report: string;
  /** True when any mechanical-bucket finding is `error` severity — what
   *  `--ci` should exit non-zero on. */
  hasError: boolean;
}

/**
 * Checks a consumer's repo against the mechanical + hybrid detectors named
 * in their vendored `rules.index.json`. Throws if Jig is not installed
 * (mirrors `update`'s error, pointing at `jig install`).
 */
export function check(opts: CheckOptions): CheckResult {
  const target = resolveInstalled(opts.projectRoot, opts.homeDir);
  if (!target) {
    throw new Error(`Jig is not installed in ${opts.projectRoot}. Run 'jig install --agent <name>' first.`);
  }

  const indexPath = join(target.installRoot, '.jig', 'rules.index.json');
  const index: IndexEntry[] = validateIndex(JSON.parse(readFileSync(indexPath, 'utf8')));
  const tokens = loadTokenMap(target.installRoot);
  const { files } = selectFiles(target.installRoot, opts.all);

  const bucketFilter = opts.ci ? (b: string) => b === 'mechanical' : undefined;
  const findings = runChecks(target.installRoot, files, index, tokens, bucketFilter);

  const hasError = findings.some((f) => f.bucket === 'mechanical' && f.severity === 'error');
  // H-47 skips files that have not adopted the token layer. When NO scanned
  // file has, a clean report would read as a clean bill of health rather than
  // "that detector never ran" — so the report says which it is.
  const noTokenLayer = files
    .filter((f) => /\.(css|scss|less)$/i.test(f))
    .every((f) => {
      try {
        return !participatesInTokenLayer(readFileSync(join(target.installRoot, f), "utf8"), tokens);
      } catch {
        return true;
      }
    });

  const report = formatReport(findings, {
    totalRules: index.length,
    version: opts.version,
    noTokenLayer,
  });

  return { findings, report, hasError };
}
