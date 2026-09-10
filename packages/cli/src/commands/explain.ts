import { join } from 'node:path';
import { assetRoot } from '../paths.js';
import { loadRules, type LoadedRule } from '../rules/load.js';
import { loadSpecs, type Spec } from '../rules/specs.js';

export interface ExplainOptions {
  ruleId: string;
  version: string;
  /** List ids rather than explaining one. With `ruleId` set to a section
   *  letter, lists just that section. */
  list?: boolean;
  /** Overridable for tests; defaults to the CLI's own bundled assets. */
  packageRoot?: string;
}

/** `C-19`, and also `C19` — a missing hyphen has exactly one possible meaning,
 *  and an agent that has made that typo is better served than corrected. */
const ID_SHAPE = /^([A-Z])-?(\d+)$/;
const SECTION_SHAPE = /^([A-Z])$/;

/** Enough of a match to be worth listing, and cheap enough to run over
 *  everything. Substring, case-insensitive: the corpus is a few hundred short
 *  entries, so anything cleverer would add failure modes without adding hits. */
const matches = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

const byNumber = (a: string, b: string) => {
  const [as, an] = a.split('-');
  const [bs, bn] = b.split('-');
  return as === bs ? Number(an) - Number(bn) : as.localeCompare(bs);
};

function renderRule(rule: LoadedRule): string {
  return [
    `${rule.id}  ${rule.title}`,
    '',
    `❌ ${rule.wrong}`,
    `✅ ${rule.correction}`,
    '',
    `   ${rule.bucket} · ${rule.severity}${rule.detector ? ` · detector: ${rule.detector}` : ''}`,
    `   since ${rule.since} · ${rule.source}`,
  ].join('\n');
}

function renderSpec(spec: Spec): string {
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

/**
 * Prints one rule or spec in full, lists them, or finds the ones you cannot
 * name.
 *
 * The lookup direction — id in, rule out — closes the loop after `check` prints
 * a finding. The search direction exists because that was the only direction
 * there was: an agent told to "review the colour decisions here" holds no id,
 * and `explain contrast` used to answer "not a rule id", which is the tool that
 * knows every rule declining to say which ones exist.
 *
 * Reads from the CLI's own bundled rules via `assetRoot()`, never from the
 * project — the same source `check` uses. A consumer's vendored copy may have
 * been edited, and `explain` should describe the system, not one project's
 * fork of it.
 */
export function explain(opts: ExplainOptions): string {
  const raw = opts.ruleId.trim().toUpperCase();
  const root = opts.packageRoot ?? assetRoot();
  const rulesDir = join(root, 'rules');

  const rules = loadRules(rulesDir, join(root, 'rules.index.json'));
  const specs = loadSpecs(rulesDir);
  const entries: Array<{ id: string; title: string; text: string }> = [
    ...rules.map((r) => ({ id: r.id, title: r.title, text: `${r.wrong}\n${r.correction}` })),
    ...specs.map((s) => ({ id: s.id, title: s.title, text: s.body })),
  ];

  // ---- Listing ----
  if (opts.list) {
    const section = SECTION_SHAPE.exec(raw)?.[1];
    const shown = entries
      .filter((e) => !section || e.id.startsWith(`${section}-`))
      .sort((a, b) => byNumber(a.id, b.id));
    if (shown.length === 0) {
      throw new Error(`No section '${raw}'. Sections: ${sectionsOf(entries).join(', ')}.`);
    }
    return [
      section ? `Section ${section} — ${shown.length} entries` : `${shown.length} rules and specs`,
      '',
      ...shown.map((e) => `${e.id.padEnd(6)} ${e.title}`),
    ].join('\n');
  }

  // ---- Exact id ----
  const shape = ID_SHAPE.exec(raw);
  if (shape) {
    const id = `${shape[1]}-${shape[2]}`;
    const rule = rules.find((r) => r.id === id);
    if (rule) return renderRule(rule);
    const spec = specs.find((s) => s.id === id);
    if (spec) return renderSpec(spec);

    // A well-formed id that does not exist is a mistyped number, not a search
    // term. Name what the section DOES have, so the correction is one glance
    // away rather than a dead end.
    const siblings = entries
      .filter((e) => e.id.startsWith(`${shape[1]}-`))
      .map((e) => e.id)
      .sort(byNumber);
    throw new Error(
      siblings.length > 0
        ? `No rule '${id}'. Section ${shape[1]} has: ${siblings.join(', ')}.`
        : `No rule '${id}', and no section '${shape[1]}' exists.`,
    );
  }

  // ---- Search ----
  if (raw === '') {
    throw new Error(
      `Nothing to explain. Give a rule id ('C-19'), a word to search for ` +
        `('contrast'), or --list.`,
    );
  }

  const needle = opts.ruleId.trim();
  const inTitle = entries.filter((e) => matches(e.title, needle) || matches(e.id, needle));
  const inBody = entries.filter((e) => !inTitle.includes(e) && matches(e.text, needle));
  const hits = [...inTitle.sort((a, b) => byNumber(a.id, b.id)),
                ...inBody.sort((a, b) => byNumber(a.id, b.id))];

  if (hits.length === 0) {
    throw new Error(
      `No rule matches '${needle}'. Try --list to see every id, or a broader word.`,
    );
  }

  // Exactly one hit is not ambiguous, so answer the question rather than
  // making the reader run a second command to get the same rule.
  if (hits.length === 1) {
    const rule = rules.find((r) => r.id === hits[0].id);
    return rule ? renderRule(rule) : renderSpec(specs.find((s) => s.id === hits[0].id)!);
  }

  // Several: ids and titles only. Printing every body here would bury the
  // answer in the thing the reader is trying to narrow down.
  return [
    // Title matches lead, so the list is ranked rather than sorted. Say so:
    // otherwise C-19 sitting above A-02 reads as a sorting bug.
    `${hits.length} entries match '${needle}' — title matches first:`,
    '',
    ...hits.map((e) => `${e.id.padEnd(6)} ${e.title}`),
    '',
    `Run 'jig explain <id>' for any of them.`,
  ].join('\n');
}

function sectionsOf(entries: Array<{ id: string }>): string[] {
  return [...new Set(entries.map((e) => e.id.split('-')[0]))].sort();
}
