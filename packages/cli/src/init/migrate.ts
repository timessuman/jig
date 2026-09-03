import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { isModified, type Manifest } from '../install/manifest.js';

/** Matches a numbered rule file name (`00-anti-patterns.md`, `05-copy.md`,
 *  ...) regardless of which rules happen to exist in a given version. */
const LEGACY_RULE_RE = /^\d{2}-.*\.md$/;

/** The exact set of pre-0.4.0 install artifacts `init`/`check` offer to
 *  remove from a project's `.jig/` — Jig's own property, vendored there by
 *  a version of `install` that no longer exists. Everything else in
 *  `.jig/` (`tokens/`, `state.json`/`init-manifest.json`) is the project's
 *  own and is never touched by this module. */
function isLegacyInstallArtifact(name: string): boolean {
  return LEGACY_RULE_RE.test(name) || name === 'rules.index.json' || name === 'LICENSE' || name === 'NOTICE' || name === 'manifest.json';
}

export interface LegacyFile {
  /** Project-root-relative, forward-slash (e.g. `.jig/00-anti-patterns.md`). */
  relPath: string;
  /** `true`/`false` from comparing against the legacy `.jig/manifest.json`'s
   *  recorded checksum; `'unknown'` when there is no legacy manifest (or no
   *  entry for this file) to verify against — treated as "do not remove". */
  modified: boolean | 'unknown';
}

export interface LegacyReport {
  present: boolean;
  files: LegacyFile[];
}

/**
 * Scans a project's `.jig/` for pre-0.4.0 install artifacts (rule markdown,
 * `rules.index.json`, `LICENSE`, `NOTICE`, and the old `manifest.json`
 * itself) — the files a version of `install` before this architecture
 * vendored there, and which `check`/`update` no longer read.
 *
 * Cross-references the legacy `.jig/manifest.json`, if present and
 * readable, to tell an untouched vendored file (safe to remove with
 * consent) from one the user has since edited (never removed — that edit
 * is theirs and the new architecture has nowhere to put it).
 */
export function detectLegacyRules(projectRoot: string): LegacyReport {
  const jigDir = join(projectRoot, '.jig');
  if (!existsSync(jigDir)) return { present: false, files: [] };

  let legacyManifest: Manifest | null = null;
  try {
    const raw = JSON.parse(readFileSync(join(jigDir, 'manifest.json'), 'utf8')) as unknown;
    if (raw && typeof raw === 'object' && typeof (raw as Manifest).files === 'object') {
      legacyManifest = raw as Manifest;
    }
  } catch {
    legacyManifest = null;
  }

  let entries: string[];
  try {
    entries = readdirSync(jigDir);
  } catch {
    entries = [];
  }

  const files: LegacyFile[] = entries
    .filter(isLegacyInstallArtifact)
    .sort()
    .map((name) => {
      const relPath = `.jig/${name}`;
      const modified: boolean | 'unknown' =
        legacyManifest && relPath in legacyManifest.files ? isModified(projectRoot, relPath, legacyManifest) : 'unknown';
      return { relPath, modified };
    });

  return { present: files.length > 0, files };
}

/** Human-readable report lines describing what was found — always safe to
 *  log, even when nothing was found (returns `[]`). */
export function describeLegacyReport(report: LegacyReport): string[] {
  if (!report.present) return [];
  const lines: string[] = [];
  lines.push(`\nFound a pre-0.4.0 Jig install in .jig/ (${report.files.length} file(s)). These are no longer used —`);
  lines.push("  since 0.4.0 the skill and its rules live in your agent's skill directory, not the project:");
  for (const f of report.files) lines.push(`    ${f.relPath}`);

  const edited = report.files.filter((f) => f.modified === true).map((f) => f.relPath);
  const unknown = report.files.filter((f) => f.modified === 'unknown').map((f) => f.relPath);
  if (edited.length) {
    lines.push('  Edited since install — kept, never removed automatically:');
    for (const relPath of edited) lines.push(`    ${relPath}`);
  }
  if (unknown.length) {
    lines.push('  No install record to verify against — kept; remove manually if you are sure they are untouched:');
    for (const relPath of unknown) lines.push(`    ${relPath}`);
  }
  return lines;
}

/** Files safe to remove with consent: present in the legacy manifest and
 *  verified byte-identical to what was vendored (never a file that is
 *  edited, and never one with no record to check against). */
export function removableLegacyFiles(report: LegacyReport): string[] {
  return report.files.filter((f) => f.modified === false).map((f) => f.relPath);
}

/** Removes exactly the given project-root-relative paths. Best-effort per
 *  file — one unremovable file (permissions, already gone) does not abort
 *  the rest. Callers must only ever pass paths from `removableLegacyFiles`,
 *  which already excludes anything edited or unverifiable. */
export function removeLegacyFiles(projectRoot: string, relPaths: string[]): void {
  for (const relPath of relPaths) {
    try {
      rmSync(join(projectRoot, ...relPath.split('/')), { force: true });
    } catch {
      // best-effort — leave it for the user to remove by hand
    }
  }
}
