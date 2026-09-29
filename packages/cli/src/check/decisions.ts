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
 * The `**Why…:**` paragraphs of each decision that differs from `before`. With
 * `newOnly`, just the paragraphs `before` did not hold: a tweak that amends a
 * decision answers for the reason it adds, not for one decide wrote earlier.
 */
function changedWhys(current: string, before: string, newOnly = false): Array<[string, string[]]> {
  const then = decisionSections(before);
  const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => /^\*\*Why\b[^*]*:\*\*/.test(p));
  const out: Array<[string, string[]]> = [];
  for (const [name, text] of decisionSections(current)) {
    const old = then.get(name);
    if (old === text) continue;
    const kept = newOnly && old !== undefined ? new Set(paragraphs(old)) : new Set<string>();
    const whys = paragraphs(text).filter((p) => !kept.has(p));
    if (whys.length) out.push([name, whys]);
  }
  return out;
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
export function unsourcedReasons(current: string, before: string, opts: { newWhysOnly?: boolean } = {}): string[] {
  const problems: string[] = [];
  for (const [name, whys] of changedWhys(current, before, opts.newWhysOnly)) {
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

/**
 * Quotations under a changed decision's `**Why:**` that the owner's words do
 * not contain.
 *
 * A tweak records a decision from the owner's instruction, which its
 * tweak.json keeps as `change`. On jig-site a tweak was shown a screenshot of
 * a copy button and wrote an exception to `E-51`, "given directly by the
 * owner ... by reference rather than words": a ruling nobody gave, in the file
 * every later critique judges the page by. A quotation is the owner's only if
 * the owner's words hold it; `…` may join the parts of one.
 */
export function quotesNotFrom(current: string, before: string, words: string): string[] {
  const problems: string[] = [];
  for (const [name, whys] of changedWhys(current, before, true)) {
    for (const why of whys) {
      const label = /^\s*\*\*(Why\b[^*]*):\*\*/.exec(why)![1]!;
      if (/inferred/i.test(label)) continue;
      const missing = [...why.matchAll(/["“]([^"”]{3,})["”]/g)]
        .map((m) => m[1]!)
        .filter((q) => !quoteHeld(q, words));
      if (missing.length) {
        problems.push(`"${name}": its \`**${label}:**\` quotes "${missing[0]}", which the owner's words in tweak.json (\`change\`) do not say. Quote the owner as tweak.json records them, or put your reading under \`**Why (inferred):**\`.`);
        break;
      }
    }
  }
  return problems;
}

const normQuote = (t: string) => t.toLowerCase().replace(/\\(?=["'\\])/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

/**
 * Whether `words` hold a quotation: every part of it, where `…` joins parts,
 * ignoring case, curly quotes, runs of whitespace and a YAML string's escapes.
 */
export function quoteHeld(quote: string, words: string): boolean {
  const said = normQuote(words);
  return quote.split(/…|\.\.\./)
    .map((part) => normQuote(part).replace(/^[\s.,;:]+|[\s.,;:!?]+$/g, ''))
    .filter(Boolean)
    .every((part) => said.includes(part));
}
