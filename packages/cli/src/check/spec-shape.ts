import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The newest `.jig/specs/<slug>.spec.md`, or a `.md` beside it. */
export function newestSpec(projectRoot: string): { path: string; slug: string; body: string } | undefined {
  const dir = join(projectRoot, '.jig', 'specs');
  if (!existsSync(dir)) return undefined;
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  if (files.length === 0) return undefined;
  const newest = files
    .map((f) => ({ f, at: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at)[0]!.f;
  return { path: `.jig/specs/${newest}`, slug: newest.replace(/\.spec\.md$|\.md$/, ''), body: readFileSync(join(dir, newest), 'utf8') };
}

/**
 * Why the shape is checked at all: in arm test 4 not one of four runs wrote a
 * spec in the procedure's format. All four were prose documents — no
 * frontmatter, no `sizes:`, no per-size `nav:` — so every later step had
 * nothing to build to or check against, and the per-size navigation rule could
 * not apply. The procedure said all of this in words.
 */
export function specProblems(spec: { path: string; body: string }): string[] {
  const parts = spec.body.split(/^---\s*$/m);
  const front = parts.length >= 3 ? parts[1]! : '';
  if (!front.trim()) {
    return [`${spec.path} has no frontmatter. A spec is the frontmatter — feature, surface, mode, sizes (phone, tablet, desktop), states, decisions, later, mockup, confirmed — with the reasoning below it. Rewrite it in that shape.`];
  }
  const problems: string[] = [];
  const has = (field: string) => new RegExp(`^\\s*${field}\\s*:`, 'im').test(front);
  if (specIndexableField(front) === 'unreadable') {
    problems.push(`${spec.path}: \`indexable:\` is neither true nor false. Write \`indexable: true\` or \`indexable: false\`; a per-page override and its reason go in the body, where they can be read without being parsed.`);
  }
  for (const field of ['feature', 'surface', 'mode', 'sizes', 'confirmed', 'mockup']) {
    if (!has(field)) problems.push(`${spec.path} frontmatter has no \`${field}:\`.`);
  }
  const sizes = front.split(/^sizes\s*:/im)[1] ?? '';
  // `landscape` is deliberately absent: optional, and judged only when a spec
  // says the composition changes between tablet and desktop.
  for (const size of ['phone', 'tablet', 'desktop', 'wide']) {
    const line = new RegExp(`^\\s+${size}\\s*:(.*)$`, 'im').exec(sizes);
    if (!line) {
      problems.push(`${spec.path} has no \`${size}:\` composition under \`sizes:\`. Every size is written in full, phone first; \`same-as:\` needs a \`why:\`.`);
      continue;
    }
    // A size is a composition, not a sentence. In a live run every spec wrote
    // `phone: 360px, stacked cards, menu button top-right` — frontmatter in
    // shape, prose in substance, and nothing in it can be compared to a page.
    if (line[1]!.trim()) {
      problems.push(`${spec.path}: \`${size}:\` is a one-line description. A size is a composition — \`regions:\` in order, \`hierarchy:\`, \`nav:\` — each on its own line, or \`same-as:\` with a \`why:\`.`);
      continue;
    }
    const block = sizeBlock(sizes, size);
    if (/^\s*same-as\s*:/im.test(block)) {
      if (!/^\s*why\s*:/im.test(block)) problems.push(`${spec.path}: \`${size}\` claims \`same-as:\` with no \`why:\`. The claim is checked on a render, so it says why it holds.`);
      continue;
    }
    for (const field of ['regions', 'nav']) {
      if (!new RegExp(`^\\s*${field}\\s*:`, 'im').test(block)) {
        problems.push(`${spec.path}: \`${size}\` has no \`${field}:\`. Every size names its regions in order and what its navigation is at that width (\`nav: none\` when the screen has none).`);
      }
    }
  }
  return problems;
}

/** The lines under one size, up to the next size or the next top-level field. */
function sizeBlock(sizes: string, size: string): string {
  const start = new RegExp(`^\\s+${size}\\s*:.*$`, 'im').exec(sizes);
  if (!start) return '';
  const rest = sizes.slice(start.index + start[0].length);
  const indent = /^\s*/.exec(start[0])![0].length;
  const lines: string[] = [];
  for (const line of rest.split('\n')) {
    if (line.trim() && /^\s*/.exec(line)![0].length <= indent) break;
    lines.push(line);
  }
  return lines.join('\n');
}

/** `nav:` values that name a menu control — but not ones that rule it out.
 *  A live spec wrote `nav: horizontal bar (no menu), logo left` and was told it
 *  had put a menu where the links fit. A false positive is how a gate gets
 *  ignored. */
const MENU_RE = /(?<!\b(?:no|not|without|never)\s)(?<!\bno\s\w{1,12}\s)\b(menu|hamburger|drawer|burger)\b/i;
const NONE_RE = /^\s*(none|no navigation|n\/a|-)\b/i;

/**
 * A menu button at a width where the destinations fit (`P-14`, and the fix
 * after arm test 3, where every spec wrote "menu button, top right" at all
 * three sizes from a decision that was only about position).
 */
export function navProblems(spec: { path: string; body: string }): string[] {
  const front = spec.body.split(/^---\s*$/m)[1] ?? '';
  const sizes = front.split(/^sizes\s*:/im)[1] ?? '';
  const problems: string[] = [];
  for (const size of ['tablet', 'landscape', 'desktop', 'wide']) {
    const block = sizeBlock(sizes, size);
    const nav = /^\s*nav\s*:\s*(.+)$/im.exec(block)?.[1]?.trim();
    if (!nav || NONE_RE.test(nav)) continue;
    if (MENU_RE.test(nav) && !/\bopen\b|\bexpanded\b/i.test(nav)) {
      problems.push(`${spec.path}: \`${size}\` has \`nav: ${nav}\`. Run P-14's table at that width — where every destination fits, the links show and there is no menu button. A decision about where the button sits is about position, not whether it exists.`);
    }
  }
  return problems;
}

/**
 * The spec's `indexable:` as written: true, false, absent, or unreadable.
 *
 * Unreadable is its own answer. A spec wrote a sentence here, the override and
 * its reason on one line, and the parser read no bare word, fell back to the
 * mode's default, and reported the correct page as contradicting J-123. The
 * value is `true` or `false`; the reason belongs in the spec's body.
 */
export function specIndexableField(front: string): boolean | 'absent' | 'unreadable' {
  const line = /^\s*indexable\s*:(.*)$/im.exec(front);
  if (!line) return 'absent';
  // A YAML comment is not part of the value. The spec template itself writes
  // `indexable: true   # from the mode ...`, and a spec that copied it was
  // reported unreadable.
  const value = line[1]!.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (value === 'true' || value === 'yes') return true;
  if (value === 'false' || value === 'no') return false;
  return 'unreadable';
}
