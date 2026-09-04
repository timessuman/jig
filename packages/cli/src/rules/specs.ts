import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The `## P-NN · Name` pattern specs in `03-patterns.md` and `## M-NN · name`
 * mode specs in `01-modes.md`.
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
 */
export interface Spec {
  id: string;
  title: string;
  /** The section body, without its heading. */
  body: string;
  source: string;
}

const HEADING = /^##\s+([PM]-\d+)\s*(?:·\s*)?(.*?)\s*$/;

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
      current = { id, title, body: '', source: `${sourceFile}#${id.toLowerCase()}` };
      continue;
    }
    // A `##` heading that is not a spec ends the current one — otherwise a
    // spec absorbs every section after it to the end of the file.
    if (current && /^##\s/.test(line)) {
      push();
      current = null;
      continue;
    }
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
