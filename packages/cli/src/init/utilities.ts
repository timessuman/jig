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

export function utilitiesBody(names: string[], version: string): string {
  if (names.length === 0) {
    throw new Error(
      'Refusing to write an empty @theme block: it generates no utilities while ' +
        'looking like it should. No token in this layer matches a Tailwind namespace.',
    );
  }
  const width = Math.max(...names.map((n) => n.length));
  const lines = names.map((n) => `  ${n}:${' '.repeat(width - n.length)} var(${n});`);

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

   Only tokens in a Tailwind namespace are listed. \`--measure-*\`, \`--focus-ring-*\`
   and \`--duration-*\` have none, so they stay \`var()\`-only — read them from a class
   with Tailwind's custom-property form instead: \`max-w-(--measure-prose)\`,
   \`duration-(--duration-fast)\`.

   Regenerate with \`jig init\` after the token layer changes; a token missing here
   is a class that renders and matches nothing. */

@theme inline {
${lines.join('\n')}
}
`;
}
