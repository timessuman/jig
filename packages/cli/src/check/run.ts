import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IndexEntry } from '../rules/schema.js';
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
  installRoot: string,
  files: string[],
  index: IndexEntry[],
  tokens: Record<string, string>,
  bucketFilter?: (bucket: Bucket) => boolean,
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

    let source: string;
    try {
      source = readFileSync(join(installRoot, file), 'utf8');
    } catch {
      continue; // e.g. a file the diff names but that was since deleted
    }

    for (const { entry, detector } of applicable) {
      const ctx = { ruleId: entry.id, bucket: entry.bucket, severity: entry.severity, tokens };
      findings.push(...detector.run(source, file, ctx));
    }
  }

  return findings;
}
