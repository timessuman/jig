import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The `##`-level addressable units: `## P-NN · Name` pattern specs in
 * `03-patterns.md`, `## M-NN · name` mode specs in `01-modes.md`, and
 * `## L-NN · Name` methods, and `## R-NN · Name` principles.
 *
 * These are a different kind of thing from the `### X-NN` rules, which is why
 * `rules.index.json` deliberately excludes them: a rule states one failure and
 * its correction, and carries a bucket, a severity and possibly a detector. A
 * spec describes a component's anatomy or a mode's character over several
 * paragraphs, with no single ❌/✅ pair to point at. Putting them in the rule
 * index makes `loadRules` throw, correctly.
 *
 * But agents cite them as ids — every baseline run in this release cited
 * `P-02`, `P-05` or `P-06` — so anything that resolves a citation has to know
 * about them. That is M10, and this is the half of it that `explain` needs.
 *
 * `L-` — methods — joined in 0.10.0, and parses here rather than in a parser of
 * its own. A method is a third kind of content (a procedure to follow, not a
 * component to build or a mode to inherit), but it is the *same shape*: a `##`
 * heading with an id, a body of several paragraphs, no ❌/✅ pair, and no place
 * in the rule index. Two parsers doing one job is how two places come to answer
 * one question and disagree — `H-45`. So the kind is a field, not a file.
 *
 * The prefix is the only thing that distinguishes them, so it is read once,
 * here, and never re-derived by a caller.
 */
export type SpecKind = 'pattern' | 'mode' | 'method' | 'principle';

const KINDS: Record<string, SpecKind> = {
  P: 'pattern',
  M: 'mode',
  L: 'method',
  // `R` — principles. Both halves of `04-principles.md`: the five frames, which
  // are generative (how to recognise a failure no rule covers yet), and the
  // seven tiebreakers, which are adjudicative (which rule yields when two
  // conflict). The file itself was 0% addressable, so `04` could be cited by
  // nothing and loaded only as a whole — and the protocol says to load it only
  // when two rules conflict, which is exactly when a reader wants one entry and
  // not 141 lines.
  R: 'principle',
};

export interface Spec {
  id: string;
  title: string;
  /** What kind of unit this is, from the id's prefix. */
  kind: SpecKind;
  /** The section body, without its heading. */
  body: string;
  source: string;
}

const HEADING = /^##\s+([PMLR]-\d+)\s*(?:·\s*)?(.*?)\s*$/;

export function parseSpecs(markdown: string, sourceFile: string): Spec[] {
  const lines = markdown.split('\n');
  const specs: Spec[] = [];
  let current: Spec | null = null;
  const body: string[] = [];

  const push = () => {
    if (!current) return;
    // Trailing blank lines carry no information and make every excerpt ragged.
    specs.push({ ...current, body: body.join('\n').replace(/\n{3,}/g, '\n\n').trim() });
    body.length = 0;
  };

  for (const line of lines) {
    const heading = HEADING.exec(line);
    if (heading) {
      push();
      const [, id, title] = heading;
      current = {
        id,
        title,
        kind: KINDS[id[0]],
        body: '',
        source: `${sourceFile}#${id.toLowerCase()}`,
      };
      continue;
    }
    // A `##` heading that is not a spec ends the current one — otherwise a
    // spec absorbs every section after it to the end of the file.
    if (current && /^##\s/.test(line)) {
      push();
      current = null;
      continue;
    }
    // A bare `---` separator carries no information, and every spec in
    // `03-patterns.md` and `01-modes.md` is followed by one — so 14 of the 15
    // specs rendered a dangling rule between their prose and their footer.
    // `parse.ts` has always dropped these for `### X-NN` rules; specs took a
    // different path and never did. Dropped anywhere in the body rather than
    // only at the end, to match that: a thematic break inside one spec's prose
    // is the same non-information as one between two specs. Table separators
    // are `| --- |` and do not match.
    if (current && /^-{3,}$/.test(line.trim())) continue;
    if (current) body.push(line);
  }
  push();
  return specs;
}

export function loadSpecs(rulesDir: string): Spec[] {
  const specs: Spec[] = [];
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    specs.push(...parseSpecs(readFileSync(join(rulesDir, file), 'utf8'), file));
  }
  return specs;
}
