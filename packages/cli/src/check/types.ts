import type { Bucket, Severity } from '../rules/schema.js';

export type { Bucket, Severity };

export interface Finding {
  ruleId: string; // 'E-29'
  detector: string; // 'focus-removed'
  bucket: Bucket;
  severity: Severity; // from rules.index.json
  file: string; // repo-relative
  line: number; // 1-indexed
  message: string; // what is wrong, in one line
  excerpt?: string; // the offending source, trimmed
}

/**
 * `ruleId` / `bucket` / `severity` come from the consumer's
 * `rules.index.json` entry that named this detector — a detector never
 * hardcodes its own rule metadata, so the same implementation would keep
 * working if a rule were renumbered. `tokens` is the vendored token map
 * (custom-property name, without the leading `--`, to its raw declared
 * value) used to resolve `var(--...)` references in `contrast-floor` and
 * `violet-band-hue`.
 */
export interface DetectorContext {
  ruleId: string;
  bucket: Bucket;
  severity: Severity;
  tokens: Record<string, string>;
}

export interface Detector {
  name: string; // matches rules.index.json `detector`
  appliesTo(file: string): boolean; // by extension
  run(source: string, file: string, ctx: DetectorContext): Finding[];
}
