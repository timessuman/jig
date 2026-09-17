import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The prose in the rule files that belongs to no id.
 *
 * Rules (`### X-NN`) and specs (`## P-NN`, `M-`, `L-`, `R-`, `T-`) are
 * addressable. Everything else — a file's introduction, a section intro like
 * `## I. Copy`, and whole sections such as `01-modes.md`'s "What mode does not
 * control" — was printed nowhere and searchable nowhere. Some of it is the most
 * important guidance in its file.
 *
 * Ownership mirrors the two id parsers exactly, so a line is either an id's or a
 * section's, never both and never neither:
 * - a rule heading owns lines until the next heading of any level (`parse.ts`);
 * - a spec heading owns lines until the next `#` or `##` heading, so its own
 *   `### Rules` subsections stay inside it (`specs.ts`);
 * - any other heading, outside a spec, starts a section.
 */

export interface Section {
  file: string;
  heading: string;
  anchor: string;
  body: string;
}

const RULE_HEADING = /^###\s+[A-Z]-\d+\b/;
const SPEC_HEADING = /^##\s+[PMLRT]-\d+\b/;
const ANY_HEADING = /^(#{1,6})\s+(.*?)\s*$/;

export function anchorOf(file: string, heading: string): string {
  const slug = heading
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return `${file}#${slug}`;
}

export function parseSections(markdown: string, file: string): Section[] {
  const sections: Section[] = [];
  let owner: 'rule' | 'spec' | 'section' | null = null;
  let heading = '';
  let body: string[] = [];

  const push = () => {
    if (owner !== 'section') return;
    const text = body
      .map((l) => l.trim())
      .filter((l) => !/^-{3,}$/.test(l))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (text) sections.push({ file, heading, anchor: anchorOf(file, heading), body: text });
  };

  for (const line of markdown.split('\n')) {
    const h = ANY_HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      if (owner === 'spec' && level >= 3) continue; // a spec's own subsection
      push();
      body = [];
      if (RULE_HEADING.test(line)) owner = 'rule';
      else if (SPEC_HEADING.test(line)) owner = 'spec';
      else {
        owner = 'section';
        heading = h[2];
      }
      continue;
    }
    if (owner === 'section') body.push(line);
  }
  push();
  return sections;
}

export function loadSections(rulesDir: string): Section[] {
  const out: Section[] = [];
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    out.push(...parseSections(readFileSync(join(rulesDir, file), 'utf8'), file));
  }
  return out;
}
