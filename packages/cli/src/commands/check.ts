import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assetRoot } from '../paths.js';
import { validateIndex, type IndexEntry } from '../rules/schema.js';
import { selectFiles } from '../check/files.js';
import { formatReport } from '../check/report.js';
import { participatesInTokenLayer } from '../check/token-layer.js';
import { CSS_EXTENSIONS, hasExtension, isStyleBearing } from '../check/ext.js';
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

/**
 * Files in the selected set that carry styling the suite still cannot read.
 *
 * Since style extraction landed, the host languages are scanned — their
 * `<style>` blocks, style attributes and objects, and CSS tagged templates.
 * What remains unreadable is values written as utility classes
 * (`className="p-[13px]"`), which are not CSS at all. `hardcoded-class-value`
 * covers the arbitrary-value form; a bare `p-4` resolves through a framework's
 * scale that Jig does not model, so it stays out of scope and out of this
 * count.
 *
 * Only templating languages plausibly carrying styles are counted. A `.json` or
 * `.md` file is not an omission worth reporting, and listing it turns a useful
 * caveat into noise people learn to skip.
 */
// Indentation-based templates, which do not write `<style>` or `style="..."`
// at all — `div(style="…")` in Pug, `%div{style: "…"}` in Haml. Reading them as
// markup would find nothing while implying coverage, so they are reported as
// unscanned until someone writes a real extractor. Everything HTML-shaped now
// lives in STYLE_HOST_EXTENSIONS instead.
const UNSUPPORTED_STYLE_HOSTS = ['.pug', '.jade', '.haml', '.slim', '.elm'];

function summariseUnscanned(files: string[]): { count: number; extensions: string[] } | undefined {
  const hit = files.filter((f) => !isStyleBearing(f) && hasExtension(f, UNSUPPORTED_STYLE_HOSTS));
  if (hit.length === 0) return undefined;
  const extensions = [...new Set(hit.map((f) => f.slice(f.lastIndexOf('.')).toLowerCase()))].sort();
  return { count: hit.length, extensions };
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
  const selection = selectFiles(opts.projectRoot, opts.all);
  const { files } = selection;

  const bucketFilter = opts.ci ? (b: string) => b === 'mechanical' : undefined;
  // Does ANY stylesheet in this project sit on the token layer? Host files
  // inherit this, since their style regions never carry the project's @import.
  //
  // Computed over the whole project, NOT the selected files. On the default
  // changed-files run — a pre-commit hook, CI on a diff — a commit touching
  // only a component puts no stylesheet in the set, and computing from that
  // set made the project read as having no token layer at all: H-47 reported
  // nothing, silently, on exactly the files being reviewed. Whether a project
  // is on the token layer is a property of the project, not of the diff.
  const stylesheets =
    selection.mode === 'all' ? files : selectFiles(opts.projectRoot, true).files;
  const projectParticipates = stylesheets.some((f) => {
    if (!hasExtension(f, CSS_EXTENSIONS)) return false;
    try {
      return participatesInTokenLayer(readFileSync(join(opts.projectRoot, f), 'utf8'), tokens);
    } catch {
      return false;
    }
  });

  const findings = runChecks(opts.projectRoot, files, index, tokens, bucketFilter, projectParticipates);

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
    unscanned: summariseUnscanned(files),
  });

  return { findings, report, hasError };
}
