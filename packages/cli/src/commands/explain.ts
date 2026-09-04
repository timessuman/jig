import { join } from 'node:path';
import { assetRoot } from '../paths.js';
import { loadRules } from '../rules/load.js';
import { loadSpecs } from '../rules/specs.js';

export interface ExplainOptions {
  ruleId: string;
  version: string;
  /** Overridable for tests; defaults to the CLI's own bundled assets. */
  packageRoot?: string;
}

const ID_SHAPE = /^([A-Z])-(\d+)$/;

/**
 * Prints one rule or spec in full: what it forbids, what to do instead, which
 * version it arrived in, and who can check it.
 *
 * Reads from the CLI's own bundled rules via `assetRoot()`, never from the
 * project — the same source `check` uses. A consumer's vendored copy may have
 * been edited, and `explain` should describe the system, not one project's
 * fork of it.
 */
export function explain(opts: ExplainOptions): string {
  const raw = opts.ruleId.trim().toUpperCase();
  const shape = ID_SHAPE.exec(raw);
  if (!shape) {
    throw new Error(
      `'${opts.ruleId.trim()}' is not a rule id. Ids look like 'C-19' or 'P-02' — ` +
        `a section letter, a hyphen, and a number.`,
    );
  }

  const root = opts.packageRoot ?? assetRoot();
  const rulesDir = join(root, 'rules');

  const rules = loadRules(rulesDir, join(root, 'rules.index.json'));
  const rule = rules.find((r) => r.id === raw);
  if (rule) {
    const lines = [
      `${rule.id}  ${rule.title}`,
      '',
      `❌ ${rule.wrong}`,
      `✅ ${rule.correction}`,
      '',
      `   ${rule.bucket} · ${rule.severity}${rule.detector ? ` · detector: ${rule.detector}` : ''}`,
      `   since ${rule.since} · ${rule.source}`,
    ];
    return lines.join('\n');
  }

  // Pattern and mode specs (M10): cited by agents, absent from the rule index
  // by design. They have no ❌/✅ pair, so say what they are rather than
  // pretending to a shape they do not have.
  const spec = loadSpecs(rulesDir).find((s) => s.id === raw);
  if (spec) {
    return [
      `${spec.id}  ${spec.title}`,
      '',
      spec.body,
      '',
      `   specification — component anatomy and behaviour, not a single rule,`,
      `   so it carries no ❌/✅ pair and no detector.`,
      `   ${spec.source}`,
    ].join('\n');
  }

  // Unknown. Name what DOES exist in that section, so a mistyped number is one
  // glance from being corrected rather than a dead end.
  const section = shape[1];
  const siblings = [
    ...rules.filter((r) => r.id.startsWith(`${section}-`)).map((r) => r.id),
    ...loadSpecs(rulesDir)
      .filter((s) => s.id.startsWith(`${section}-`))
      .map((s) => s.id),
  ].sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));

  throw new Error(
    siblings.length > 0
      ? `No rule '${raw}'. Section ${section} has: ${siblings.join(', ')}.`
      : `No rule '${raw}', and no section '${section}' exists.`,
  );
}
