# 02 · Tokens

**Status:** draft v0.1
**Depends on:** `01-modes.md`
**Canonical format:** CSS custom properties
**Consumed by:** any framework that renders to the web

## Architecture

Tokens resolve as **brand × mode**. Two layers, loaded in order.

```
tokens/
  brand.default.css      ← one per project. Identity. Mode-independent.
  mode.editorial.css     ← density, rhythm, scale, motion
  mode.product.css
  mode.operator.css
```

A surface loads **exactly one brand file and exactly one mode file**.

**Tokens live at `.jig/tokens/`.** That is the only location, in every scope and
every project — `jig install` puts them there, `jig update` refreshes them there,
and nothing relocates them. Import from that path and it stays correct.

```css
@import ".jig/tokens/brand.acme.css";
@import ".jig/tokens/mode.operator.css";
```

Three separate mode files rather than one file with variants. The trade: a surface cannot switch modes at runtime, and shared values are duplicated across three files. In exchange each surface ships only the tokens it uses, the files are independently readable, and there is no cascade to reason about. For a system where mode is a routing decision rather than a user preference, that is the right trade.

## Why CSS custom properties

They are the only token format every web framework consumes natively with no build step.

| Consumer | Usage |
| --- | --- |
| Plain CSS / any framework | `color: var(--color-text-strong)` |
| Tailwind v4 | Wrap in `@theme { }` — generates utilities automatically |
| CSS-in-JS (styled-components, emotion) | `color: var(--color-text-strong)` inside template literals |
| Vue / Svelte / Angular | Identical to plain CSS, scoped or global |
| React inline styles | `style={{ color: 'var(--color-text-strong)' }}` |

**Boundary:** this does not cover React Native or native platforms, which cannot read CSS. If a non-web target enters scope, author in DTCG JSON and generate these files with Style Dictionary or Terrazzo. The naming contract below is DTCG-compatible, so that migration is mechanical. Do not build the pipeline before you need it.

## Predefined option sets

Limited options, chosen once. The point is not the specific values — it is that there are few of them, so a decision is a selection rather than an invention.

**Spacing — six options, 8pt base.** Identical in every mode.

| XS | S | M | L | XL | XXL |
| --- | --- | --- | --- | --- | --- |
| 8 | 16 | 24 | 32 | 48 | 80 |

Modes **select** from these; they never define their own values. `--spacing-card` is `M` in `editorial`, `M` in `product`, `S` in `operator` — same option set, different selection. This is why there are no arbitrary numbers left in the mode files.

**Type — the scale ratio varies by mode**, because scale size should track interface complexity. A large ratio gives dramatic steps that suit content-led pages; a small ratio gives fine gradations that suit dense tools needing many levels in little space.

| Mode | Ratio | | Caption | Body (UI) | Prose | H3 | H2 | H1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `editorial` | 1.250 Major Third | | 14 | 16 | 18 | 24 | 32 | 48 |
| `product` | 1.200 Minor Third | | 14 | 16 | 18 | 20 | 24 | 32 |
| `operator` | 1.125 Major Second | | 12 | 14 | 16 | 16 | 18 | 22 |

`editorial` omits the rung the ratio would put between H2 and H1 (a step near 40); the ratio names the ladder, not every adjacent step — its H2→H1 jump (32→48) is 1.5, not 1.25.

**`--text-body` and `--text-prose` are different roles, not two sizes of the same thing.** Body is UI text — labels, controls, table cells, short strings read in glances. Prose is sustained reading, and never drops below 18px on a page anyone is expected to actually read (`B-75`).

Line heights are unitless and floor at **1.5** for body and prose, easing down as size rises. Raise it further when lines are long, when the typeface is heavy or dark, or when it simply looks large for its nominal size. Between 1.5 and 2 is the comfortable band for prose.

**Measure: 40–80 characters.** Below 40 the eye returns too often; above 80 it loses the line. `--measure-prose` sits mid-range in every mode.

**Weights: two.** Regular (400) and bold (600). See `B-77`.

**Letter spacing** tightens as size grows — most text typefaces are spaced for small sizes and look loose when scaled up. `--tracking-h1` is the most negative; body is 0.

**Typeface.** One sans serif by default: most legible small, neutral across brands, least likely to be the wrong choice. When picking one — prefer a popular face with many weights, a tall x-height and generous default spacing, with OpenType features and the language coverage the product needs. When in doubt, the platform system font is tried, tested and free to load. A second face is permitted for headings only (`B-76`).

**Radius — four options**, by element size: 8px small (buttons, inputs), 16px medium (cards, panels), 32px large (hero media and full-bleed surfaces), and a full/pill radius for pills, badges, avatars and chips (`--radius-full`).

`--radius-control` selects `sm` in all three modes. `--radius-surface` selects `md` in `editorial` and `product`, but `sm` in `operator` — the selection is per-mode, not a fixed derivation. `--radius-lg` and `--radius-full` are brand-scale options; no mode currently selects either.

**Shadow — two options** with stated meanings: `raised` sits above the page, `overlay` floats over it. `A-08` still prefers a stroke; these exist for when depth is the point.

## Colour naming

Two layers, and only one of them is used in component code.

**Primitive** — named by appearance, numbered 0–1000 by contrast. `grey.light.700`, `green.dark.1000`. These exist to be referenced by semantics. **Never use a primitive directly in a component.**

**Semantic** — named by use, in the order `element.tone.emphasis.state`:

| element | tone | emphasis | state |
| --- | --- | --- | --- |
| text | neutral | strong | hover |
| stroke | brand | weak | press |
| icon | error | | focus |
| fill | warning | | disabled |
| background | success | | |

Words that are the default are omitted, which is why `--color-text-strong` needs no tone and `--color-fill` needs neither. Examples: `--color-text-error`, `--color-stroke-strong`, `--color-fill-success`, `--color-stroke-brand-weak`.

The payoff is mode switching: one semantic name maps to a different primitive in light and dark, so component code never mentions a mode.

Resist per-component tokens (`--button-bg`). They multiply fast and rarely earn it.

## Naming contract

Names align to Tailwind v4's theme namespaces. This is free for other frameworks — they are ordinary custom properties — and means the same file can be wrapped in `@theme` to generate utilities without any framework taking a dependency on Tailwind.

| Namespace | Holds | Layer |
| --- | --- | --- |
| `--color-*` | All colour | brand |
| `--font-*` | Font families | brand |
| `--text-*` | Font sizes | mode |
| `--leading-*` | Line heights | mode |
| `--tracking-*` | Letter spacing | mode |
| `--spacing-*` | Spacing values | mode |
| `--radius-*` | Corner radii | brand scale, mode selection |
| `--border-width-*` | Stroke widths | brand options, mode selection |
| `--focus-ring-*` | Focus indicator geometry | brand — an accessibility floor, so not mode-negotiable |
| `--shadow-*` | Elevation | brand |
| `--duration-*`, `--ease-*` | Motion | mode |
| `--size-*` | Control and row heights | mode |
| `--measure-*` | Line length caps | mode |

**Rules**
1. Semantic names only at the point of use. `--color-text-strong`, not `--color-neutral-900`, in component code. Primitives exist to build semantics, not to be consumed directly.
2. No component-scoped tokens. `--button-bg` belongs in the component, referencing `--color-brand`.
3. A value that cannot be expressed as a token is a missing token, not an exception (`H-47`).

## Colour architecture

**Foregrounds are transparent. Backgrounds are solid.**

Foreground colours (text, icons, strokes, fills) are opacities of black in light mode and white in dark. Background colours are three solid elevation levels.

This is not a stylistic choice. A solid foreground looks correct on one background and wrong on the next — a grey tag reads as prominent on white and recedes into a grey panel. Dark mode has three background levels, so a solid fill is wrong on at least two of them. A transparent foreground mixes with whatever is beneath it and keeps a consistent prominence everywhere.

It also removes tokens rather than adding them: hover and press become transparent layers reused across every component and both modes.

**Three elevation levels**, consistent across modes: `base` (page), `raised` (cards, panels), `overlay` (dialogs, dropdowns).

- **Light mode:** shadows carry elevation, plus lighter-on-darker — a white card on an off-white page reads as raised without a shadow at all.
- **Dark mode:** shadows are nearly invisible. **Depth comes from the background colour**, so `--shadow-raised` resolves to `none` and the raised background does the work.

| | Light | Dark |
| --- | --- | --- |
| `text-strong` | black 90% | white 100% |
| `text-weak` | black 60% | white 78% |
| `stroke-strong` | black 45% | white 60% |
| `stroke-weak` | black 10% | white 12% |
| `fill` | black 4% | white 6% |

Brand and each system colour take the same four variations: **100%** text, **80%** stroke-strong, **20%** stroke-weak, **5%** fill.

**Neutral or monochromatic.** The default is neutral (pure black/white opacities), which works with any brand colour. For a monochromatic palette, tint the dark-mode backgrounds with the brand hue and, in light mode, replace the black opacities with a heavily saturated brand hue at low lightness. Change `--brand-h` and `--brand-s`; nothing else moves.

## Contrast contract

**Floor: WCAG 2.1 AA.** Two thresholds, and the boundary between them is a common mistake.

| | Threshold |
| --- | --- |
| Small text — 18px or less | **4.5:1** |
| Large text — 24px+ regular, or 18px+ bold | **3:1** |
| UI elements — input, checkbox and radio borders; meaningful icons | **3:1** |
| Decorative elements that convey no meaning | none |

**Test against `fill`, not against the background.** Text and controls can sit on a `fill` surface (a tag, a badge, a highlighted row), which is the lowest-contrast case. A colour that passes on the page background can fail inside a tag. In dark mode, test against `bg-overlay` — the brightest level, and therefore the worst case for a light-on-dark foreground.

**The brand colour needs 4.5:1** against both `bg-raised` and `fill`, because it is used for link and button text.

**When the brand colour cannot reach 4.5:1** — a yellow or very light brand, or a dark brand on a dark surface:
1. Darken or lighten it slightly, if brand recognition survives.
2. Use `--color-text-strong` for interactive elements instead, and keep the brand colour decorative.
3. Add a border to buttons so they clear 3:1.

### APCA

WCAG 2's algorithm has known failures — it will pass black text on orange and fail white text on the same orange, when the white is plainly more readable, and it works poorly on dark interfaces. APCA (WCAG 3 draft) measures perceptually and scores by size and weight rather than a flat ratio.

Guidance: **for commercial work, comply with WCAG 2.1 AA**, because that is what is legally referenced. Check APCA as well, particularly on dark surfaces. Aim to pass both.

APCA reference values: **90** preferred for body text · **75** minimum body at 18px+ · **60** other text · **45** large text and UI elements · **30** absolute floor for placeholder and disabled text · **15** non-text.

## Dark mode

Not an inversion (`C-21`). Each brand file supplies a dark block under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`, remapping semantics only. Mode files are theme-independent — density does not change with colour scheme.

In dark, elevated surfaces get **lighter**, not shadowed. Border-led elevation survives the switch; shadow-led does not, which is one reason border-led is the unbranded default.

## Consuming

**Plain CSS, any framework**
```css
@import ".jig/tokens/brand.default.css";
@import ".jig/tokens/mode.product.css";

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-stroke-weak);
  border-radius: var(--radius-surface);
  padding: var(--spacing-card);
}
```

**Tailwind v4** — wrap the same files, nothing else changes
```css
@import "tailwindcss";
@theme {
  @import ".jig/tokens/brand.default.css";
  @import ".jig/tokens/mode.product.css";
}
```
Yields `bg-surface`, `rounded-surface`, `p-card`, `text-body` as utilities.

**Multiple modes in one app** — scope by route, not by class. Each surface loads its own mode file at the layout or entry level. Do not attempt to nest two modes in one document (`01-modes.md`, seam rules).
