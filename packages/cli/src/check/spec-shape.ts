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
  for (const field of ['feature', 'surface', 'mode', 'sizes', 'confirmed', 'mockup']) {
    if (!has(field)) problems.push(`${spec.path} frontmatter has no \`${field}:\`.`);
  }
  const sizes = front.split(/^sizes\s*:/im)[1] ?? '';
  for (const size of ['phone', 'tablet', 'desktop']) {
    if (!new RegExp(`^\\s+${size}\\s*:`, 'im').test(sizes)) {
      problems.push(`${spec.path} has no \`${size}:\` composition under \`sizes:\`. Every size is written in full, phone first; \`same-as:\` needs a \`why:\`.`);
    }
  }
  return problems;
}

/** `nav:` values that name a menu control. */
const MENU_RE = /\b(menu|hamburger|drawer|burger)\b/i;
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
  for (const size of ['tablet', 'desktop']) {
    const block = sizes.split(new RegExp(`^\\s+${size}\\s*:`, 'im'))[1]?.split(/^\s{2}\w[\w-]*\s*:/m)[0] ?? '';
    const nav = /^\s*nav\s*:\s*(.+)$/im.exec(block)?.[1]?.trim();
    if (!nav || NONE_RE.test(nav)) continue;
    if (MENU_RE.test(nav) && !/\bopen\b|\bexpanded\b/i.test(nav)) {
      problems.push(`${spec.path}: \`${size}\` has \`nav: ${nav}\`. Run P-14's table at that width — where every destination fits, the links show and there is no menu button. A decision about where the button sits is about position, not whether it exists.`);
    }
  }
  return problems;
}
