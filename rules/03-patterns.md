# 03 · Patterns

**Status:** draft v0.1
**Depends on:** `00-anti-patterns.md`, `01-modes.md`, `02-tokens.md`
**Framework:** agnostic. Anatomy and behaviour, not implementation.

Each pattern states its **anatomy** (parts, in order), its **states**, its **rules**, and **what varies by mode**. Build the anatomy completely before styling anything. A pattern missing a state is not finished, however good it looks.

---

## P-01 · Feedback placement

Read this before building any pattern that reports something to the user. The most common error in generated UI is not bad styling, it is putting a message in the wrong place — usually a toast, because toasts are easy.

| The message is… | Goes | Never |
| --- | --- | --- |
| About one field | Inline, adjacent to that field, persistent | A toast |
| About one submission, blocking it | Summary above the form **and** inline per field | A toast |
| Result of an action the user just took, non-blocking | Toast, 4–6s, dismissible | A dialog |
| About the whole page or account state | Banner at the top of the content region, persistent | A toast |
| Requiring a decision before continuing | Dialog | A banner |
| A background failure the user did not cause | Banner, persistent, with a retry | A toast |

**Rules**
- A toast is for something already done. If the user must act, it is not a toast.
- Anything a user might need to re-read is not a toast. Errors are re-read.
- Never stack more than one toast. Replace, or aggregate into a banner.
- Every error message says what happened **and** what to do next (`F-37`). "Something went wrong" is not a message, it is an apology.
- Errors are announced to assistive technology: `role="alert"` for immediate, `aria-live="polite"` for summaries (`E-35`).

---

## P-02 · Button

**Anatomy:** `[icon] label [icon]` in a control of height `--size-control`, with a hit area of at least `--size-touch-target` (48px).

### Three weights

| Weight | Treatment | Use |
| --- | --- | --- |
| **Primary** | Solid `--color-brand` fill, `--color-on-brand` text, `--radius-control` | The one action the view exists for |
| **Secondary** | Transparent fill, `--color-brand` border **and** text, same radius and height | The alternative, or several actions of equal weight |
| **Tertiary** | Transparent, no border, `--color-brand` **underlined** text | Least important actions, repeated actions, destructive actions |

**The tertiary underline is not optional.** Without it, colour is the only thing distinguishing the button from plain text, which fails every colour-blind user. Proximity to other buttons may rescue it sometimes; that is not a control you can rely on.

### The accessibility floors

Four numbers, and most button designs in the wild fail at least one:

| Requirement | Threshold |
| --- | --- |
| Button **shape** — fill or border — against its background | **3:1** |
| Button **text** against the button | **4.5:1** |
| Two buttons sharing a style, distinguished only by contrast | **3:1 between them** |
| Hit area | `--size-touch-target` — **48×48px** floor |

A secondary button's fill or border is **not decorative**. It is the only thing identifying the element as a button, so it carries the 3:1 non-text requirement (`02-tokens.md`). Strip it and you have coloured text.

### Rules

- **Hierarchy must not depend on colour.** Two buttons differing only in hue are identical to a colour-blind user, and if their contrast against each other is under 3:1 they are identical to a low-vision user too. Vary **fill, border and underline** — structure, not just colour.
- **One primary per view.** Where several actions repeat down a list, they are all secondary or all tertiary; a column of primaries says every row is the most important thing on screen.
- **Equal importance means equal prominence.** "Report" and "Don't report" are a genuine choice, so both are secondary. Making one primary applies a thumb to the scale.
- **Never a light grey secondary.** It reads as disabled, and its text and border rarely clear their floors.
- **Never a second solid fill** in another colour beside the primary. Two solid buttons compete, and the hierarchy collapses.
- **One shape for all weights.** If the primary is a rounded rectangle, so is the secondary. A pill beside a rectangle implies a difference in function that does not exist.
- **Label is verb + noun**: "Save post", "Delete invoice", "Add domain". Never "OK", "Submit", "Yes". Buttons are read out of context by screen reader users and by anyone scanning, so the label must work alone.
- **16px minimum between adjacent buttons**, so nobody hits the wrong one.
- Width does not change between states. A loading button keeps its width, swaps the label for an indicator, and sets `aria-busy`.

### Order and alignment

**Start-aligned, ordered most to least important.** The eye returns to the left edge moving down a screen; a right-parked primary can be missed entirely on a wide display or by anyone using a screen magnifier; and putting the most-used action first cuts the distance most people travel.

- **Mobile:** stack top to bottom in the same order, full width, so either hand reaches them.
- **Dialogs:** start-aligned, for consistency with every form in the product. Right alignment is defensible — it is the Mac convention and reads as forward momentum — but pick one and hold it everywhere.
- **Multi-step forms:** primary start-aligned at the bottom; **"Back" as a tertiary button at the top left**, not beside the primary. A prominent Back next to Next gets clicked by mistake and the entered data is gone.
- **Exception:** a single-field form — search, email capture — may attach the button to the end of the field. It saves space and reinforces that the two belong together.

### Icon and text pairs

Match the icon's **weight** and **size** to the text it sits with. Where they cannot be matched — the icon set is heavier or larger than the type — bring the icon's **contrast** down instead: `--color-stroke-strong` for the icon against `--color-text-weak` for the label. The pair should read as one unit, with neither shouting over the other.

### States

All required (`E-28`): `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`.

Transparent layers are the default treatment — no new tokens, and they work on every surface in both modes:

| State | Treatment |
| --- | --- |
| Hover | Layer `--color-state-hover` over the element |
| Press / active | Layer `--color-state-press` over the element |
| Focus | Visible outline on `--color-focus`, never a fill change alone |
| Disabled | `--opacity-disabled` — but see below |

Alternatives where a layer is not enough: change the fill from the palette, change elevation (a card lifting on hover), toggle an underline (remove it from a link that has one, add it to a nav item that does not), or move the element a few pixels. Keep motion short and honour `prefers-reduced-motion` (`G-43`). Press usually matches default, since it only needs to differ from hover.

### Instead of disabling

Disabled buttons give no feedback on press, often fail contrast, and are skipped by keyboard focus — so the user cannot even reach the thing to find out why it is dead. Three better options, in order:

1. **Enable and validate on submit.** Let them press it; show what is missing. A person who skipped a field learns that immediately instead of hunting for the reason the button will not work.
2. **Remove the action** and say why it is unavailable. "Private account — request to follow this person to see their work."
3. **Keep the button, add a lock icon.** Full contrast, discoverable, obviously gated. Works well for paid features, provided you say how to unlock them.

If you must disable: put a message beside the button explaining what is needed, or a tooltip on it, and **keep it keyboard-focusable** so assistive technology can reach the explanation.

### Destructive actions

Friction scales with severity, and the first lever is prominence.

- **At rest, a destructive action is tertiary.** Less prominent, further from the primary action, or disclosed behind something.
- **Do not colour it red at rest.** Red makes it *more* prominent — the opposite of what friction means. `--color-danger` styling belongs on the **confirming** button inside a confirmation step, where the user has already chosen and needs to understand the weight of it.
- Destructive actions sit at least `--spacing-stack` from their nearest common neighbour, and confirm. In `operator`, confirmation is typed (`01-modes.md`).

---

## P-03 · Form field

**Anatomy, in this order:**
1. `<label>` — always visible, **stacked above** the input (`F-98`)
2. Required or optional marker, in the label (`F-97`)
3. Hint text — **above** the input, below the label
4. Input
5. Error message — after the input, `role="alert"`

**States:** `default`, `focus`, `filled`, `invalid`, `disabled`, `read-only`.

### Label

- **Above the input, never beside it.** Left-placed labels force the eye to zig-zag; right-aligning them to fix that creates a jagged left edge that is harder to scan; and long labels wrap badly in the narrow column. Stacked above, the label and input are taken in with a single focus.
- **Close to its input** — `--spacing-label` (4px), against `--spacing-stack` between fields. The label must be visibly closer to its own input than to anything else, or the pairing is ambiguous (`D-25`).
- **No instructional verbs.** "Email", not "Enter your email" or "Type your email here". The input field already implies the verb.
- No "my" or "your" (`I-88`).

### Required and optional

**Mark both.** Marking only optional fields, with "all fields are required unless marked optional" at the top, fails because people scan past instructions — and marking both is an accessibility requirement for screen reader users anyway.

| | Marker |
| --- | --- |
| Required | `*` with the convention stated at the top, **or** the word "required" |
| Optional | The word "optional" |

The word "required" is the safer of the two: no instruction needed anywhere, no assumption that the asterisk is understood. The asterisk is more concise and lets people scan the count of required fields at a glance. Either is fine; be consistent.

**Never colour the asterisk red.** Red means error.

You may leave required fields unmarked only when: the product has no optional fields anywhere; the form is short and familiar (login, newsletter signup); the form asks one question per screen with the reason explained; or testing has shown it is unnecessary.

### Hints

Above the input, not below. Two reasons: a rule about a password's minimum length is useful **before** typing, not after failing; and the space below an input gets covered by autofill menus and on-screen keyboards, so a hint placed there may never be seen.

Do not hide a hint in a tooltip if it is needed to complete the field.

### Placeholders

Not a label (`F-36`). Placeholders vanish on focus, make an empty field look pre-filled and skippable, and are light enough by design that they usually fail contrast.

Use one only as a **format example** — `MM / YY` — or in a single-field search box, and then at 4.5:1 with a real accessible label present.

### Width

**Match the width to the expected input.** A four-character postcode gets a four-character field. Uniform full-width fields look tidy and lie about the input: width is the strongest hint people have about how much is wanted. Where length varies, size for the common case.

### Conventional styling

Keep the iconic parts (`E-52`): a rectangle with the label above, a square with a tick for checkbox, a circle for radio. If you restyle — enlarging a radio's target area, say — **keep the circle on the left of the label**. Without it, nobody can tell whether one option or several can be chosen.

### Other rules

- Error text says what to do (`F-37`), signalled by border **and** text **and** `aria-invalid` — never colour alone (`C-20`).
- `type`, `inputmode`, `autocomplete`, `enterkeyhint` set correctly (`F-40`).
- Field borders clear **3:1** (`02-tokens.md`). Low-contrast borders are the single most common form defect, and they fail for a sighted user in sunlight as readily as for someone with low vision.
- Never reformat or truncate a value while it is being typed.

---

## P-12 · Choosing an input control

The control determines the interaction cost before a single pixel is styled. Choose by the shape of the answer, not by what fits.

| The answer is… | Use | Not |
| --- | --- | --- |
| One of ~10 or fewer options | **Radio buttons**, stacked vertically | A dropdown |
| One of a long known list (country, product) | **Autocomplete** | A long dropdown |
| One of a long list the user must browse | **Two dependent fields** (industry → occupation) | One enormous dropdown |
| A small number, changed in small steps | **Stepper** | A dropdown or free number field |
| A large or arbitrary number | **Text input** with `inputmode="numeric"` | A stepper |
| On or off, applied on submit | **Checkbox** | A toggle |
| On or off, applied immediately | **Toggle switch** | A checkbox |
| Several of a set | **Checkboxes**, stacked vertically | A multi-select dropdown |

**Why dropdowns lose so often:** they cost open, scroll, choose — several precise interactions, punishing with a motor impairment. They look filled when empty, so they get skipped. And their options are hidden, so they cannot be scanned or compared. Use one when space genuinely matters.

**Radio buttons and checkboxes stack vertically.** A horizontal row makes it easy to hit the wrong one and harder to see which label belongs to which control.

**Autocomplete:** keep suggestions to about ten to avoid choice paralysis, and **bold the differing part** of each suggestion so they can be told apart at a glance. Suitable when people know what they are looking for; not when they need to browse to decide.

**Steppers:** `+` and `−`, not up/down arrows or chevrons — arrows read as a dropdown or accordion. Lay the buttons out **horizontally**, so there is space between them and less chance of hitting the wrong one. Each button gets `--size-touch-target`. Not for large changes.

**Checkbox vs toggle** is about *when the change applies*, not about looks. A checkbox waits for submit; a toggle takes effect immediately. Label each with what happens when it is **on**.

**Positive phrasing** (`F-103`): test a checkbox label by putting "Yes," in front of it. "Yes, allow automatic updates" works. "Yes, don't allow automatic updates" does not.

---

## P-04 · Form

**Anatomy:** heading → intro → required/optional convention → error summary slot → fields grouped by meaning → primary action → secondary action.

### Layout

- **One column.** It keeps a single downward path, so there is no decision about what to fill next, nothing gets missed, and screen-magnifier users — who see a narrow slice at a time — do not lose a second column entirely.
- **Exception:** short, genuinely related fields may sit side by side *within* the column's width — expiry date and CVC, city and postcode. They stay inside the single-column bounds, so they avoid the problems above.
- Group related fields under headings with `<fieldset>`/`<legend>`, spaced by `--spacing-stack`; fields within a group by `--spacing-group`.
- Ask for the minimum. Every field costs completions, adds a chance of error, and asks someone to hand over information they would rather not.
- Prefer an **opt-in** to an optional field (`P-11`).

### Validation timing (`F-38`)

On blur first; on change once a field has already errored, so recovery is immediate; everything on submit, with a summary that receives focus and links to each failed field.

### Multi-step

Beyond roughly three question groups, split it.

- Say up front how long it takes and what they will need.
- **Group into few, fuller steps** — six steps of five related questions, not thirty steps of one. More steps is more interaction cost, not less.
- Order **easiest to hardest**, so early progress is quick.
- Show progress. People push harder as they near the end.
- **Let them review and change answers before submitting**, then confirm success and say what happens next.
- Primary action start-aligned; "Back" as a tertiary button at the top left (`P-02`).
- Each step still submits without JavaScript (`F-41`) — steps are server-tracked positions, not a client-only wizard.

### Other rules

- Echo every submitted value back on error (`F-39`).
- The primary action works without JavaScript. Enhancement intercepts; it does not enable.
- Destructive or irreversible submissions confirm; in `operator`, by typing.
- Success navigates or updates in place with a persistent confirmation — not a toast that vanishes before it is read.

---

## P-05 · Empty state

Four distinct cases. Collapsing them into one generic "No data" is the failure (`E-30`).

| Case | Message | Action |
| --- | --- | --- |
| **Never had data** | What this collection is for | The creation action, prominent |
| **Filtered to nothing** | Which filters are active | Clear filters |
| **Error loading** | That it failed, and whether it is transient | Retry |
| **No permission** | That access is restricted, not that it is empty | Who to ask |

**Rules**
- Never show "no results" when the cause was an error. The user will search for something that was there all along.
- The filtered-empty state repeats the active query so the user can see the typo.
- Empty is not a full-page illustration in `product` or `operator`. It is a sentence and a button inside the container that would have held the data.
- Empty state occupies roughly the space the filled state would, or the layout jumps when data arrives.

**Mode variance:** illustration is permitted in `product` empty states only, and never in `operator` (`01-modes.md`).

---

## P-06 · Data table

Primarily an `operator` pattern; the rules apply wherever a table appears.

**Anatomy:** toolbar (search, filters, bulk actions, column control) → header row → body rows → footer (count, pagination).

**Rules**
- Row identity is stable across refresh, sort and filter. A row that moves under a click causes the wrong record to be acted on — the most damaging bug this pattern has.
- Numeric columns are right-aligned and use tabular figures (`--font-numeric`). Text columns are start-aligned. Never centre either.
- Column headers state units. "Weight" is ambiguous; "Weight (kg)" is not.
- Truncation is resolvable by click or expand, never by hover alone (`E-31`, `01-modes.md`).
- Sort state is visible in the header and reflected in the URL, so a view can be shared.
- Row actions are tertiary buttons, visible without hover in `operator`.
- Bulk selection appears once single actions exist on more than ~20 rows. Selection survives pagination or clearly states that it does not.
- Timestamps are absolute and precise, with relative time secondary (`01-modes.md`). "3 hours ago" alone is unusable in an audit context.
- Loading replaces rows with skeletons of the same height. Never collapse the table to a spinner — the layout jump loses the user's place.
- Empty follows `P-05`, inside the table body, with the header still visible.

---

## P-07 · Dialog

**Anatomy:** title (`<h2>`) → body → actions, secondary before primary in DOM order.

**Rules**
- Use the platform: `<dialog>` with `showModal()` gives focus trapping, `Escape`, inertness and top-layer stacking for free (`H-48`).
- Focus moves to the dialog on open — to the first control, or the container if none — and returns to the trigger on close.
- Dismissible by `Escape` and by backdrop click, **unless** it reports data loss. Then require an explicit choice.
- Title states the decision, not the category: "Delete three invoices?", not "Confirm".
- The confirming button names the outcome: "Delete invoices", not "Confirm".
- Never nest dialogs. If a dialog needs a dialog, the flow is wrong.
- Never use a dialog for something a page can hold. Dialogs cannot be linked to, bookmarked or reloaded.
- `--shadow-raised` is used here — this is one of the few places elevation is legitimate.

---

## P-08 · Loading

Choose by *what is unknown*, not by preference.

| Situation | Use |
| --- | --- |
| Shape of the result is known | Skeleton matching the real layout |
| Shape is unknown | Spinner, centred in the region it will fill |
| Under ~200ms expected | Nothing. A flash of loading is worse than a brief wait |
| Over ~10s, or a job | Progress with a stage label, and what happens if they leave |
| User-initiated, reversible, high confidence | Optimistic update with rollback on failure |

**Rules**
- Load into the region that will hold the result, never a full-page overlay for a partial update.
- Skeletons match the real content's dimensions, or the layout jumps on arrival.
- A control that triggered loading enters its own loading state (`P-02`) and stays the same width.
- Never animate a skeleton faster than `--duration-slow`; a pulsing grid is more distracting than a static one.
- Announce completion with `aria-live` when focus is elsewhere (`E-35`).

---

## P-10 · Interaction cost

Not a component. A check to run against any flow before calling it finished. See `04-principles.md`, frame 3.

**Count** the clicks, scrolls, pointer distance, keystrokes, waits and things the user must remember or look up.

**Then reduce:**
- Keep the action beside the thing it acts on. Distance is cost (Fitts), and a start-aligned action stays visible to screen magnifier users.
  - A control that closes a panel belongs where the control that opened it was, so the pointer or finger does not travel.
  - Give list and menu items a large, **visibly bounded** target. A border showing the full hit area lets the user be less precise, which is faster.
  - Put a slide-out menu's contents at the top, near its trigger, rather than centred for symmetry.
- Make targets at least `--size-touch-target`. Bigger targets are faster to hit.
- Cut choices, or promote a recommended subset (Hick). Every extra option slows the decision.
- Replace multi-step controls with single-step ones — stepper over select, toggle over dropdown, inline edit over a modal.
- Remove anything competing for attention with the task: banners, autoplay, unsolicited dialogs.

### Reducing choice

Four techniques, in the order to try them (Hick's law):

1. **Remove.** Every option must earn its place. A subscription form asking for first name and company before email is three decisions where one would do — and each field costs completions.
2. **Group or categorise.** Choosing between four categories then four items is faster than choosing from sixteen. Tabs, filters and sections all do this.
3. **Break into steps.** One decision at a time. Long forms become multi-step (`P-04`); large navigation becomes levelled menus.
4. **Recommend.** Where many choices are equivalent, promote the popular ones — suggested searches, a "most chosen" plan, sensible defaults.

**Rule:** when a flow changes, state the before and after counts in one line. "3 clicks + 1 scroll → 2 clicks" is a reviewable claim. "Improved the UX" is not.

---

## P-11 · Progressive disclosure

Reveal information as it is needed rather than all at once. Costs an interaction; buys a large reduction in cognitive load. Use it where most users need only part of the content.

**Anatomy:** visible summary → labelled control → disclosed content, adjacent and in flow.

**Rules**
- The control is **descriptively labelled**. "Benefits of a custom domain", not "Read more". It must make sense read aloud out of context, because screen readers announce links and buttons in isolation.
- Disclosed content appears **next to its trigger**, not elsewhere on the page. Content that opens where the user is not looking has not been disclosed.
- State is visible: the control shows whether the content is open or closed.
- Use `<details>`/`<summary>` unless you need behaviour they cannot express (`H-48`). Keyboard, screen-reader and no-JS support come free.
- **Conditional fields are opt-in, not optional.** A "Mobile number" field revealed by ticking "Receive updates by text" is simpler than a permanently visible optional field — people who do not want it never see it, and people who do get a required field with an obvious reason.
- **Never hide with it what `E-63` requires visible.** Progressive disclosure is for depth, not for labels, selected states or primary actions.

**Mode variance:** `operator` discloses least. For daily users, one dense visible view beats a tidy one that hides what they came for.

---

## Layout method

Not a component. The procedure for structuring any screen, before styling anything.

### Step 1 — Group

Four tools, weakest to strongest. Use the weakest that works (`A-67`):

| Tool | Principle | Cost |
| --- | --- | --- |
| **Continuity** — aligned in a line | The eye follows a continuous line | Free |
| **Similarity** — same size, shape, colour | Alike things are read as related | Free |
| **Proximity** — closer together than to anything else | Near things are read as related | Space |
| **Common region** — a shared container | Strongest cue, and the heaviest | Clutter |

Combine them and the container usually becomes unnecessary — a table's rows are already aligned, alike and close. Break continuity deliberately to mark the end of a group, or to interrupt a list with something that is not part of it.

### Step 2 — Order by importance

Six variables carry hierarchy: **size**, **colour**, **contrast**, **spacing**, **position**, **depth**. The procedure:

1. Group related information into sections.
2. Order the *sections* by importance; important ones first.
3. Within each section, style each element by its importance — larger, higher contrast, more surrounding space, elevated.

Position does more than it looks: people best recall the **first and last** items in a sequence, so a price placed last, beside the primary action, is the one remembered.

Give elements *similar* prominence where they should be read as a pair — matching a label's weight to its icon's balances them instead of letting one shout.

### Step 3 — Space from the inside out

Start at XS on the innermost rectangle and step up moving outward (`D-69`). Between two options, take the larger.

### Step 4 — Align to a grid

Main containers align to a 12-column grid; small elements *inside* them do not — those use the spacing options.

- **Columns** flexible (percentage), 12 on desktop dropping to 4 on mobile.
- **Gutters** fixed, narrower than columns, and kept empty. `--grid-gutter`.
- **Margins** keep content off the screen edge, wider on large screens. `--grid-margin`.

### Step 5 — The squint test

Blur the design, zoom out, or step back. You should still be able to tell what the screen is for and which element matters most. If everything reads at one weight the hierarchy has failed; if elements smear together the white space is too tight.

An agent cannot squint, so use the analogue: **if all type were one size and one colour, would the layout still communicate its order?** If the hierarchy depends entirely on type styling, it is too weak.

---

## Building modularly

Patterns are not built page-first. Build the smallest pieces, then compose.

**Start at the smallest screen.** Narrow space forces prioritisation, and the result stays simpler when it widens. Starting wide invites filling the space, and filled space is cognitive load charged to every user. Widening should add breathing room and, only where it earns its place, more content.

1. **Primitives** — button, input, avatar, badge, icon. No layout assumptions, no page knowledge.
2. **Composites** — field (label + input + error), card, table row, empty state. Built only from primitives.
3. **Templates** — an arrangement of composites that recurs across pages.

Two consequences worth stating, because they are what the discipline buys:

- A change to a primitive propagates. Fix the button once and every composite inherits it.
- If a primitive needs a special case to serve one composite, the composite is wrong, not the primitive. Resist adding a variant prop for a single call site.

Before writing a new component, check whether it is a composite of things that already exist (`H-45`). Most are.

---

## Adding a pattern

A new pattern earns a place here when it has been built three times. Before then it is a component, not a pattern.

Each entry states: anatomy in order, complete state list, rules that are decidable, and mode variance. If a rule cannot be checked by looking at the output, it belongs in `04-principles.md`.

---

## Notes for the author (not for the agent)

**Where your taste is recorded here:**
- `P-01` — the whole feedback table is a position. Toasts are over-used because they are easy to build and require no layout decisions; treating them as the narrowest case rather than the default is deliberate.
- `P-03` help-text-before-control. Contested — many systems put it after. Placing it before means it is read before the user commits to typing, which matters more in forms people fill once.
- `P-04` one-column forms, and the no-JS baseline for the primary action.
- `P-06` stable row identity, absolute timestamps, no hover-only truncation. The procurement instinct again: the record is evidence before it is a convenience.

**Deliberately absent.** Navigation, cards, tabs, and toasts-as-a-component. Navigation and cards vary too much by project to have decidable rules yet — they would produce prose, not constraints. Add them once you have built enough to see the invariant.

**Worth testing before extending.** These eight cover most of what generated UI gets wrong. Point an agent at a form and a table with `00`, `01`, `02` and `03` loaded, and compare against the same task with nothing loaded. If `P-03` and `P-05` do not visibly change the output, the rules are not decidable enough and the fix is more specificity, not more patterns.
