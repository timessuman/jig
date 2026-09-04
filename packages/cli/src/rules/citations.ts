import { join } from 'node:path';
import { loadRules } from './load.js';
import { loadSpecs } from './specs.js';

/**
 * Every id an agent may legitimately cite.
 *
 * The rule index alone is not that list: the `P-` pattern specs and `M-` mode
 * specs sit outside it by design (no ❌/✅ pair, nothing for a bucket or
 * detector to describe), yet agents cite them constantly — every baseline run
 * in this release cited `P-02`, `P-05` or `P-06`. Anything validating a
 * citation against the rule index alone would reject a correct one.
 */
export function citableIds(packageRoot: string): string[] {
  const rulesDir = join(packageRoot, 'rules');
  const ids = [
    ...loadRules(rulesDir, join(packageRoot, 'rules.index.json')).map((r) => r.id),
    ...loadSpecs(rulesDir).map((s) => s.id),
  ];
  return [...new Set(ids)].sort();
}

/** Whether `id` names a real rule or spec. Tolerant of case and whitespace. */
export function isCitable(id: string, packageRoot: string): boolean {
  return citableIds(packageRoot).includes(id.trim().toUpperCase());
}
