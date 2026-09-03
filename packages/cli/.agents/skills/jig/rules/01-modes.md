<!-- 01-modes.md — vendored from Jig v0.3.0.
     Licensed Apache-2.0. See .jig/LICENSE and .jig/NOTICE.
     Edit freely: `jig update` will not overwrite a file you have changed. -->

# 01 · Modes

**Status:** draft v0.1
**Depends on:** `00-anti-patterns.md` (universal, applies in every mode)
**Feeds:** `02-tokens.md`

## The two switches

This system has two orthogonal axes. Keep them separate.

| | **Mode** | **Brand** |
| --- | --- | --- |
| Answers | How is this surface used? | Whose product is this? |
| Values | `editorial` · `product` · `operator` | Per-client identity |
| Varies | Between surfaces *within* one project | Between projects, constant within one |
| Controls | Density, rhythm, type scale, motion budget, colour *usage* | Palette, typeface, radius personality, elevation personality |
| Defined in | This file | `03-brand.md` (per project) |

A token is resolved as **brand × mode**. Brand says the accent is `oklch(0.55 0.13 25)`; mode says whether it appears on large surfaces or only on the primary action.

Collapsing these into one switch produces `theme-marketing-dark-compact` and a system nobody uses. Do not do it.

---

## Choosing a mode

1. If the project config declares a mode for this route or surface, use it.
2. If not, infer from the signals below and **state the inference in one line** before building.
3. If the signals conflict, ask. Do not guess — the density decision is expensive to reverse.

| Signal | → mode |
| --- | --- |
| Visitor arrives from search or a link, may never return | `editorial` |
| User has an account and a task | `product` |
| User is doing this job all day, knows the system, uses the keyboard | `operator` |
| Content is primarily prose or media | `editorial` |
| Content is primarily records, rows, filters | `operator` |
| Success is measured in comprehension or trust | `editorial` |
| Success is measured in task completion | `product` |
| Success is measured in throughput or error rate | `operator` |

### The one-sentence distinction

**`editorial` optimises for first use. `operator` optimises for the thousandth. `product` sits between and must serve both.**

When a mode decision is genuinely ambiguous, resolve it with that sentence rather than by taste.

### Mixed projects

Mode is a property of a **surface**, not a project. A single site routinely spans all three: marketing pages (`editorial`), an authenticated app (`product`), an admin area (`operator`).

At a seam between modes:
- Brand stays constant. Same palette, typeface, logo, radius personality.
- Density, type scale and motion switch cleanly at the route boundary.
- Never blend two modes inside one view. A dense table inside a spacious marketing page is a mode error; give the table its own surface or redesign it as editorial content.

---

## M-01 · `editorial`

**For:** marketing sites, blogs, documentation, brochureware, landing pages.
**Reader:** first-time, on mobile data, scanning before committing attention.
**Tiebreaker:** legibility over density. When in doubt, larger and further apart.

| Property | This mode selects |
| --- | --- |
| UI text | `--text-body` |
| Long-form text | `--text-prose` · `--leading-prose` |
| Heading ramp | `--text-h3` → `--text-h2` → `--text-h1` |
| Type ratio | 1.250 Major Third — the largest of the three |
| Measure | `--measure-prose` |
| Section rhythm | `--spacing-section` |
| Card padding | `--spacing-card` |
| Control height | `--size-control` — the tallest of the three |
| Radius | `--radius-control` (sm) · `--radius-surface` (md) |
| Elevation | `--shadow-none`; `--shadow-raised` for sticky nav only |
| Motion | `--duration-base`; entrance animation **once**, first viewport only |
| Colour usage | Neutral-dominant. `--color-brand` for links and primary CTA only. |
| Imagery | Central. Real photography or commissioned illustration. |
| Keyboard | Standard tab order; no shortcuts expected |

Resolved values: `02-tokens.md`.

**Mode-specific rules**
- One hero maximum, at the top. A second full-viewport section is a second hero.
- Every page states its subject above the fold in text, not only in an image.
- Prose blocks are measure-capped even when the container is wide.
- No horizontal scrolling regions on mobile. Reflow instead.
- Total JS budget for a content page: **0 KB** unless a specific feature requires it. Interactivity is opt-in per component and must be justified in a comment.

---

## M-02 · `product`

**For:** authenticated application UI, customer-facing dashboards, settings, onboarding.
**Reader:** returning, task-focused, moderate familiarity, mixed device.
**Tiebreaker:** predictability over novelty. A boring pattern the user already knows beats a better one they must learn.

| Property | This mode selects |
| --- | --- |
| UI text | `--text-body` |
| Long-form text | `--text-prose` · `--leading-prose` |
| Heading ramp | `--text-h3` → `--text-h2` → `--text-h1` |
| Type ratio | 1.200 Minor Third — the mid value of the three |
| Measure | `--measure-prose` |
| Section rhythm | `--spacing-section` |
| Card padding | `--spacing-card` |
| Control height | `--size-control` — the mid value of the three |
| Table row height | `--size-row` |
| Radius | `--radius-control` (sm) · `--radius-surface` (md) |
| Elevation | `--shadow-none`; `--shadow-raised`/`--shadow-overlay` for overlays only (modal, popover, dropdown) |
| Motion | `--duration-base`; state change only, no entrance animation |
| Colour usage | `--color-brand` for primary action. Full semantic set. Status as subtle fill plus text. |
| Imagery | Sparse. Illustration permitted in empty states only. |
| Keyboard | Shortcuts for frequent actions; documented in-app |

Resolved values: `02-tokens.md`.

**Mode-specific rules**
- One primary action per view. Everything else is secondary or tertiary.
- Destructive actions are never adjacent to their most common neighbour, and always confirm.
- Every list view handles four states explicitly: loading, empty-never, empty-filtered, error.
- Forms save on explicit action, not on blur, unless the surface is a settings panel — and then say so.
- Navigation position is fixed across the app. Never move the primary nav between sections.

---

## M-03 · `operator`

**For:** internal tools, admin areas, back-office, data entry, monitoring.
**Reader:** expert, in the tool for hours, keyboard-driven, high repetition.
**Tiebreaker:** speed of repeated use over clarity of first use. Discoverability is worth sacrificing for throughput here, and nowhere else.

| Property | This mode selects |
| --- | --- |
| UI text | `--text-body` |
| Long-form text | `--text-prose` · `--leading-prose` |
| Heading ramp | `--text-h3` → `--text-h2` → `--text-h1` |
| Type ratio | 1.125 Major Second — the smallest of the three |
| Measure | `--measure-prose` (prose only; data columns are not prose) |
| Section rhythm | `--spacing-section` |
| Card padding | `--spacing-card` |
| Control height | `--size-control` — the shortest of the three (`--size-control-sm` in compact rows) |
| Table row height | `--size-row` (`--size-row-compact` in compact rows) |
| Radius | `--radius-control` (sm) · `--radius-surface` (sm) — both sm in this mode |
| Elevation | `--shadow-none`; overlays only, minimal |
| Motion | `--duration-base`; **no entrance animation of any kind** |
| Colour usage | Neutral-dominant. Colour is *exclusively* semantic. No decorative accent. |
| Imagery | None. Icons only. |
| Keyboard | Full keyboard operation mandatory. Shortcut reference required. |
| Numerals | Tabular figures mandatory on all numeric columns |

Resolved values: `02-tokens.md`.

**Mode-specific rules**
- Density is the feature. More rows visible beats more comfortable rows.
- Every table supports: sort, filter, column visibility, and a stable row identity across refreshes.
- Bulk actions wherever a single action exists on more than ~20 rows.
- Destructive actions require typed confirmation, not a checkbox.
- Timestamps are absolute and precise, with relative time secondary. "3 hours ago" is unacceptable alone in an audit context.
- Never hide information behind hover in a tool used all day. Truncation must be resolvable by click or expand, not hover.
- Latency budget: any action a user repeats hourly responds in under 200ms or shows progress.

---

## Comparison

Useful when a decision straddles two modes.

| | `editorial` | `product` | `operator` |
| --- | --- | --- | --- |
| Type ratio | 1.250 | 1.200 | 1.125 |
| Body | `--text-body` | same as editorial | smaller |
| Control height | tallest | mid | shortest |
| Section rhythm | `--spacing-xxl` | `--spacing-xl` | `--spacing-m` |
| Card padding | `--spacing-m` | `--spacing-m` | `--spacing-s` |
| Motion | slowest | mid | fastest |
| Entrance animation | once, first viewport | none | none |
| Decorative colour | accent only | primary action | none |
| Imagery | central | empty states | none |
| Optimises for | first use | both | thousandth use |

---

## What mode does *not* control

Attempting to vary these by mode is a category error:

- **Accessibility floors.** Contrast, focus indication, target size, semantic markup. Identical in all three. `operator` being dense does not license a 24px tap target or a 3:1 body contrast.
- **Brand identity.** Palette, typeface, logo, voice.
- **State completeness.** Every mode renders loading, empty, error and disabled.
- **The anti-pattern file.** All 87 rules in it apply everywhere.

---

## `03-brand.md` — stub

Per project, one file supplying:

- **Palette** — neutral ramp (12 steps, warm/cool/true declared), one accent ramp, semantic set (danger, warning, success, info) tuned to the accent's temperature.
- **Typeface** — display and text families, and whether they differ. Numeric font-feature settings.
- **Radius personality** — the brand-scale radius options (`sm`, `md`, `lg`, `full`) that each mode selects from, not a fixed derivation. This carries more brand character than colour does.
- **Elevation personality** — border-led or shadow-led. Pick one; do not mix within a project.
- **Voice** — sentence case or title case, contraction policy, error-message tone.

Default when no brand is supplied: warm neutral ramp anchored on `#fafaf7`, no accent, 8px base radius (`--radius-sm`), border-led elevation. Greyscale output plus a stated question beats an invented purple (`A-01`).

---

## Notes for the author (not for the agent)

**Decided, not derived.** These numbers are internally consistent and defensible, but several are judgement calls that should be tuned once you have run real work through them: the operator row height, the three section-rhythm values, and the motion durations. Change them in this file, never at the call site.

**Where your taste is recorded here:**
- The zero-JS default in `editorial` — a stronger position than most systems take, and consistent with your writing on JS-dependent forms.
- Absolute-first timestamps in `operator` — that is the procurement instinct: the record is evidence before it is a convenience.
- Typed confirmation for destructive operator actions, and no hover-hidden information in all-day tools.
- Border-led elevation as the unbranded default.

**Open question worth resolving before tokens.** `product` is currently defined as the midpoint of the other two, which is how it earns its place, but it is also the mode that most often needs to lean. A customer dashboard leans editorial; a billing admin screen leans operator. Consider whether `product` needs a documented `dense` variant, or whether such surfaces should simply be declared `operator`. My inclination is the latter — three modes you apply confidently beat five you deliberate over — but it is your call, and it affects how many token sets `02` has to emit.
