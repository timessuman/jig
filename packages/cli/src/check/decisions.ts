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
  return [...decisionHeadings(projectRoot).keys()];
}

/** Each decision's name, with the heading line as the file writes it. */
export function decisionHeadings(projectRoot: string): Map<string, string> {
  const headings = new Map<string, string>();
  const path = decisionsFile(projectRoot);
  if (!path) return headings;
  let body: string;
  try {
    body = readFileSync(join(projectRoot, path), 'utf8');
  } catch {
    return headings;
  }
  for (const match of body.matchAll(HEADING)) {
    const name = match[2]!.replace(/[`*]/g, '').trim();
    if (!name || NOT_A_DECISION.test(name)) continue;
    if (!headings.has(name)) headings.set(name, match[0].trim());
  }
  return headings;
}

/** Each decision's section text, by name. */
function decisionSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = body.split('\n');
  let name: string | undefined;
  let text: string[] = [];
  const close = () => { if (name && !NOT_A_DECISION.test(name) && !sections.has(name)) sections.set(name, text.join('\n').trim()); };
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      close();
      name = heading[1]!.length >= 2 ? heading[2]!.replace(/[`*]/g, '').trim() : undefined;
      text = [];
    } else text.push(line);
  }
  close();
  return sections;
}

/**
 * Decisions whose reason cannot be told apart from the agent's.
 *
 * On jig-site, reasons read "given directly by the owner", followed by
 * sentences the agent had written, and others carried no attribution at all:
 * a later agent had no way to tell which words to weigh as the team's. A
 * `Why` is the owner's words in quotation marks, `not given`, or labelled
 * `**Why (inferred):**` as the agent's own.
 *
 * Only the decisions that differ from `before` (the file as it stood when the
 * session began) are held to it, so a file written before this rule is not
 * blocked for its history.
 */
export function unsourcedReasons(current: string, before: string): string[] {
  const then = decisionSections(before);
  const problems: string[] = [];
  for (const [name, text] of decisionSections(current)) {
    if (then.get(name) === text) continue;
    const whys = text.split(/\n\s*\n/).filter((p) => /^\s*\*\*Why\b[^*]*:\*\*/.test(p));
    for (const why of whys) {
      const label = /^\s*\*\*(Why\b[^*]*):\*\*/.exec(why)![1]!;
      const said = why.replace(/^\s*\*\*Why\b[^*]*:\*\*/, '').trim();
      if (/inferred/i.test(label)) continue;
      if (/^not given\b/i.test(said)) continue;
      if (/["“][^"”]{3,}["”]/.test(said)) continue;
      problems.push(`"${name}": its \`**${label}:**\` is not the owner's words in quotation marks. Quote what the owner said, write \`not given\`, or put what you added under \`**Why (inferred):**\`.`);
      break;
    }
  }
  return problems;
}
