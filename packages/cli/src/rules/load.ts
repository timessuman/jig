import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules, type Rule } from './parse.js';
import { validateIndex, type IndexEntry } from './schema.js';

export { validateIndex };
export type { IndexEntry };

export interface LoadedRule extends Rule, Omit<IndexEntry, 'id'> {}

export function loadRules(rulesDir: string, indexPath: string): LoadedRule[] {
  const files = readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort();
  const parsed: Rule[] = [];
  for (const file of files) {
    parsed.push(...parseRules(readFileSync(join(rulesDir, file), 'utf8'), file));
  }

  const entries = validateIndex(JSON.parse(readFileSync(indexPath, 'utf8')));
  const byId = new Map(entries.map((e) => [e.id, e]));

  const missing = parsed.filter((r) => !byId.has(r.id)).map((r) => r.id);
  if (missing.length) {
    throw new Error(
      `Rules present in markdown but missing from rules.index.json: ${missing.join(', ')}`,
    );
  }

  const parsedIds = new Set(parsed.map((r) => r.id));
  const orphans = entries.filter((e) => !parsedIds.has(e.id)).map((e) => e.id);
  if (orphans.length) {
    throw new Error(
      `Entries in rules.index.json with no matching rule: ${orphans.join(', ')}`,
    );
  }

  return parsed.map((r) => {
    const { id: _id, ...meta } = byId.get(r.id)!;
    return { ...r, ...meta };
  });
}
