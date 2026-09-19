import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

/**
 * The project's decisions, by name, from `DECISIONS.md`.
 *
 * Every rule in the corpus is judged by `critique`, and none of the project's
 * own decisions were. In a live round one page shipped "start free trial" on
 * two plans after the owner had killed trials, and another used Title Case
 * against a lowercase decision. Both pages passed every rule; the thing they
 * broke was the file written to hold exactly that.
 *
 * A heading is a decision. `Unresolved` is not one — it is the list of what has
 * not been decided — and neither is the document's title.
 */
const HEADING = /^(#{2,3})\s+(.+?)\s*$/gm;
const NOT_A_DECISION = /^(unresolved|open questions?|undecided|contents?|index)$/i;

/**
 * Where DECISIONS.md is: beside the token layer, which is `jig/` by default or
 * wherever `brand` in jig.config.json puts the token files. The brand's own
 * folder is tried first, because that is the location the procedure names; the
 * fixed list is for a project with no config.
 */
export function decisionsFile(projectRoot: string): string | undefined {
  const candidates = ['jig/DECISIONS.md', 'DECISIONS.md', 'src/jig/DECISIONS.md', 'src/styles/jig/DECISIONS.md', '.jig/DECISIONS.md'];
  try {
    const brand = JSON.parse(readFileSync(join(projectRoot, 'jig.config.json'), 'utf8')).brand;
    if (typeof brand === 'string' && brand.includes('/')) candidates.unshift(`${posix.dirname(brand.replace(/^\.\//, ''))}/DECISIONS.md`);
  } catch { /* no config, or not JSON: the fixed list */ }
  for (const candidate of candidates) {
    if (existsSync(join(projectRoot, candidate))) return candidate;
  }
  return undefined;
}

export function decisionNames(projectRoot: string): string[] {
  const path = decisionsFile(projectRoot);
  if (!path) return [];
  let body: string;
  try {
    body = readFileSync(join(projectRoot, path), 'utf8');
  } catch {
    return [];
  }
  const names: string[] = [];
  for (const match of body.matchAll(HEADING)) {
    const name = match[2]!.replace(/[`*]/g, '').trim();
    if (!name || NOT_A_DECISION.test(name)) continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}
