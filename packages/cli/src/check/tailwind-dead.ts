import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { askTailwind, tailwindNode, whyNot } from '../tailwind/ask.js';
import { CSS_EXTENSIONS, hasExtension } from './ext.js';
import { isMarkupHost, maskNonStyleRegions } from './styles.js';
import { maskComments } from './css.js';
import { classAttributeValues } from './tailwind.js';

/**
 * A Tailwind class that generates no CSS.
 *
 * Tailwind v4 writes nothing for a utility it cannot resolve, and says nothing
 * either. `min-h-touch` in a project with no `--spacing-touch` renders onto the
 * element and does nothing: a 22px button where the class asked for 48. No
 * `var()` is ever written, so `H-117`, which reads `var()`, never sees the
 * missing token. `duration-fast` was the same with the token declared, because
 * Tailwind reads durations from `--transition-duration-*`.
 *
 * The answer comes from the project's own Tailwind, never from a list of
 * namespaces kept here (see ../tailwind/ask.ts). Tailwind's design system says
 * two things about a class. `parseCandidate` says whether it is a utility at
 * all, so a class the project names itself (`card`, `group`, `btn-primary`) is
 * left alone. `candidatesToCss` says whether that utility produces anything. A
 * utility that produces nothing, in every Tailwind stylesheet the project has,
 * is dead.
 *
 * A class the project's own CSS defines (`.text-hero { … }`) is not dead even
 * when Tailwind reads it as a utility with no value.
 */
export interface DeadClass {
  file: string;
  line: number;
  className: string;
}

export interface TailwindDead {
  dead: DeadClass[];
  /** Why the classes were not checked, when the project uses Tailwind v4 and they were not. */
  skipped?: string;
}

const TAILWIND_IMPORT = /@import\s+(?:url\(\s*)?["']tailwindcss["']/;

// Runs in the child: the dead ones among input.classes.
const QUERY = `
const systems = [];
for (const entry of input.entries) systems.push(await loadDesignSystem(readFileSync(entry.file, 'utf8'), { base: entry.base }));
const css = systems.map((ds) => ds.candidatesToCss(input.classes));
answer(input.classes.filter((c, i) => systems.some((ds) => ds.parseCandidate(c).length > 0) && css.every((list) => !list[i])));
`;

/** Class names a stylesheet defines in its own selectors. */
function definedClasses(css: string): Set<string> {
  const out = new Set<string>();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]!);
  return out;
}

export function deadTailwindClasses(projectRoot: string, files: string[], stylesheets: string[]): TailwindDead {
  const read = (f: string) => {
    try {
      return readFileSync(join(projectRoot, f), 'utf8');
    } catch {
      return '';
    }
  };
  const entries = stylesheets.filter((f) => hasExtension(f, CSS_EXTENSIONS) && TAILWIND_IMPORT.test(maskComments(read(f))));
  if (entries.length === 0) return { dead: [] };

  const module = tailwindNode(projectRoot);
  if (!module) return { dead: [], skipped: 'a stylesheet imports Tailwind v4, but @tailwindcss/node is not installed here, so no class was asked about' };

  const defined = new Set<string>();
  for (const f of stylesheets) for (const c of definedClasses(maskComments(maskNonStyleRegions(read(f), f)))) defined.add(c);

  const uses: DeadClass[] = [];
  for (const file of files) {
    if (!isMarkupHost(file)) continue;
    for (const { classes, line } of classAttributeValues(read(file))) {
      for (const className of classes.split(/\s+/)) {
        // Interpolation and expressions are not class names.
        if (!className || /[{}$`'"]/.test(className)) continue;
        uses.push({ file, line, className });
      }
    }
  }
  const candidates = [...new Set(uses.map((u) => u.className))].filter((c) => !defined.has(c.split(':').pop()!));
  if (candidates.length === 0) return { dead: [] };

  let dead: string[];
  try {
    const input = { entries: entries.map((e) => ({ file: join(projectRoot, e), base: dirname(join(projectRoot, e)) })), classes: candidates };
    dead = askTailwind<string[]>(projectRoot, module, QUERY, input);
  } catch (err) {
    return { dead: [], skipped: `Tailwind could not be asked which classes generate CSS (${whyNot(err)})` };
  }
  const deadSet = new Set(dead);
  return { dead: uses.filter((u) => deadSet.has(u.className)) };
}
