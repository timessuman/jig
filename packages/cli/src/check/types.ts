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
  /**
   * Whether any stylesheet in this project is on the token layer.
   *
   * H-47 is gated on participation, which a file answers for itself when it is
   * a stylesheet that imports the tokens. A component cannot: a `.vue` scoped
   * block or a styled-components template imports nothing, so it would never
   * participate and H-47 could never fire inside one. But raw values in a
   * component of a project that HAS a token layer are precisely what "past the
   * token layer" means, so host files inherit the project's answer.
   */
  projectParticipates: boolean;
  /**
   * The file's unmasked text.
   *
   * `source` has been reduced to CSS — everything else blanked — which is what
   * the CSS detectors want. Values written as utility classes are not CSS and
   * live in exactly the regions that masking removes, so a detector reading
   * them needs the original.
   */
  raw: string;
}

export interface Detector {
  name: string; // matches rules.index.json `detector`
  appliesTo(file: string): boolean; // by extension
  run(source: string, file: string, ctx: DetectorContext): Finding[];
}
