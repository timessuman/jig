export type Bucket = 'mechanical' | 'judgment' | 'hybrid';
export type Severity = 'error' | 'warning' | 'note';

/**
 * Which review pass judges this rule.
 *
 * `bucket` says who *can* decide a rule — a machine or a reader. `pass` says
 * *what they have to look at*, which is a different question and the one that
 * keeps two commands from returning different verdicts on one rule:
 *
 * - `code` — decidable by reading files. A `font-weight`, a missing `:focus`,
 *   Title Case in a label.
 * - `screen` — decidable only from the rendered composition. Proximity
 *   hierarchy, a broken left edge, whether navigation is hidden at a width that
 *   would have fitted it. These are not in any file; they are in what the files
 *   produce together.
 *
 * `check` judges the `code` rules. `critique` renders and judges the `screen`
 * ones. Neither re-judges the other's, so they cannot disagree — which is the
 * failure `impeccable` still has, where its `audit` and its `critique` both
 * assess anti-patterns by different routes.
 */
export type Pass = 'code' | 'screen';

export interface IndexEntry {
  id: string;
  bucket: Bucket;
  severity: Severity;
  detector?: string;
  fix?: string;
  since: string;
  /** Required for judgment rules; meaningless for the others. */
  pass?: Pass;
}

const BUCKETS: Bucket[] = ['mechanical', 'judgment', 'hybrid'];
const PASSES: Pass[] = ['code', 'screen'];
const SEVERITIES: Severity[] = ['error', 'warning', 'note'];

export function validateIndex(entries: unknown): IndexEntry[] {
  if (!Array.isArray(entries)) throw new Error('rules.index.json must be an array');
  return entries.map((raw, i) => {
    const e = raw as Record<string, unknown>;
    const at = `rules.index.json[${i}]`;
    if (typeof e.id !== 'string' || !/^[A-Z]-\d+$/.test(e.id)) {
      throw new Error(`${at}: missing or malformed id`);
    }
    if (!BUCKETS.includes(e.bucket as Bucket)) {
      throw new Error(`${at} (${e.id}): bucket must be one of ${BUCKETS.join(', ')}`);
    }
    if (!SEVERITIES.includes(e.severity as Severity)) {
      throw new Error(`${at} (${e.id}): severity must be one of ${SEVERITIES.join(', ')}`);
    }
    if (typeof e.since !== 'string') {
      throw new Error(`${at} (${e.id}): since is required`);
    }
    // Required on judgment rules only. A rule that does not say which pass owns
    // it gets judged by both or by neither, and both outcomes are silent: two
    // verdicts a user has to reconcile, or a rule nobody applies.
    if (e.bucket === 'judgment' && !PASSES.includes(e.pass as Pass)) {
      throw new Error(
        `${at} (${e.id}): judgment rules need pass: ${PASSES.join(' or ')} — ` +
          `'code' if it can be decided by reading files, 'screen' if it needs the rendered page`,
      );
    }
    if (e.pass !== undefined && !PASSES.includes(e.pass as Pass)) {
      throw new Error(`${at} (${e.id}): pass must be one of ${PASSES.join(', ')}`);
    }
    return {
      id: e.id,
      bucket: e.bucket as Bucket,
      severity: e.severity as Severity,
      detector: typeof e.detector === 'string' ? e.detector : undefined,
      fix: typeof e.fix === 'string' ? e.fix : undefined,
      since: e.since,
      pass: e.pass as Pass | undefined,
    };
  });
}
