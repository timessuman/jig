export type Bucket = 'mechanical' | 'judgment' | 'hybrid';
export type Severity = 'error' | 'warning' | 'note';

export interface IndexEntry {
  id: string;
  bucket: Bucket;
  severity: Severity;
  detector?: string;
  fix?: string;
  since: string;
}

const BUCKETS: Bucket[] = ['mechanical', 'judgment', 'hybrid'];
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
    return {
      id: e.id,
      bucket: e.bucket as Bucket,
      severity: e.severity as Severity,
      detector: typeof e.detector === 'string' ? e.detector : undefined,
      fix: typeof e.fix === 'string' ? e.fix : undefined,
      since: e.since,
    };
  });
}
