# 00 · Anti-Patterns

**Status:** draft v0.1
**Scope:** universal. Every rule here is wrong in *all* modes (`editorial`, `product`, `operator`). Anything that depends on mode belongs in that mode's profile, not here.
**Floor:** WCAG 2.1 level AA. Not an aspiration — the minimum this system is built on.
**Numbering:** rule numbers are stable identifiers, not an ordering. A new rule takes the next free number and sits in its topic section. Numbers are never reused or renumbered, so a citation stays valid.
**Framework:** agnostic. Examples are stated in CSS properties and token names. Where a utility-class framework is in use, translate — the rule is about the resulting style, not the syntax.

## How to use this file

You are generating or reviewing UI. Treat every rule below as a hard constraint unless the task explicitly overrides it.

- Rules are numbered (`A-14`). Cite the number when you follow or deliberately break one.
- Each rule has a **correction**, not just a prohibition. Apply the correction; do not substitute your own default.
- If a rule conflicts with an explicit instruction in the task, the task wins — but say so in one line rather than silently deviating.
- Before finishing, run the checklist at the end.

---

## A. Generic-AI aesthetic

These are the strongest defaults in a model's training data and the fastest way to make work look machine-made. They resurface every session; assume they will.

### A-01 Purple and violet as the unspecified default
❌ A violet or indigo fill, or a violet→pink gradient, chosen because no colour was specified
✅ Use `--color-brand` from the brand file. The unbranded default resolves it to near-black, which ships a coherent monochrome UI and makes the missing decision visible. Then ask.
**Being asked to propose a colour does not discharge this.** A proposal is a question with a suggested answer, not a decision — so suggest one freely when asked, but ship the unbranded default alongside it and leave the brand file unchanged until a human confirms. Two agents given the same brief split on exactly this point, one deferring and one treating its own proposal as the answer, and both cited the same conflict-resolution clause to get there. The task can ask you for a recommendation; it cannot make you the one who decided.

### A-02 Gradient text on headings
❌ `background-clip: text` with a gradient fill and transparent text colour
✅ Solid `--color-text-strong`. Gradient text has unmeasurable contrast and reads as template output.

### A-03 Decorative gradient blobs and orbs
❌ Absolutely-positioned blurred radial shapes behind a hero
✅ Flat background, or a single subtle surface change. Backgrounds do not need decoration to justify existing.

### A-04 Trend styles that fight legibility
❌ Glassmorphism (translucent fill + `backdrop-filter: blur()`), neumorphism (soft inset/outset shadows on a matching background), and their successors
✅ Opaque `--color-bg-raised` with a `--color-stroke-weak` edge. Use translucency only over media, and only when legibility is verified against the worst frame.
Both styles make sufficient contrast and clear hierarchy structurally difficult — neumorphism in particular defines every element with shadow alone, which fails at 3:1 almost by construction. Trend styles also age badly: the more of them a product carries, the more precisely it is dated. Minimal styling that foregrounds content lasts longer.
Experiment freely — but not where it costs legibility or excludes people.

### A-58 Decorative styling that implies meaning
❌ List items in assorted colours chosen for variety; a decorative icon beside a heading that looks pressable; a heading coloured and underlined though it is not a link
✅ Style carries information or it goes. People assume differences mean something — arbitrary colour invites them to hunt for a pattern that does not exist, and an icon that looks interactive will be clicked.
Decoration is allowed. Decoration that mimics a functional signal is not.

### A-59 Repeated information
❌ Every item in a list restating the shared context: "UI Course – Chapter 1", "UI Course – Chapter 2"
✅ Lift the shared part into a heading above the list and let each item carry only what differs. Repetition costs space, adds reading, and buries the part the user is actually scanning for.

### A-60 Icons all competing at equal weight
❌ A row of large, high-contrast icons beside secondary text
✅ Icons supporting text are subordinate to it — smaller, lower contrast, or both. An icon at the same visual weight as the content it decorates competes with it for attention it does not deserve.

### A-67 A container around every group
❌ Borders, cards and background panels wrapping each cluster on the page
✅ A container is the **strongest** grouping cue and the heaviest. Reach for it last.
Four tools group elements, in ascending strength: **continuity** (aligned in a line), **similarity** (same size, shape, colour), **proximity** (closer together than to anything else), **common region** (a shared container). Use the weakest one that works.
Where several already apply — a table's rows are aligned, alike, and close — the container adds clutter and no information. Remove it and check whether the grouping still reads. It usually does.

### A-05 Emoji as interface iconography
❌ `<h3>🚀 Fast deploys</h3>`, emoji bullets in feature lists
✅ A real icon set, or no icon. Emoji render inconsistently across platforms, carry unpredictable screen-reader announcements, and are almost never in the brand.

### A-06 The three-column feature grid reflex
❌ Icon-in-rounded-square + heading + two lines, three across, for any set of three things
✅ Let the content pick the layout. Three items of unequal weight are a list, not a grid.

### A-07 Oversized radius everywhere
❌ One radius applied to cards, buttons, inputs and badges alike, regardless of element size
✅ `--radius-control` for controls, `--radius-surface` for containers. `--radius-control` selects `sm` in every mode; `--radius-surface` selects `md` in `editorial` and `product`, `sm` in `operator` — the selection is per-mode, not a fixed derivation. Small elements take small radii.
In `operator`, `--radius-surface` also selects `sm`, so cards, buttons and inputs converge on one 8px radius. That is not this rule recurring: it is a per-mode selection made deliberately for density. The distinction is whether the value was chosen or defaulted to.

### A-08 Shadow as the only depth cue
❌ A drop shadow on every card, or several shadow sizes with no rule governing which means what
✅ `--shadow-surface` is `none` in all three modes. Depth comes from `--color-stroke-weak` or a surface-colour step. `--shadow-raised` exists for exactly two cases: overlays — dialogs, popovers, dropdowns — and sticky navigation in `editorial`, which must read as above the content scrolling beneath it.

### A-09 Marketing voice in an application
❌ "Supercharge your workflow" on an internal dashboard
✅ Copy matches the context. Operator tools name the object and the action.

### A-10 Placeholder content shipped
❌ Lorem ipsum, "Acme Inc", `https://example.com`, stock avatars left in
✅ Real content, or clearly marked `TODO:` that fails a build check. Placeholder text that survives to review costs a reviewer more than it saved you.

---

## B. Typography

### B-11 Unbounded line length
❌ Paragraphs spanning the full width of a wide viewport
✅ Cap at `--measure-prose` (68ch editorial, 60ch product, 72ch operator). Applies to any run of prose in any mode.
**And do not let a layout choice push it far under.** The readable band is 40–80 characters (`02-tokens.md`); the cap is the only half stated here, so a column can be halved indefinitely and still satisfy this rule while reading worse at every step. A narrow viewport that cannot reach 40 is a constraint and fine. Splitting a capped column into two side-by-side panels, and rendering prose at 41 characters in a mode whose own measure selects 68, is a choice — and it is choosing density over legibility, which is the trade `M-01` says editorial does not make.

### B-12 Centred or justified body text
❌ A centred paragraph of four lines. Justified text of any length.
✅ Start-align anything longer than a short heading or label.
**Centred** text moves the start of every line, so the eye hunts for it. Acceptable for a heading or a couple of lines; never for a paragraph.
**Justified** text is worse and has no acceptable case here. Stretching word spacing to force a straight right edge creates uneven gaps and vertical "rivers" of white space running down the block — actively harmful for dyslexic readers, and the reason books that justify are harder to read than they look.

### B-13 One line-height for everything
❌ One line-height value applied to both a 48px heading and 16px body
✅ `--leading-body` for UI text, `--leading-prose` for sustained reading, and `--leading-h3` / `--leading-h2` / `--leading-h1` as the heading tier rises. Line height decreases as size increases, and the heading values are per-mode — see the table in `02-tokens.md`.

### B-14 Thin weights for body text
❌ Weight 300 or lighter for paragraphs
✅ `--font-weight-regular` (400) minimum. Thin weights fail on low-density screens and in bright light — both of which describe most of your users' actual conditions.

### B-15 Ad-hoc type sizes
❌ A one-off `font-size` because something looked slightly wrong
✅ Use a `--text-*` step. If the scale genuinely lacks one, add it to the mode file rather than bypassing the scale at the call site.

### B-16 All-caps for anything long
❌ All-caps sentences, all-caps buttons with three or more words
✅ Reserve caps for short labels, and add letter-spacing when you do. Caps destroy word-shape recognition.

### B-17 Skipping heading levels for visual reasons
❌ `<h4>` because `<h2>` looked too big
✅ Correct level, styled to the size you want. Heading order is document structure, not typography.

### B-75 Long-form text below 18px
❌ 14px or 16px body text for an article, description or any sustained reading
✅ `--text-prose` (18px) with `--leading-prose` (1.6) for long-form text. `--text-body` (16px) is for **UI text** — labels, controls, table cells, short strings — which is read in glances rather than sustained passages.
People read at roughly arm's length on every device. Small type is a designer's preference, not a reader's. When the text is a paragraph someone must actually get through, size up.

### B-76 More than two typefaces
❌ A serif for headings, a script for the description, a sans for the UI
✅ One sans serif for everything is the safe default: most legible at small sizes, neutral enough to suit any brand, and it keeps the content rather than the lettering as the focus.
A **second** typeface is permitted for headings only, where the brand needs a mood the sans cannot carry. Never a third. Never a script or display face below heading size — they are drawn for large sizes and become unreadable small.

### B-77 More than two font weights
❌ Thin, light, regular, medium, semibold and bold across one interface
✅ Two: `--font-weight-regular` (400) and `--font-weight-bold` (600). Bold for headings and emphasis, regular for everything else.
Extra weights read as noise, are impossible to apply consistently, and add a decision to every text element. Reserve very thin or very heavy weights for large display text, where they are legible.

### B-78 Text placed directly on a photo
❌ White text over an image, legible on the mockup's photo and not on the next one
✅ Contrast still has to be met — 4.5:1 for text 18px and under, 3:1 for larger. A photo cannot guarantee it, because the photo changes.
Four workable treatments:
1. **Linear gradient overlay** — dark, ~90% opacity at the text edge fading to 0% partway across. Preserves most of the image.
2. **Semi-transparent overlay** — a flat dark layer at ~50% over the whole image.
3. **Blurred semi-transparent overlay** — as above with a blur behind the text only.
4. **Solid background behind the text** — the caption approach; most reliable, least subtle.
A text shadow may reinforce any of these but never substitutes for one. Verify against the worst image the slot will ever hold, not the one in the mockup.

### B-105 Monospace sized by a guessed ratio
❌ Inline `code` set to `0.9em` — or any fixed ratio — to stop it looking bigger than the text around it
✅ Measure both faces before correcting either. If they share an x-height, the ratio is the mismatch. Let code inherit its host's size.
The habit comes from pairings where it is true: a mono face drawn separately from the text face often does sit larger at the same `font-size`. In a superfamily it does not. IBM Plex Sans and IBM Plex Mono are both x-height 51.6 and cap-height 69.8 per 1000 units — identical — and mono is *narrower*, not larger. A `0.9em` there sets code at x-height 46.8 inside text at 52, creating the mismatch it was meant to remove.
A ratio is also the wrong shape of answer. Inline `code` appears inside body text, headings, table cells and captions; one multiplier has to be right for all of them, and a fixed token is worse still — it collapses code in a heading to caption size. Inheriting is correct in every host, which is why this rule has no token.
The measurement is one line in a browser: render `x` in both faces at the same size and compare the rendered heights, or read `sxHeight` from each font's `OS/2` table. Do it once per project when the brand file is written, not per component.

### B-106 A word stranded on its own line
❌ A heading that wraps to leave one word alone on the last line, or a paragraph ending on a single short word
✅ `text-wrap: balance` on headings and short blocks, `text-wrap: pretty` on body copy. One declaration in the type layer, not a fix applied per heading.
The eye reads a block's shape before it reads the words. A heading whose last line holds one word reads as a mistake to someone who could not name what is wrong with it — the silhouette says unfinished, and that impression lands before the sentence does.
This is invisible in the source. The same heading breaks cleanly at 1280px and badly at 900px: where a line breaks depends on the box, the face and the string together, and none of the three is decidable from the others. It is judged on the rendered page at more than one width, which is why it carries `pass: screen`.
A manual break is not the fix. `<br>` placed by eye is correct at exactly one viewport width and wrong at the next, and it survives into every layout the component is later used in.
Ragged-right is not the failure — that is correct, and `B-12` requires it. The failure is a *stranded* word, not an uneven edge. Do not chase every short last line; chase the one that is alone.

---

## C. Colour and contrast

### C-66 Depth built from shadow in dark mode
❌ The same shadow tokens carried into dark mode to lift cards off the page
✅ In dark mode, elevation comes from the **background colour** — `bg-base` → `bg-raised` → `bg-overlay`, each lighter than the last. Shadows are close to invisible on a dark surface. `--shadow-raised` resolves to `none` in dark for exactly this reason.
Also: shadow colour derives from the text colour, never pure black, so it sits inside the palette rather than on top of it.

### C-18 Pure black on pure white
❌ `#000` text on `#fff`
✅ Near-black on off-white. Full-contrast black/white causes halation and reads as unconsidered. This is a house preference and it is deliberate.

### C-19 Grey text below contrast floor
❌ A mid-grey (ramp step `-500` or lighter) used for secondary text, placeholders or timestamps
✅ `--color-text-weak` for secondary text, at any size — it clears 4.5:1 on every surface in the system, which is why there is no lighter grey to reach for. Those are the only two foreground greys, deliberately: a value that passes only at large sizes is the thing this rule forbids. If `--color-text-weak` looks too heavy, the answer is more space or a smaller size, not a paler grey. See the contrast contract in `02-tokens.md`: `-500` and lighter are never text on a light background. Check placeholders and disabled states specifically; they are the usual failures.

### C-20 Colour as the sole signal
❌ Red border alone to indicate an invalid field
✅ Colour plus text plus (where useful) an icon. Applies to status badges, chart series, diff views, and validation.

### C-21 Dark mode by inversion
❌ Flipping to `#000` background and keeping the same shadows and borders
✅ Dark mode is its own ramp: elevated surfaces get *lighter*, shadows lose most of their meaning, and saturated colours need desaturating. If dark mode is out of scope, say so rather than shipping a broken one.

### C-22 Semantic colours invented inline
❌ Two different reds in two places, both meaning "error"
✅ One token per meaning — `--color-text-error`, `--color-fill-error`, `--color-stroke-error-strong` — referenced everywhere.

**Every ratio in this section is WCAG 2.1, and that is deliberate — but it is
not the whole picture.** WCAG 2.1 AA is what these rules enforce and what
`check` fails a build on, because it is what is legally referenced. APCA (the
WCAG 3 draft) measures perceptually and scores by size and weight rather than a
flat ratio; **`02-tokens.md` carries its threshold table**, and it is worth
checking as well, particularly on dark surfaces where WCAG 2's algorithm is
weakest.

Two places the difference bites:

- **WCAG 2.1 exempts disabled controls entirely**, so nothing in this section
  constrains how faint a disabled label may be. APCA does — Lc 30 is its
  absolute minimum for disabled button text — and it is the only standard that
  says anything at all here. `--opacity-disabled` is held to it.
- The two do not agree on what counts as large text. APCA's thresholds are its
  own and do not line up with `C-17`. Each is right inside its own frame; do not
  mix a score from one with a size rule from the other.

Aim to pass both. Where only one of them has an opinion, that one decides.

### C-49 Link treatment
The default for a link **inside running text** is colour **and** underline. Colour-blind users cannot separate a coloured link from surrounding prose; the underline is what makes it a link for them.

Two legitimate departures, and they are not the same:

| Case | Treatment | Why |
| --- | --- | --- |
| Body text link | Colour + underline | Default. Never drop both. |
| Already-obviously-interactive component — nav item, tab, card, button-styled link | Neither required | Position, container and grouping already signal it. Adding link styling clutters without informing. |
| Secondary link that colour + underline would over-weight | **Underline, no colour** | Keeps the affordance while restoring hierarchy — a supporting link should not compete with the primary action beside it. |

❌ Dropping the underline but keeping the colour, in body text. That is the one combination that fails colour-blind users while looking fine to everyone else.
✅ Keep the underline. Colour is the part you may drop — an underlined link without colour still reads as a link to everyone; a coloured link without an underline reads as a link only to people who can see the colour.

### C-50 Coloured heading text
❌ A heading tinted with the accent colour for emphasis
✅ Headings use `--color-text-strong`. Coloured text reads as interactive, so a coloured heading invites a click that does nothing. Emphasise with size, weight and space — the tools that already carry hierarchy.

### C-68 Non-interactive elements styled like interactive ones
❌ A "Verified" badge with the brand fill and the shape of the primary button; decorative icons carrying the same border and colour as a secondary button
✅ Things that look alike are expected to behave alike. If an element does nothing when clicked, it must not carry the visual signature of something that does — brand fill, button shape, or control border.
Differentiate deliberately: change the shape (a badge, pill, chip or avatar takes `--radius-full`, more rounded than a button's `--radius-control`), the tone (`success` for a verified state rather than `brand`), and the emphasis (a `fill` background rather than a solid one, so the real primary action stays the most prominent thing on screen).
The converse also holds: two elements that do the same job should look the same.

---

## D. Spacing and layout

### D-23 Spacing off the scale
❌ An arbitrary margin or gap (13px, 7px) written at the call site
✅ Every spacing value comes from a `--spacing-*` token. The ladder is built on 4px, the value of its smallest rung `--spacing-2xs`; there is no separate base token, and nothing should reference one. An arbitrary value signals a missing token, not an exception.

### D-24 Symmetric spacing around headings
❌ Equal margin above and below a section heading
✅ A heading belongs to the content beneath it. Space above must exceed space below, usually by 2–3×. This one rule fixes more "it looks off and I can't say why" than any other in this file.

### D-69 Spacing that does not grow outward
❌ The same gap between a card's heading and its body, between cards, and between page sections
✅ An interface is rectangles inside rectangles. Spacing starts small at the innermost level and **increases as you move outward**:

| Level | Option |
| --- | --- |
| Text inside a component | XS (8) |
| Component padding, content within a section | M (24) |
| Between components, grid gutters | L (32) |
| Between page sections | XXL (80) |

`--spacing-group` → `--spacing-card` → `--grid-gutter` → `--spacing-section` already encode this per mode. When in doubt between two steps, take the larger one — tight spacing hides grouping and hierarchy, and generous spacing is the cheapest improvement available to any interface.

### D-96 Icon and text out of balance
❌ A large, heavy icon beside small, light label text — the icon shouts and the pair reads as two things
✅ Match the icon's weight and size to the text it accompanies. Where the icon set will not match, lower its **contrast** instead: `--color-stroke-strong` for the icon against `--color-text-weak` for the label. The pair should read as one unit.

### D-70 Broken left edge
❌ An icon sitting to the left of a heading while the body text below starts further left, so the text block has two left edges
✅ Keep one straight left edge down a block of related text. The eye returns to that edge on every line and every jump; breaking it costs a small amount of work on each one. Where an icon sits beside text, align the *text* edges and let the icon hang outside, or put the icon above.

### D-71 Multiple alignments in one component
❌ A centred name, a left-aligned quote, a right-aligned photo and centred stars in a single testimonial
✅ One alignment per component, start-aligned by default. Every additional alignment makes the eye zig-zag. Centring is acceptable for a short isolated block — a few lines of text and one action — but then centre *everything* in it, and make the action full-width so both hands can reach it.

### D-72 Mixed-size text centred vertically
❌ `$10` and `/month` on one line, vertically centred, so the small text floats
✅ Align text of different sizes to the **baseline**, not the vertical centre. The shared baseline connects them into one reading unit; vertical centring leaves the smaller item drifting in its own space.

### D-25 No proximity hierarchy
❌ Identical gaps between items within a group and between groups
✅ Related things sit closer together than unrelated things. If everything is evenly spaced, nothing is grouped.

### D-26 One padding value for all containers
❌ The same padding value on a badge, a card and a page section
✅ `--spacing-inline` for inline elements, `--spacing-card` for containers, `--spacing-section` for page sections. Padding scales with the container.

### D-27 Optical alignment ignored
❌ Icon and text label boxes aligned mathematically but reading as misaligned
✅ Align to what the eye sees. Icons frequently need a 1–2px nudge; circular shapes need slightly more size than square ones to look equal.

---

### D-111 A page that never adapts to the viewport
❌ Cards in a row, a nav of links in a row, or a fixed page width — and nothing anywhere in the project that changes them when the screen is narrow
✅ Compose for the phone first, then add columns as width allows: a single column that becomes a grid, a nav that becomes a different control, not a smaller copy of the desktop. Use a width breakpoint, a container query, or an intrinsic grid (`repeat(auto-fit, minmax(…))`) — any of them, as long as something responds.
The phone is not the edge case. It is the most common screen a page is read on, and a layout composed for a wide screen and left alone arrives there as a horizontal scroll, a nav whose last links are off the edge, and three cards crushed to a third of 375px each.
This is decided for the whole project, not per file, because the grid and the query that collapses it routinely live in different stylesheets. It only reports what is laid out side by side: a single column of text with a `max-width` works on a phone with no breakpoint at all, and is not a finding.
Two things do **not** count as adapting, and both are traps. A `prefers-reduced-motion` query is about the user, not the width — and `L-04` asks every page for one, so counting it would let a fixed-width page pass by following the self-check. And shrinking is not adapting: the same three columns at a smaller size are still three columns. That second failure is `critique`'s to judge on a render; this rule catches only the page that never responds at all.

### D-112 A full-height section sized with `100vh`
❌ `min-height: 100vh` on a hero, a sign-in screen or an app shell
✅ `min-height: 100svh`. Use `dvh` only for an element that must follow the browser bars as they show and hide. If older browsers matter, keep `100vh` as the line **before** it, as a fallback.
On a phone, `100vh` is the height with the browser's bars hidden. While they are showing — which is when the page first loads — the bottom of a "full-height" section is under the toolbar, and the call to action placed at its foot is exactly what cannot be seen.
`svh` is the default because it does not change: `dvh` resizes as the bars move, which makes the content jump while the reader scrolls.

### D-114 A pinned bar under the notch or the home indicator
❌ `position: fixed; bottom: 0` on a tab bar, on a page whose viewport meta tag sets `viewport-fit=cover`
✅ Pad the pinned edge with its inset — `padding-bottom: env(safe-area-inset-bottom)` for a bottom bar, and the matching inset for any other edge it touches.
`viewport-fit=cover` extends the page under the notch and the gesture bar. That is what makes an edge-to-edge design possible, and it also means a bar at `bottom: 0` has its labels sitting beneath the home indicator, where a swipe meant for the tab closes the app instead.
Without `viewport-fit=cover`, the browser keeps the page inside the safe area on its own, and there is nothing to do.

### D-115 The page scrolls sideways on a phone
❌ At phone width the whole page is wider than the screen — a data table, a long URL, an image, a `width: 100vw` element or a fixed-width block pushes it out, and the reader can drag the page left and right
✅ At every width, nothing makes the page wider than the screen. Content that is genuinely wider — a data table, a code block — scrolls inside its own container with a visible edge (`E-62`), and the page itself never does. `editorial` goes further and allows no scrolling regions on mobile at all (`M-01`).
Judge it on a render, not in the source: at 360px, `document.documentElement.scrollWidth` must not be greater than `document.documentElement.clientWidth`. The usual causes are each one line to fix — `overflow-wrap: anywhere` on text the author does not control, `max-width: 100%` on media, `width: 100%` instead of `100vw` (which includes the scrollbar), and a wrapper with `overflow-x: auto` around anything tabular.
A page that scrolls sideways is not merely untidy. The reader's vertical swipes drift, the page slides half off the screen, and every line of text needs re-centring before it can be read.

## E. States and interaction

Agents render the happy path. This section exists because that is the single most common gap in generated UI.

### E-28 Missing states
❌ A component with only a default appearance
✅ Every interactive element defines: `hover`, `focus-visible`, `active`, `disabled`. Every data view defines: loading, empty, error, and partial/truncated.

### E-29 Focus removed without replacement
❌ `outline: none` with nothing in its place
✅ A `:focus-visible` rule with a visible indicator built on `--color-focus`, at `--focus-ring-width` with `--focus-ring-offset`. Never remove the outline without replacing it. This locks out every keyboard user, and it is the most common accessibility failure in generated code.

### E-30 Empty states omitted
❌ A table that renders an empty `<tbody>` when there is no data
✅ Empty state says what would be here, why it isn't, and the one action that changes it. Distinguish "no data yet" from "no results for this filter" — they need different copy and different actions.

### E-31 Hover-only affordances
❌ Actions that appear only on `:hover`
✅ Visible on touch, or reachable via a persistent control. Half your traffic has no hover.

### E-32 Disabled buttons
❌ A greyed-out submit button with no indication of what's missing
✅ **Prefer not to disable at all.** Three better options, in order: enable it and validate on submit; remove the action and say why it is unavailable; or keep it at full contrast with a lock icon and explain how to unlock it.
A disabled button gives no feedback on press, usually fails contrast, and is skipped by keyboard focus — so the user cannot reach the element to discover why it is dead.
Where disabling is genuinely right, put a message beside it or a tooltip on it explaining what is needed, and **keep it keyboard-focusable** so assistive technology can reach that explanation. See `P-02`.

### E-33 `div` with a click handler
❌ A `div` or `span` carrying a click handler
✅ `<button type="button">` for actions, `<a href>` for navigation. If it performs an action it is a button; if it navigates it is an anchor. Keyboard operability and screen-reader semantics both come free with the correct element.

### E-34 Icon-only controls without names
❌ `<button><TrashIcon /></button>`
✅ `aria-label`, or visually-hidden text — and see `E-51`, which is a different problem. Verify the target is at least `--size-touch-target` (48px, unchanged in every mode) including padding.

### E-35 Dynamic results with no announcement
❌ A filtered count that updates silently
✅ `aria-live="polite"` on result counts and validation summaries.

### E-51 Icon without a visible label
❌ A toolbar of icon-only buttons whose meaning depends on recognising the glyph
✅ A visible text label beside the icon, or the icon plus label on the primary path.
This is **not** the same problem as `E-34`. An `aria-label` serves a screen reader and does nothing for a sighted user with low computer literacy, or anyone meeting an unfamiliar glyph. Both are required.
Icon-only is acceptable for a small set of near-universal glyphs (close, search, menu) and in `operator`, where repetition builds recognition — and even there, on first-run surfaces the label stays.

### E-52 Unconventional controls
❌ A bespoke form field, checkbox or select that looks and behaves unlike every other one the user has met
✅ Conventional shapes: inputs are rectangles with the label above, checkboxes are squares with a tick, radios are circles, links are underlined.
People arrive with a mental model built from every other product they use (Jakob's law). Matching it is free comprehension; departing from it charges the user to learn something that gains them nothing. Innovate on the product's actual purpose, not on its form fields.

### E-61 Important navigation hidden when it fits
❌ A hamburger menu on a viewport with room for three visible links
✅ Show what fits. People do not use what they cannot see, and every tap behind a menu is a tap some users will not make. Collapse only under genuine space pressure. When the space pressure is real, `P-14` is what to build instead — a prohibition alone leaves you to invent the replacement.

### E-62 Off-screen content with no affordance
❌ A horizontally scrolling row that ends flush at the viewport edge
✅ Expose the edge of the next item, or show an explicit control. If the user cannot tell there is more, there is not more.

### E-63 Minimal but unreadable
❌ Unlabelled icon navigation, a selected state signalled by a barely-different tint, primary actions hidden in an overflow menu, low-contrast icons
✅ Minimal is not the same as simple. A sparse interface that omits labels, states and actions is harder to use than a slightly busier one that names them.
The test is not how little is on screen. It is whether someone can tell what things are, which one is selected, and what they can do next. Remove decoration freely; never remove the answers to those three questions.

### E-64 Brand colour colliding with a system meaning
❌ A red brand colour used for links and primary buttons, on an interface that also uses red for errors and destructive actions
✅ Where the brand colour is red, amber or green, do **not** use it for interactive elements. Use `--color-text-strong` for links and buttons and keep the brand colour decorative.
One colour cannot mean both "act on this" and "something is wrong" without teaching the user that neither is reliable. The system colours have prior claim, because their meanings arrive with the user.

### E-65 More than one interactive colour
❌ A palette with three brand colours, all appearing on buttons and links
✅ **One** colour marks interactive elements — the highest-contrast one. Additional brand colours are decorative: backgrounds, borders, icons, illustration. A second interactive colour raises a question the user has to answer ("does this one do something different?") and there is no good answer.

### E-73 Interface built only for short content
❌ A layout tested with "Vite" and a two-word title, which breaks on a forty-character name or a four-digit count
✅ Design for the long case as well as the short one. Let content reflow, allow the component to grow, or reduce the type size — but do not clip data out of sight. Hidden overflow hides information the user may need.

### E-74 Truncating where items share a prefix
❌ "User Interface Design Fundamentals C…" repeated down a list, every row identical
✅ Where truncation is unavoidable and items share a leading string, **crop in the middle**: "User Interface De…Chapter 2 – Typography". Truncation must preserve the part that tells items apart, which is rarely the beginning.
Better still, remove the shared prefix entirely and put it in a heading (`A-59`).

### E-91 Button hierarchy carried by colour alone
❌ A blue primary beside a green secondary, identical in every other respect
✅ Weights differ in **structure** — solid fill, outline, underlined text — not just hue. Two buttons differing only in colour are the same button to a colour-blind user, and if their contrast against each other is under 3:1 they are the same button to a low-vision user too.
This also means a button's fill or border is not decorative: it is the thing identifying the element as a button, so it carries the 3:1 non-text floor.

### E-92 Light grey secondary button
❌ A pale grey filled or outlined button beside the primary
✅ Grey reads as **disabled**, so users skip it. Its text and border rarely clear 4.5:1 and 3:1 either. Use an outlined button in `--color-brand`.

### E-93 Inconsistent button shapes
❌ A pill-shaped primary next to a rounded-rectangle secondary
✅ One shape across all weights. Different shapes imply different behaviour; if the behaviour is the same, the difference is noise the user has to resolve.

### E-94 Destructive actions coloured red at rest
❌ A red "Delete" sitting in a list of rows
✅ At rest a destructive action is **tertiary** — less prominent, further from the primary, or disclosed. Red makes it *more* prominent, which is backwards: the goal is friction, not attention.
Red belongs on the **confirming** button inside the confirmation step — `--color-text-error` and the `--color-fill-error` / `--color-stroke-error-strong` set — where the user has already chosen and needs to feel the weight of it.

**But not at every confirmation.** The reference grades the friction, and so should you:

| Friction | When | Treatment |
| --- | --- | --- |
| Light | A less serious action | Ask for confirmation. The confirming button stays **brand-coloured, not red** |
| Moderate | Genuinely destructive, recoverable with effort | Red confirming button, red accent on the dialog |
| Heavy | Irreversible — deleting an account, purging data | Red, **plus a checkbox that must be ticked** before the action can fire |

Reaching for red at every confirmation spends it, and a red button on "delete this draft" leaves nothing louder for "delete your account". Whichever level you pick, prefer making the action **undoable** over making it frightening (`04-principles.md`, Tiebreaker 3) — friction protects nobody who has already clicked.

### E-95 Primary action parked at the right
❌ A right-aligned "Next" with "Back" beside it at the bottom of a multi-step form
✅ Start-align the primary, ordered most to least important. Right-aligned actions get missed on wide screens and by screen-magnifier users, and sit further from the fields they submit.
On multi-step forms put **"Back" as a tertiary button at the top left** — away from the primary, where it cannot be hit by mistake and lose everything just entered.

### E-116 A menu that cannot be opened, or does not say it is open
❌ The nav links hidden at phone width (`display: none` in a `max-width` query, or by default until a `min-width` one), and a Menu button with no `aria-expanded` — or no button at all
✅ The button that shows the links records it: `aria-expanded="false"` while closed, `"true"` while open, and its visible label or icon changes to **Close** while the menu is open. In `editorial`, `<details>` with `<summary>Menu</summary>` inside the `<nav>` does all of this with no script (`P-14`).
A Menu button that does nothing looks finished in every screenshot. On a phone it is the only way to the rest of the site, so the reader who taps it and sees nothing change has nowhere to go. A button that opens the menu without `aria-expanded` is the same failure for a screen reader: it announces "Menu, button" before and after, and the reader never learns anything happened.
`jig check` catches the hidden navigation with no recorded open state anywhere in the project. It cannot tell whether the button actually opens the menu — `critique` operates it on a render at 360px: tap it, and the links appear, `aria-expanded` changes, and the label or icon reads as close.

---

## F. Forms

### F-36 Placeholder as label
❌ `<input placeholder="Email address">`
✅ Persistent `<label>`. Placeholders vanish on focus, fail low-vision users, and break autofill heuristics.

### F-37 Unhelpful error text
❌ "Invalid input", "Error", "This field is required"
✅ Say what is wrong and what to do: "Enter a date after today." Errors are instructions, not verdicts.

### F-38 Validation timing wrong at both ends
❌ Validating on every keystroke, or only on submit with no inline recovery
✅ Validate on blur, revalidate on change once a field has errored, summarise on submit.

### F-39 Input cleared on error
❌ Re-rendering the form empty after a failed submit
✅ Echo every submitted value back into the field. Losing a user's typing is the most expensive small bug in forms.

### F-40 Missing input affordances
❌ `<input type="text">` for email, phone, numbers, one-time codes
✅ Correct `type`, `inputmode`, `autocomplete`, and `enterkeyhint`. On mobile this is the difference between a usable form and an abandoned one.

### F-41 Critical function dependent on JavaScript
❌ A form that only submits via `fetch`, a nav that only opens with JS
✅ Works without JS, enhanced with it. On an unreliable mobile connection, JS-dependency is not a hypothetical — it is a silent failure that looks to the user like nothing happened.

### F-97 Required fields left unmarked
❌ "All fields are required unless marked optional" at the top, with only optional fields marked
✅ Mark **both**. Required takes `*` (with the convention stated at the top) or the word "required"; optional takes the word "optional".
Instructions at the top of a form get scanned past, leaving people guessing field by field. Marking both is also an accessibility requirement for screen reader users, so sighted users may as well get the same clarity. **Never colour the asterisk red** — red means error.
Unmarked required fields are acceptable only where: the product has no optional fields at all; the form is short and familiar (login, newsletter); one question is asked per screen with its reason given; or testing has shown the markers unnecessary.

### F-98 Labels beside inputs
❌ Labels to the left of their fields, left- or right-aligned
✅ Stack the label directly above its input, `--spacing-label` (4px) away.
Left-placed labels make the eye zig-zag between column and field. Right-aligning them to shorten that distance creates a jagged left edge that is harder to scan. Long labels wrap awkwardly in the narrow column. Stacked above and close, label and input are read in one focus.

### F-99 Uniform field widths
❌ Every field full-width, including a four-digit postcode and a three-digit CVC
✅ Width should match the expected input. It is the strongest signal people have about how much is wanted, and a wide box for a short answer creates hesitation. Where length varies, size for the common case.

### F-100 A dropdown for a small set of options
❌ A select holding three, five or eight choices
✅ Radio buttons, stacked vertically, for roughly ten options or fewer. A dropdown costs open, scroll and choose — several precise interactions — hides its options from scanning and comparison, and looks filled when empty, so it gets skipped. Radios cost one press and stay visible.

### F-101 A long dropdown where autocomplete belongs
❌ A 200-entry country select
✅ An autocomplete field when people already know the answer. Keep suggestions to about ten and **bold the differing part** so they can be told apart quickly.
Where people must *browse* to decide, split the list into two dependent fields — industry then occupation — rather than one enormous one.

### F-102 Toggle and checkbox used interchangeably
❌ A toggle inside a form that only applies on submit
✅ The distinction is **when the change takes effect**. A checkbox waits for a submit button; a toggle applies immediately. Label both with what happens when they are **on**.

### F-103 Negatively phrased checkbox labels
❌ "Don't allow automatic updates"
✅ Describe what happens when it is **checked**. Test by prefixing "Yes,": "Yes, allow automatic updates" reads cleanly; "Yes, don't allow automatic updates" does not.

### F-104 Instructional verbs in labels
❌ "Enter your email", "Type your email here"
✅ "Email". The input field already tells people to type in it.

---

### F-113 Form text small enough to make the phone zoom
❌ An input, select or textarea whose text is below 16px — including `operator`'s 14px `--text-body`, and `--text-caption` in every mode
✅ At least 16px on touch screens. To keep a denser size on desktop, raise it only where it matters: `@media (pointer: coarse) { input, select, textarea { font-size: max(16px, var(--text-body)); } }`
iOS Safari zooms the whole page when a field whose text is below 16px takes focus, and it does not zoom back out when the field loses it. The reader is left with a form wider than the screen, scrolling sideways to find the next field (`D-115`).
Setting `maximum-scale=1` on the viewport to stop it is not the fix. That disables pinch zoom for everyone, which is an accessibility failure in its own right.

## G. Motion

### G-42 Entrance animation on everything
❌ Every section fading and rising on scroll
✅ Motion earns its place by explaining a change of state or spatial relationship. Decoration on a page the user will visit twice a day becomes friction.

**"Once" means once per visitor, not once per page load.** A welcome or hero animation that replays on every arrival stops being an introduction after the first one and becomes a toll. Persist the fact that it has played and skip it thereafter. Where one does run, give it a visible one-click skip — a user who wants the content now must not have to wait out a brand moment to reach it.

### G-43 `prefers-reduced-motion` ignored
❌ Animation with no reduced-motion path
✅ Always provide the reduced path. Non-negotiable — this is a vestibular safety issue, not a preference.

**A consequence worth stating: motion is never the sole signal, for the same reason colour is not (`C-20`).** Honouring the reduced-motion path removes the animation, so any state that was communicated by movement alone is communicated to that user by nothing at all. A field that only shakes on a bad password has no error state under reduced motion. Pair the motion with text, an icon, or a colour change that survives without it.

### G-44 Durations too long
❌ 500ms+ on UI feedback
✅ 100–200ms for state change, up to 300ms for larger transitions. If it can be perceived as waiting, it is too slow.

**Scope: this is about motion that answers an input or carries a state change.** It is not a ceiling on every animation on the page. Slow decorative looping motion — see `P-13` — runs for seconds by design, and is not covered here. The reason the two differ is the reason the numbers differ: interaction motion sits between the user and their task, so it must get out of the way; ambient motion is never in the way, so speed would only make it noticeable.

---

## H. Code-level

### H-45 New component instead of the existing one
❌ Writing a fresh button component because the repo's was not read
✅ Search the codebase first. Extend what exists. Duplication here is where design systems die.

### H-46 Local convention overridden
❌ Introducing a second styling approach, naming scheme or file layout
✅ Match the surrounding file. Consistency with the codebase outranks personal preference and outranks this document.

### H-47 Values hard-coded past the token layer
❌ A raw hex colour or pixel size written in component code
✅ Reference the token. Consume the semantic role (`--color-text-strong`), not the primitive (`--color-neutral-900`). A value that cannot be expressed as a token is a missing token — or a value that should not exist at all. Check the second before minting the first.
Deletion is a real answer and the easy one to miss, because the correction points at a token and an agent reading it literally invents one. Both times this rule fired on Jig's own documentation site the fix was removal: `font-size: 0.9em` on inline `code`, where the two faces share vertical metrics and inheriting is correct (`B-105`); and a `min-width` in `em` on a table column that `max-content` measures for free. A token minted to satisfy a detector entrenches the value it was invented for.

### H-48 JavaScript for something CSS does
❌ Scroll listeners for sticky positioning; scripted accordions and dialogs that have native equivalents
✅ Platform first: `position: sticky`, `<details>`, `<dialog>`, `:has()`, container queries, `scroll-behavior`, `popover`. Reach for a framework when the platform genuinely lacks the capability.

### H-119 A generic element where a native one says what the content is
❌ `<div class="page-title">Our products</div>`, a row of links in a `<div class="nav">`, a page whose top-level content sits in `<div class="main">`
✅ `<h1>Our products</h1>`, `<nav>`, `<main>`. Choose the element from what the content **is**, then style it. The two versions can look identical; only one of them tells a screen reader, a search engine, a reader-mode button and a keyboard user what they are looking at.
**The decision order**, before writing any markup:
1. What is this content? A heading, a list, a sequence, a quotation, tabular data, navigation, a control, a landmark region?
2. Is there a native element whose meaning is that? If yes, use it.
3. Does it describe the content accurately, or only approximately? An approximate fit is worse than a generic container, because it asserts something untrue.
4. Does the content have an order or a relationship that the markup should carry? Ordered steps are `<ol>`; rows and columns of related values are a `<table>`; a term and its explanation are `<dl>`.
5. Can CSS produce the presentation without changing the element? It nearly always can.
6. Only when no native element fits, a generic container.
**This is not a rule against `div`.** A `div` is the right answer when nothing more specific is true: a grouping that exists for layout alone. What is forbidden is choosing an element for how it looks, or reaching for a generic one without asking steps 1 and 2.
**Presentation must not be required to understand the content.** Turn the stylesheet off in your head: the page should still read as what it is, in an order that makes sense. A sidebar that must come first visually does not have to come first in the DOM, and usually should not (`L-01`).
Related: `E-33` (an interactive `div`), `B-17` (heading levels), `H-48` (native elements over scripted ones), `P-14` (navigation).

### H-117 A token name nothing declares
❌ `font-family: var(--font-body)`, `padding: var(--space-lg)` — in a project whose token layer declares neither
✅ Use the names the token layer declares — `02-tokens.md` lists them, and the token files in the project are the source. If the value you need has no token, that is a finding to report or a value to delete (`H-47`), never a name to make up.
The browser does not warn. A `var()` that cannot resolve makes its whole declaration invalid, so the property falls back to its initial value: the font becomes the browser default serif, padding becomes 0, the border disappears. The page still renders, the source still looks tokenised, and every file-based review passes it. In a live run three of four pages invented their token names this way and shipped mostly unstyled.
`jig check` reads every custom property the project declares — the token layer, its own stylesheets, a Tailwind `@theme`, `style` attributes — and reports each reference to one that is not there. A reference with a fallback, `var(--x, 1rem)`, resolves, and is not reported.

---

## I. Copy

**Moved to `05-copy.md`.** Interface text outgrew a section here. Rules `I-53` through `I-57` kept their numbers and live in that file, alongside the rest of the copy rules.

Load `05-copy.md` whenever writing or reviewing a user-facing string.

---

## J. Search and sharing

What a stranger meets **before** the page: the search result, the link preview in
a message, the card a colleague pastes into a channel. Nobody reads `<head>`, so
it is the surface that drifts, and it is the one that is read first.

**Which pages this section applies to is decided by mode, not by taste.**
`editorial` is first-visit content and is indexable. `product` and `operator` are
what somebody reaches after signing in, and are not: an admin screen in a search
result is an invitation, and a login page in one invites credential stuffing. A
spec overrides the default per page — a CV shared by link, a thank-you page, a
not-found page — and says why.

### J-120 Metadata that no longer matches the page
❌ A title or description still carrying positioning the page dropped, changed in a later commit "when there is time"
✅ Change the metadata **in the same change as the copy**. A page's title, description and preview text are copy, written by whoever wrote the headline, reviewed the same way.
This is the whole reason the section exists. A copy pass reads pages; nobody reads `<head>`. One site rewrote every visible page and served the old positioning to search for a day — including a metaphor whose explanation had been deleted the day before, so the stranger who met it had nowhere left to resolve it. The comment above that line already said "metadata is copy, when the positioning moves this moves with it". It had caught the problem once before and did not catch it again, because a comment is not a check.

### J-121 An indexable page with no title or description of its own
❌ A route inheriting the site-wide title, or carrying none, so the result page shows a truncated URL or an excerpt of the navigation
✅ Every indexable page has its own `<title>` and meta description. The home page owns the site default; nothing else inherits it silently.
A missing description does not leave the slot empty. The search engine writes one, from whatever text it finds first, which is usually the navigation.

### J-122 Metadata past its budget
❌ A 78-character title, a 210-character description, both eyeballed
✅ Title ≤ 60 characters, description ≤ 155, measured. Past the budget the end is cut, and the cut lands mid-sentence.
The budget is not a style preference; it is the width of the box someone else renders. Write the important half first, so a cut costs the least.

### J-123 A page that must not be indexed and does not say so
❌ An admin screen, a sign-in page, an internal tool with no robots directive, kept out of search by nothing but obscurity
✅ `noindex` on the page itself, from its own metadata. In `product` and `operator` this is the default and its absence is the defect.
`robots.txt` is not this. It is public, advisory, and read by strangers as a list of interesting places: naming `/admin` there tells everyone where it is. A path is safe to name only when something else protects it — a session guard, an authenticating API — and never because the file asked politely.

### J-124 A sitemap that contradicts the page
❌ A route listed in the sitemap whose own metadata says `noindex`; a sitemap entry for a page that does not exist
✅ One answer per route. The sitemap lists what is indexable, and nothing else.
Contradicting yourself in two files tells a crawler you do not know which is true, and it will decide for you.

### J-125 Invented facts in metadata
❌ `lastModified: new Date()` in a sitemap; a `datePublished` filled in because the field existed; an author, rating or price nobody supplied
✅ Emit a field only where a real value exists in the content. Leave it out otherwise.
A date that is today's on every request is false on every request, and repeated daily it teaches the crawler to disbelieve the field. Structured data is a claim about facts, and a wrong one is worse than a missing one.

### J-126 Structured data retyped instead of read
❌ A name, email or description written as a literal in JSON-LD beside the same value in the content model
✅ Build it from the same source the page renders from. One value, one place.
A second copy of the positioning is a second thing to keep in step by hand, which is `J-120` again wearing a different hat.

### J-127 A list served as a fact when it is empty
❌ A sitemap that renders with no entries because a content read failed, asserting the site has nothing
✅ Concatenate the static routes unconditionally, and let a failed read yield the stale list rather than an empty one. When a list is genuinely empty, prove it before shipping.
An empty sitemap is not a missing sitemap. It is a positive claim, and the crawler believes it.

---

## K. Safety at the interface

**This is not a security review, and nothing here should be read as one.** Jig
sees interfaces. It knows nothing about your sessions, your rate limits, your
CORS origins, your secrets or your dependencies, and a clean run says nothing
about any of them. What it can see is the handful of things an interface does to
itself — the ones that ship because nobody looks at the markup with this question
in mind.

### K-128 A new-tab link that hands over the page it left
❌ `target="_blank"` with no `rel`
✅ `rel="noopener"` on every `target="_blank"`, `noreferrer` too when the destination has no business knowing where the reader came from.
The opened page gets a handle on the window that opened it and can navigate it somewhere else. The reader comes back to a tab that looks like yours and is not. Modern browsers imply `noopener` for `_blank`, which is the argument for writing it rather than against: the ones that do not are the ones being attacked.

### K-129 User content written as markup
❌ `dangerouslySetInnerHTML`, `v-html`, `innerHTML =`, `{@html}` carrying anything a person typed
✅ Render it as text. Where formatting is genuinely required, sanitise on the way in with a library that is maintained, and keep the allowed set to what the feature needs.
The name of the React prop is a warning someone wrote on purpose. A comment, a display name, a product description: each is a place a script arrives and runs with your origin's privileges.

### K-130 Credential fields that fight the password manager
❌ `autocomplete="off"` on a password, a `paste` handler that blocks pasting, a one-time-code field with no `autocomplete`
✅ `autocomplete="current-password"`, `"new-password"`, `"one-time-code"`, and nothing preventing paste.
Blocking the manager does not stop an attacker; it stops the reader using a long unique password, so they type a short one they can remember and reuse it everywhere. The interface decides which of those two happens.

### K-131 A frame with no sandbox, a script from anywhere
❌ `<iframe src="https://third-party">` with no `sandbox`; a `<script src>` pointing at an origin nobody chose, on a page that takes payments or credentials
✅ `sandbox` with only the capabilities the embed needs, and `allow` narrowed the same way. Third-party script on a sensitive page is a decision, recorded with a reason (`DECISIONS.md`), not a default.
An embedded frame runs somebody else's code inside your page, and a script tag hands them the same origin your session lives in. Both are sometimes right; neither is ever automatic.

### K-132 A secret rendered as plain text
❌ An API key, a recovery code or a token printed into the page, sitting in the DOM for anything that reads it
✅ Show it once, deliberately, behind an action the reader takes, with a copy control and a clear statement that it will not be shown again.
Anything on the screen is in the DOM, in the accessibility tree, in a screenshot, and often in a session recording nobody remembered was running.

### K-133 An error that describes the system
❌ A stack trace, a database error, a file path or a framework name shown to whoever hit the page
✅ Say what happened in the reader's terms and what to do next (`05-copy.md`). Keep the detail in the log, where it is useful and not public.
An error is copy, and the audience is the person reading it. Naming the stack tells a stranger which list of known problems to work through.

### K-134 Inline handlers on a page with a content policy
❌ `onclick="…"` in markup, a `<script>` with no nonce, on a site that sets a Content-Security-Policy
✅ Bind behaviour in script (`E-33` asks for a real control anyway), and let the policy's nonce cover the one bootstrap the framework emits.
This is where a security decision made in configuration lands on whoever writes the markup: under a strict policy the inline handler simply does not run, and the page fails in the browser rather than in a check.

---

## L-04 · Self-check before finishing

Run this against what you produced. Any "no" is a defect to fix, not a note to mention.

**Answer every item** — yes, no, or n/a with the reason. A number you skip reads
exactly like a pass. **A yes cites where**: `pricing.css:41`, not "✓". A live run
answered this list from memory and reported interactive states and a
reduced-motion path as present; neither existed anywhere in the stylesheet, and
only a reviewer that had never seen the build found that out.

1. **The generic-AI tells, named rather than gestured at.** This used to read
   "would this look different from a generic template if the accent colour were
   removed?", which an agent that has just produced a generic template answers
   yes to — and its `A-01 → A-10` range silently excluded `A-58`, `A-59`, `A-60`
   and `A-67`. Check each:
   - Was the accent colour **chosen**, or did it appear because none was
     specified? (`A-01`)
   - Any gradient text, decorative blobs, glassmorphism or neumorphism?
     (`A-02`, `A-03`, `A-04`)
   - Emoji standing in for icons — including ones marked `aria-hidden`?
     (`A-05`)
   - Three things in a three-column icon-and-heading grid because there were
     three of them? (`A-06`)
   - One radius on every element regardless of its size; shadow doing all the
     depth work? (`A-07`, `A-08`)
   - Marketing voice in an application, or placeholder content still in place?
     (`A-09`, `A-10`)
   - Decoration that mimics a functional signal — colour picked for variety, an
     icon that looks pressable and is not? (`A-58`)
   - Every list item restating the context they share? (`A-59`)
   - Icons at equal weight competing with the text they support? (`A-60`)
   - A border, card or panel around every group on the page? (`A-67`)
2. Is every run of prose measure-capped and left-aligned? (B-11, B-12)
3. Does any text or placeholder fall below 4.5:1? (C-19)
4. Is every spacing value a `--spacing-*` token, and does `--spacing-heading-before` exceed `--spacing-heading-after`? (D-23, D-24)
5. Does every interactive element have hover, focus-visible, active and disabled? (E-28)
5b. Are links underlined, headings uncoloured, and icon-only controls labelled? (C-49, C-50, E-51)
5c. Do control borders use `--color-stroke-strong` and clear 3:1? (`02-tokens.md`)
5d. Has the copy been checked against `05-copy.md`? (sentence case, front-loaded, plain, descriptive links, actionable errors)
5e. Can a user tell what each control is, which item is selected, and what to do next? (E-63)
5f. Does spacing grow from the innermost rectangle outward, and does the component use one alignment? (D-69, D-71)
5g. Does the layout survive the longest realistic content, and does nothing non-interactive look interactive? (E-73, C-68)
5i. Do button weights differ in structure rather than colour, is there one primary, is the tertiary underlined, and are destructive actions low-prominence? (E-91, P-02, E-94)
5h. Is long-form text 18px+ at 1.5+, start-aligned, 40–80 characters per line, in one typeface and two weights? (B-75, B-12, B-76, B-77)
5j. Single column, labels above and close, both required and optional marked, hints above the input, widths matched, borders at 3:1? (P-04, F-98, F-97, P-03, F-99)
6. Does `outline-none` appear anywhere without a replacement indicator? (E-29)
7. Does every data view have a loading, empty and error state? (E-28, E-30)
8. Does every form field have a persistent label, correct `type`/`inputmode`/`autocomplete`, and value echo on error? (F-36, F-39, F-40)
9. Does the primary action still work with JavaScript disabled? (F-41)
10. Is there a `prefers-reduced-motion` path? (G-43)
11. Did you reuse existing components and tokens rather than adding new ones? (H-45, H-47)
12. **Has anything judged the rules this list does not name?** Items 1–11 are a
    hand-picked sample of the corpus, chosen because they are the failures most
    worth catching early. They are not the corpus, and finishing them is not
    coverage.

    Run `jig check` and read its attestation. If it says `judgment=not-run` —
    and on its own it always does, because the CLI can only decide what a
    detector decides — then the majority of the rules that apply to what you
    just built have been judged by nothing.

    That is not a screen you may call done. Either run `critique`, which walks
    the index and returns a verdict per rule, or say plainly in your final
    message that the judgment pass did not run and the work is unverified
    against it. **Saying nothing is the failure this item exists to stop**: a
    report that lists what was checked and stays silent about what was not reads
    as a clean result, and a reader cannot tell the two apart.
13. **Was it looked at on a phone?** At 360px: does the composition change rather
    than shrink, is the navigation a control designed for that width rather than
    the desktop row squeezed, and does the page stay inside the screen — no
    sideways scroll? "The CSS has a media query" is not an answer; what the page
    does at that width is.
