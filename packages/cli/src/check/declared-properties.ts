import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every custom property the project declares, for `H-117`.
 *
 * A `var(--name)` whose name nothing declares is not a lint nit: the browser
 * treats the whole declaration as invalid and falls back to the initial value.
 * In arm test 3, three of four pages invented their token names — `--font-body`,
 * `--space-lg`, `--color-text-primary` — and rendered in Times New Roman with no
 * spacing and no borders, while `jig check` reported them clean.
 *
 * A project fact: the token layer, the Tailwind `@theme`, and the component
 * reading the token are routinely different files. Read raw, not masked, so a
 * `style="--x: 1"` attribute, a JSX style object and `setProperty('--x')` all
 * count as declarations.
 *
 * `complete: false` when a stylesheet imports a package this cannot read — its
 * declarations are unknown, so `H-117` stays silent rather than guessing.
 */
export interface DeclaredProperties {
  names: Set<string>;
  tailwind: boolean;
  complete: boolean;
}

const DECLARATION_RE = /(?<![\w-])['"]?(--[A-Za-z_][\w-]*)['"]?\s*:/g;
const AT_PROPERTY_RE = /@property\s+(--[\w-]+)/g;
const SET_PROPERTY_RE = /setProperty\(\s*['"`](--[\w-]+)/g;
const IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"')]+)["']/g;
const TAILWIND_RE = /@import\s+["']tailwindcss["']/;

function addAll(names: Set<string>, text: string): void {
  for (const re of [DECLARATION_RE, AT_PROPERTY_RE, SET_PROPERTY_RE]) {
    for (const m of text.matchAll(re)) names.add(m[1]!);
  }
}

/** A bare `@import "pkg/theme.css"` resolved into node_modules, or undefined. */
function readPackageImport(projectRoot: string, spec: string): string | undefined {
  const base = join(projectRoot, 'node_modules', spec);
  for (const candidate of [base, `${base}.css`]) {
    try {
      if (existsSync(candidate) && candidate.endsWith('.css')) return readFileSync(candidate, 'utf8');
    } catch { /* unreadable: treated as unresolved */ }
  }
  try {
    const pkg = JSON.parse(readFileSync(join(base, 'package.json'), 'utf8')) as { style?: string };
    if (pkg.style) return readFileSync(join(base, pkg.style), 'utf8');
  } catch { /* no package or no style entry */ }
  return undefined;
}

export function collectDeclaredProperties(
  projectRoot: string,
  files: string[],
  tokenNames: string[] = [],
): DeclaredProperties {
  const names = new Set<string>(tokenNames.map((n) => `--${n}`));
  let tailwind = false;
  let complete = true;
  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(join(projectRoot, file), 'utf8');
    } catch {
      continue;
    }
    addAll(names, raw);
    if (TAILWIND_RE.test(raw)) tailwind = true;
    for (const m of raw.matchAll(IMPORT_RE)) {
      const spec = m[1]!;
      if (spec === 'tailwindcss' || /^(\.|\/|https?:)/.test(spec)) continue;
      const imported = readPackageImport(projectRoot, spec);
      if (imported === undefined) complete = false;
      else addAll(names, imported);
    }
  }
  return { names, tailwind, complete };
}

const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|mauve|olive|mist|taupe';
const SIZE = '3xs|2xs|xs|sm|md|lg|xl|[2-9]xl|base';

/**
 * Names Tailwind v4 declares in its default theme. They exist in the compiled
 * CSS, which lives in a build directory the scan skips, so they are allowed by
 * shape when the project imports Tailwind. Deliberately exact: `--color-text-primary`
 * is not a Tailwind default, and is exactly the kind of name an agent invents.
 */
const TAILWIND_DEFAULT_RE = new RegExp(
  `^--(?:tw-[\\w-]+` +
    `|color-(?:(?:${PALETTE})-(?:50|[1-9]00|950)|black|white)` +
    `|spacing|container-(?:${SIZE})` +
    `|text-(?:${SIZE})(?:--line-height|--letter-spacing|--font-weight)?` +
    `|font-(?:sans|serif|mono)|font-weight-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)` +
    `|tracking-(?:tighter|tight|normal|wide|wider|widest)|leading-(?:tight|snug|normal|relaxed|loose)` +
    `|breakpoint-(?:${SIZE})|radius-(?:${SIZE})` +
    `|(?:inset-shadow|drop-shadow|text-shadow|shadow|blur|perspective|ease|animate|aspect|default)-[\\w-]+|shadow|blur)$`,
);

export function isTailwindDefault(name: string): boolean {
  return TAILWIND_DEFAULT_RE.test(name);
}
