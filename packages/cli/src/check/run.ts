import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IndexEntry } from '../rules/schema.js';
import { maskComments } from './css.js';
import { maskNonStyleRegions } from './styles.js';
import { getDetector } from './registry.js';
import type { Bucket, Finding } from './types.js';

/**
 * Runs every detector whose rule is BOTH present in the consumer's
 * `rules.index.json` AND implemented in the registry (a rule naming a
 * detector that doesn't exist yet is skipped silently — the index
 * describes the destination, not what is built), against every file it
 * applies to.
 *
 * `bucketFilter`, when given, additionally restricts which rules run at
 * all — this is how `--ci` runs the mechanical bucket only.
 */
export function runChecks(
  projectRoot: string,
  files: string[],
  index: IndexEntry[],
  tokens: Record<string, string>,
  bucketFilter?: (bucket: Bucket) => boolean,
  projectParticipates = false,
): Finding[] {
  const findings: Finding[] = [];

  const active = index.filter(
    (e): e is IndexEntry & { detector: string } => !!e.detector && !!getDetector(e.detector),
  );
  const relevant = bucketFilter ? active.filter((e) => bucketFilter(e.bucket)) : active;
  if (relevant.length === 0) return findings;

  for (const file of files) {
    const applicable = relevant
      .map((entry) => ({ entry, detector: getDetector(entry.detector)! }))
      .filter(({ detector }) => detector.appliesTo(file));
    if (applicable.length === 0) continue;

    let raw: string;
    try {
      raw = readFileSync(join(projectRoot, file), 'utf8');
    } catch {
      continue; // e.g. a file the diff names but that was since deleted
    }
    // Comments are masked exactly once, here, so every detector — not only
    // the ones that route through leafBlocks/splitRuleBlocks — sees the same
    // view of the file. Two detectors used to scan raw `source` directly:
    // a violation living inside a comment fired, and a commented-out
    // `:focus-visible` silenced the whole file's focus-removed check. Do not
    // add a mask call inside an individual detector — that duplication is
    // how this diverged in the first place.
    // Host languages (`.tsx`, `.vue`, `.astro`, `.php`, ...) are first reduced
    // to their style regions — `<style>` blocks, `style` attributes and
    // objects, CSS tagged templates — with every character position preserved,
    // so the detectors below run unchanged and their line numbers still point
    // at the host file's real lines. A plain stylesheet passes through
    // untouched. See ./styles.ts.
    const source = maskComments(maskNonStyleRegions(raw, file));

    for (const { entry, detector } of applicable) {
      const ctx = { ruleId: entry.id, bucket: entry.bucket, severity: entry.severity, tokens, projectParticipates };
      findings.push(...detector.run(source, file, ctx));
    }
  }

  return findings;
}
