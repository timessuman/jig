import { askTailwind, tailwindNode } from '../tailwind/ask.js';

/**
 * The optional `@theme inline` block that exposes Jig's tokens to Tailwind v4
 * as utility classes.
 *
 * Generated, never hand-written. A token missing from the block produces a
 * class that renders onto the element, matches no rule, and yields no style —
 * no error, no warning, nothing in the build output. Hand-maintaining ~130
 * aliases against a token layer that changes per release is a guarantee of
 * drift in the one direction nobody can see.
 *
 * Writing it at all is the user's decision, not the CLI's: it changes how every
 * component in the project is written, and the flat import works perfectly well
 * without it. `init` asks.
 */

/**
 * Tailwind v4's theme namespaces, as of 4.3.
 *
 * Only these prefixes generate utilities. Jig declares token families Tailwind
 * has no namespace for — `--measure-*`, `--focus-ring-*`, `--duration-*`,
 * `--opacity-*`, and the `--grid-*` a mode file may add — and aliasing one of
 * those emits a declaration that generates nothing at all. Including them
 * reproduces exactly the silent failure this file exists to prevent, so they
 * are filtered out rather than passed through hopefully.
 *
 * This list was wrong in the other direction too, which is the more expensive
 * way to be wrong: `--size-*` and `--border-width-*` were filtered out as
 * having no namespace, and both generate utilities — `size-control` sets width
 * and height, `border-hairline` sets border-width. A consumer wanting them had
 * to hand-write an alias for tokens Jig had decided, incorrectly, that Tailwind
 * could not express.
 *
 * Established by compiling one alias per namespace against `tailwindcss@4.3.3`
 * and reading the generated rules. Probe with a DISTINCT token name per
 * namespace if you re-check: `text-*`, `border-*`, `outline-*` and `max-w-*`
 * each read more than one namespace, so a shared suffix lets a colour alias
 * masquerade as proof that four other namespaces work.
 */
const TAILWIND_NAMESPACES = [
  '--opacity-',
  '--transition-duration-',
  '--color-',
  '--font-',
  '--text-',
  '--font-weight-',
  '--tracking-',
  '--leading-',
  '--breakpoint-',
  '--container-',
  '--spacing-',
  '--radius-',
  '--shadow-',
  '--inset-shadow-',
  '--drop-shadow-',
  '--blur-',
  '--perspective-',
  '--aspect-',
  '--ease-',
  '--animate-',
  '--size-',
  '--border-width-',
];

/**
 * Names inside a namespace that still generate nothing, because Tailwind's own
 * static utility of the same name wins: `shadow-none` is Tailwind's.
 */
const NOT_UTILITIES = new Set(['--shadow-none']);

/**
 * A token Tailwind reads under another name. Durations are `--duration-*` in
 * Jig and `--transition-duration-*` to Tailwind, so `duration-fast` needs the
 * alias `--transition-duration-fast: var(--duration-fast)`.
 */
const RENAMES: Array<[from: string, to: string]> = [['--duration-', '--transition-duration-']];

/** One line of the block: the name Tailwind reads, and the token it reads. */
export interface Alias {
  alias: string;
  token: string;
}

/** Every alias a token could take: its own name, and any name Tailwind reads it under. */
export function aliasCandidates(names: string[]): Alias[] {
  const out = new Map<string, Alias>();
  for (const token of new Set(names)) {
    out.set(token, { alias: token, token });
    for (const [from, to] of RENAMES) if (token.startsWith(from)) {
      const alias = to + token.slice(from.length);
      out.set(alias, { alias, token });
    }
  }
  return [...out.values()].sort((a, b) => a.alias.localeCompare(b.alias));
}

/** The aliases the namespace list above says generate a utility. Used when Tailwind cannot be asked. */
export function listedAliases(names: string[]): Alias[] {
  return aliasCandidates(names).filter((a) => TAILWIND_NAMESPACES.some((ns) => a.alias.startsWith(ns)) && !NOT_UTILITIES.has(a.alias));
}

// Runs in the child. Each alias gets a marker value, so the CSS a utility
// generates says which alias it read: under `@theme inline` the CSS carries the
// value, not the alias's name. The class list Tailwind offers leaves out some
// theme values (`duration-fast` is missing from it and compiles), so an alias
// it does not cover is tried as every utility root Tailwind registers, with
// every ending of the alias's name.
const ALIASES_QUERY = `
const ds = await loadDesignSystem('@import "tailwindcss";\\n@theme inline {\\n' + input.aliases.map((a, i) => '  ' + a + ': var(--jig-alias-' + i + ');').join('\\n') + '\\n}', { base: input.base });
const used = new Set();
const note = (list) => { for (const css of list) if (css) for (const m of css.matchAll(/var\\(--jig-alias-(\\d+)/g)) used.add(Number(m[1])); };
note(ds.candidatesToCss(ds.getClassList().map(([c]) => c)));
const roots = ds.utilities.keys('functional');
const tries = [];
input.aliases.forEach((a, i) => {
  if (used.has(i)) return;
  const parts = a.slice(2).split('-');
  for (let k = 1; k < parts.length; k++) for (const r of roots) tries.push(r + '-' + parts.slice(k).join('-'));
});
note(ds.candidatesToCss(tries));
answer(input.aliases.filter((_, i) => used.has(i)));
`;

/**
 * The aliases the project's own Tailwind generates a utility for, or
 * undefined when it cannot be asked (not installed, or it failed).
 */
export function compiledAliases(projectRoot: string, names: string[]): Alias[] | undefined {
  const module = tailwindNode(projectRoot);
  if (!module) return undefined;
  const candidates = aliasCandidates(names);
  try {
    const kept = new Set(askTailwind<string[]>(projectRoot, module, ALIASES_QUERY, { base: projectRoot, aliases: candidates.map((a) => a.alias) }));
    return candidates.filter((a) => kept.has(a.alias));
  } catch {
    return undefined;
  }
}

/** The subset of `names` Tailwind can turn into utilities, deduplicated and
 *  sorted so the generated file is byte-stable across runs — a block that
 *  reorders itself produces a diff on every `init` and trains people to skip
 *  reading it. */
export function tailwindNamespaced(names: string[]): string[] {
  const kept = names.filter((n) => TAILWIND_NAMESPACES.some((ns) => n.startsWith(ns)));
  return [...new Set(kept)].sort();
}

/** Every custom property a stylesheet declares. Reads declarations only, so a
 *  `var()` reference on the right-hand side is not mistaken for a declaration —
 *  which would alias names the layer consumes but never defines. */
export function declaredTokenNames(css: string): string[] {
  return [...css.matchAll(/(^|[;{\s])(--[\w-]+)\s*:/g)].map((m) => m[2]);
}

export function utilitiesBody(entries: Array<string | Alias>, version: string): string {
  const aliases = entries.map((e) => (typeof e === 'string' ? { alias: e, token: e } : e));
  if (aliases.length === 0) {
    throw new Error(
      'Refusing to write an empty @theme block: it generates no utilities while ' +
        'looking like it should. No token in this layer matches a Tailwind namespace.',
    );
  }
  const width = Math.max(...aliases.map((a) => a.alias.length));
  const lines = aliases.map((a) => `  ${a.alias}:${' '.repeat(width - a.alias.length)} var(${a.token});`);

  return `/* utilities.css — vendored from Jig v${version}.
   Licensed Apache-2.0. LICENSE and NOTICE ship beside the jig skill.

   Exposes the token layer to Tailwind v4 as utility classes: \`p-card\`,
   \`rounded-surface\`, \`text-text-strong\`. ONE per project, never one per mode —
   the utility references the variable rather than a resolved value, so whichever
   mode barrel a route loads supplies it. One set of utilities serves every mode.

   Import this once, in the stylesheet that imports Tailwind:

     @import "tailwindcss";
     @import "./utilities.css";

   YOU WILL SEE A DUPLICATE IN THE COMPILED CSS. That is correct:

     @layer theme { :root,:host { --radius-surface: var(--radius-surface) } }
     :root { --radius-surface: var(--radius-md) }

   The first is Tailwind's, inside \`@layer theme\`. The second is Jig's, unlayered.
   Unlayered declarations beat layered ones in the cascade regardless of source
   order, so Jig's value always wins. Do not "fix" it — deleting the alias
   removes the utility, deleting Jig's removes the value.

   Only tokens a Tailwind utility reads are listed. Durations are listed under the
   name Tailwind reads them by, \`--transition-duration-fast: var(--duration-fast)\`,
   so \`duration-fast\` works. \`--measure-*\` and \`--focus-ring-*\` have no utility,
   so they stay \`var()\`-only — read them from a class with Tailwind's
   custom-property form instead: \`max-w-(--measure-prose)\`.

   Regenerate with \`jig init\` after the token layer changes; a token missing here
   is a class that renders and matches nothing. */

@theme inline {
${lines.join('\n')}
}
`;
}
