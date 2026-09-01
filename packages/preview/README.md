# Preview

A rendering harness for the token set. Open `index.html` in a browser — no build,
no dependencies, no framework.

```bash
open packages/preview/index.html      # or: python3 -m http.server
```

Framework-agnostic is the system's central claim, so the preview is plain HTML
and CSS. A React harness would prove nothing about that and would add a
dependency tree to a repo that has one runtime dependency.

## What it is for

Everything else in this repo verifies the system by arithmetic and grep. This
verifies it by looking at it. Two things it catches that nothing else can:

1. **Missing tokens.** Every specimen is built from tokens only. If a component
   cannot be built without writing a raw value, the token set has a gap. That is
   how the missing border-width and focus-ring tokens were found.
2. **Values that pass their check and still look wrong.** Contrast arithmetic
   says a colour is legible; it does not say the interface reads well.

## Not shipped

`packages/preview` is not in the CLI package's `files` list and is not published.
It is a development tool for people working on Jig, not something a consumer
installs.

## Precedence

`rules/03-patterns.md` is the specification. The component CSS here is an
**illustration** of it, not a second definition. Where the two disagree, the
rule is right and the preview is a bug. This matters because a rendered thing
is more persuasive than a written one, and it would be easy to start trusting
the wrong source.

The preview's own chrome — the switcher, the swatch grids, the section rules —
is scaffolding and may use raw values. Everything below the "Specimens" line in
`preview.css` uses tokens only.

## Coverage is enforced

`scripts/check-tokens.mjs` rule 6 fails the build if a token is defined and not
referenced here. A token nobody has looked at is a value nobody has checked, and
without that rule the harness would rot silently: unlike every other guard in
this repo, it has no failure mode of its own.

The search is literal, so token names are written out in full in the preview
sources rather than interpolated. `--color-text-${name}` would defeat it.

## Icons

Lucide, from a CDN, ISC licensed. Real icons rather than placeholder shapes,
because they inherit `currentColor` and so demonstrate what `--color-icon`
actually does. If the CDN is unreachable the icons are omitted and every label
beside them still reads.

## Reading it

The mode and theme switchers load exactly one brand file and one mode file at a
time, which is what the system requires of any real surface. Switch between
`editorial`, `product` and `operator` to see the same components at three
densities, and between light and dark to check both themes.
