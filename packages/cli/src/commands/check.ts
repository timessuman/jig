import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assetRoot } from '../paths.js';
import { validateIndex, type IndexEntry } from '../rules/schema.js';
import { selectFiles } from '../check/files.js';
import { formatReport } from '../check/report.js';
import { participatesInTokenLayer } from '../check/token-layer.js';
import { runChecks } from '../check/run.js';
import { loadTokenMap } from '../check/tokens.js';
import type { Finding } from '../check/types.js';

export interface CheckOptions {
  projectRoot: string;
  /** Unused since 0.4.0 — `check` no longer looks for an install at all (see
   *  `resolveIndexPath`). Kept on the interface so every existing call site
   *  (the CLI, `init`'s baseline run, tests) doesn't need to change shape. */
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

/** Pre-0.4.0 projects had `install` vendor `rules.index.json` straight into
 *  the project at this path. `check` keeps reading it there, for one minor
 *  version, so an un-migrated project does not break on upgrade — see the
 *  migration section of the skill-first design spec. Remove this shim (and
 *  this whole legacy-index branch of `resolveIndex`) once 0.5.0 ships. */
const LEGACY_INDEX_REL = join('.jig', 'rules.index.json');

function resolveIndexPath(projectRoot: string): string {
  const legacy = join(projectRoot, LEGACY_INDEX_REL);
  if (existsSync(legacy)) return legacy;
  // Since 0.4.0, `check` never needs a prior `jig install`: the index it
  // reads is the CLI's own bundled copy, resolved via `assetRoot()` from
  // wherever this process's code is actually running (the monorepo during
  // development, or the installed npm package in the real world) — not
  // anything written into (or missing from) the project.
  return join(assetRoot(), 'rules.index.json');
}

/**
 * Checks a consumer's repo against the mechanical + hybrid detectors named
 * in Jig's own `rules.index.json` (bundled with the CLI — see
 * `resolveIndexPath`). Never requires `jig install` or `jig init` to have
 * run first: rules that need no tokens (most of the mechanical bucket) work
 * against a project Jig has never touched.
 */
/**
 * The mode to report in the attestation, read from `jig.config.json`.
 *
 * A repo-wide check can span several surfaces, so a single `mode=` value is
 * only well-defined when the project declares one distinct mode. Several
 * reports `mixed`, and no config reports `unknown` — the field is always
 * present, because `JIG_CHECK:` is one record and an emitter that cannot
 * determine a field says so in the value rather than dropping it.
 */
function resolveMode(projectRoot: string): string {
  try {
    const config = JSON.parse(readFileSync(join(projectRoot, 'jig.config.json'), 'utf8')) as {
      surfaces?: { mode?: string }[];
    };
    const modes = [...new Set((config.surfaces ?? []).map((s) => s.mode).filter(Boolean))];
    if (modes.length === 1) return modes[0]!;
    return modes.length > 1 ? 'mixed' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function check(opts: CheckOptions): CheckResult {
  const indexPath = resolveIndexPath(opts.projectRoot);
  const index: IndexEntry[] = validateIndex(JSON.parse(readFileSync(indexPath, 'utf8')));
  // Tokens are always the PROJECT's own — `.jig/tokens/` under
  // `projectRoot` — regardless of where the skill/rules happen to be
  // installed (project-scope skill directory, or global under $HOME). A
  // global install has no project tokens to speak of; `loadTokenMap`
  // already returns `{}` for a missing directory, which is exactly right
  // for a project Jig has never been `init`-ed in.
  const tokens = loadTokenMap(opts.projectRoot);
  const { files } = selectFiles(opts.projectRoot, opts.all);

  const bucketFilter = opts.ci ? (b: string) => b === 'mechanical' : undefined;
  const findings = runChecks(opts.projectRoot, files, index, tokens, bucketFilter);

  const hasError = findings.some((f) => f.bucket === 'mechanical' && f.severity === 'error');
  // H-47 skips files that have not adopted the token layer. When NO scanned
  // file has, a clean report would read as a clean bill of health rather than
  // "that detector never ran" — so the report says which it is.
  const cssFiles = files.filter((f) => /\.(css|scss|less)$/i.test(f));
  const noTokenLayer =
    // `[].every()` is true, so without this guard a repo with no CSS at all is
    // told to add a token @import it has nowhere to put.
    cssFiles.length > 0 &&
    cssFiles.every((f) => {
      try {
        return !participatesInTokenLayer(readFileSync(join(opts.projectRoot, f), 'utf8'), tokens);
      } catch {
        return true;
      }
    });

  const report = formatReport(findings, {
    totalRules: index.length,
    version: opts.version,
    noTokenLayer,
    mode: resolveMode(opts.projectRoot),
  });

  return { findings, report, hasError };
}
