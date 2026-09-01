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

### A-02 Gradient text on headings
❌ `background-clip: text` with a gradient fill and transparent text colour
✅ Solid `--color-text-strong`. Gradient text has unmeasurable contrast and reads as template output.

### A-03 Decorative gradient blobs and orbs
❌ Absolutely-positioned blurred radial shapes behind a hero
✅ Flat background, or a single subtle surface change. Backgrounds do not need decoration to justify existing.

### A-04 Trend styles that fight legibility
❌ Glassmorphism (translucent fill + `backdrop-filter: blur()`), neumorphism (soft inset/outset shadows on a matching background), and their successors
✅ Opaque `--color-surface` with a `--color-stroke-weak` edge. Use translucency only over media, and only when legibility is verified against the worst frame.
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
In `operator`, `--radius-surface` also selects `sm`, so cards, buttons and inputs converge on one 8px radius. That is not this rule's failure case recurring: it is a deliberate per-mode selection made for density, not an unconsidered default applied everywhere without regard to element size. The distinction is whether the value was chosen (here, per this rule) or defaulted to (the ❌ case).

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

### B-12 Centred or justified body text
❌ A centred paragraph of four lines. Justified text of any length.
✅ Start-align anything longer than a short heading or label.
**Centred** text moves the start of every line, so the eye hunts for it. Acceptable for a heading or a couple of lines; never for a paragraph.
**Justified** text is worse and has no acceptable case here. Stretching word spacing to force a straight right edge creates uneven gaps and vertical "rivers" of white space running down the block — actively harmful for dyslexic readers, and the reason books that justify are harder to read than they look.

### B-13 One line-height for everything
❌ One line-height value applied to both a 48px heading and 16px body
✅ `--leading-body` for prose, `--leading-heading` for headings, `--leading-display` for the largest tier. Line height decreases as size increases.

### B-14 Thin weights for body text
❌ Weight 300 or lighter for paragraphs
✅ `--font-weight-body` (400) minimum. Thin weights fail on low-density screens and in bright light — both of which describe most of your users' actual conditions.

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
✅ `--color-text-weak` for secondary text, `--color-text-weak` for large text only. See the contrast contract in `02-tokens.md`: `-500` and lighter are never text on a light background. Check placeholders and disabled states specifically; they are the usual failures.

### C-20 Colour as the sole signal
❌ Red border alone to indicate an invalid field
✅ Colour plus text plus (where useful) an icon. Applies to status badges, chart series, diff views, and validation.

### C-21 Dark mode by inversion
❌ Flipping to `#000` background and keeping the same shadows and borders
✅ Dark mode is its own ramp: elevated surfaces get *lighter*, shadows lose most of their meaning, and saturated colours need desaturating. If dark mode is out of scope, say so rather than shipping a broken one.

### C-22 Semantic colours invented inline
❌ Two different reds in two places, both meaning "error"
✅ One token per meaning — `--color-danger`, `--color-danger-subtle`, `--color-danger-stroke` — referenced everywhere.

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
✅ Every spacing value comes from a `--spacing-*` token, all multiples of `--spacing-unit` (4px). An arbitrary value signals a missing token, not an exception.

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

## E. States and interaction

Agents render the happy path. This section exists because that is the single most common gap in generated UI.

### E-28 Missing states
❌ A component with only a default appearance
✅ Every interactive element defines: `hover`, `focus-visible`, `active`, `disabled`. Every data view defines: loading, empty, error, and partial/truncated.

### E-29 Focus removed without replacement
❌ `outline: none` with nothing in its place
✅ A `:focus-visible` rule with a visible indicator built on `--color-focus`. Never remove the outline without replacing it. This locks out every keyboard user, and it is the most common accessibility failure in generated code.

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
✅ Show what fits. People do not use what they cannot see, and every tap behind a menu is a tap some users will not make. Collapse only under genuine space pressure.

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
`--color-danger` styling belongs on the **confirming** button inside the confirmation step, where the user has already chosen and needs to feel the weight of it.

### E-95 Primary action parked at the right
❌ A right-aligned "Next" with "Back" beside it at the bottom of a multi-step form
✅ Start-align the primary, ordered most to least important. Right-aligned actions get missed on wide screens and by screen-magnifier users, and sit further from the fields they submit.
On multi-step forms put **"Back" as a tertiary button at the top left** — away from the primary, where it cannot be hit by mistake and lose everything just entered.

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

## G. Motion

### G-42 Entrance animation on everything
❌ Every section fading and rising on scroll
✅ Motion earns its place by explaining a change of state or spatial relationship. Decoration on a page the user will visit twice a day becomes friction.

### G-43 `prefers-reduced-motion` ignored
❌ Animation with no reduced-motion path
✅ Always provide the reduced path. Non-negotiable — this is a vestibular safety issue, not a preference.

### G-44 Durations too long
❌ 500ms+ on UI feedback
✅ 100–200ms for state change, up to 300ms for larger transitions. If it can be perceived as waiting, it is too slow.

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
✅ Reference the token. Consume the semantic role (`--color-text-strong`), not the primitive (`--color-neutral-900`). A value that cannot be expressed as a token indicates a missing token.

### H-48 JavaScript for something CSS does
❌ Scroll listeners for sticky positioning; scripted accordions and dialogs that have native equivalents
✅ Platform first: `position: sticky`, `<details>`, `<dialog>`, `:has()`, container queries, `scroll-behavior`, `popover`. Reach for a framework when the platform genuinely lacks the capability.

---

## I. Copy

**Moved to `05-copy.md`.** Interface text outgrew a section here. Rules `I-53` through `I-57` kept their numbers and live in that file, alongside the rest of the copy rules.

Load `05-copy.md` whenever writing or reviewing a user-facing string.

---

## Self-check before finishing

Run this against what you produced. Any "no" is a defect to fix, not a note to mention.

1. Would this look different from a generic template if the accent colour were removed? (A-01 → A-10)
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

---

## Notes for the author (not for the agent)

Rules carrying a deliberate house position rather than a general best practice — these are where your taste is recorded, and they should be defended or changed consciously:

- **C-18** — off-white over pure white. Already evidenced in your site's `#fafaf7`, now the anchor of the default neutral ramp.
- **A-07, A-08** — bordered, low-radius, low-shadow surfaces. This is a stance, not a consensus.
- **F-41, G-42** — resilience and restraint weighted above visual richness. Connects directly to your writing on JS-dependent form fields.
- **D-24** — heading space asymmetry. Universal advice, but stating a ratio makes it enforceable.

Candidates deferred to mode profiles because they are not universal: information density, table row height, use of colour fills for status, page-section rhythm, hero presence, illustration and imagery policy, animation budget.
