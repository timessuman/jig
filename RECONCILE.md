# Reconciliation checklist

The numeric defaults in this system started as internally consistent guesses. They are
being reconciled, row by row, against an external reference on interface design. This file
tracks that work.

For each row: record the reference's position in your own words, decide whether to adopt
it, and change the value **in the token or rule file** — never at a call site. Where you
keep a value that deliberately differs, mark it ➖ and say why in one line. A divergence
that is not argued is not a decision, it is drift.

The accessibility floors are not part of this process. Contrast ratios and target sizes
come from WCAG 2.1 AA and are not adjustable — see "Not up for reconciliation" below.

Status: `⬜ open` · `✅ reconciled` · `➖ kept, deliberately different`

## Type

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| T9 | **Scale ratio varies by mode** 1.250 / 1.200 / 1.125 — reverses the earlier unification | `mode.*.css` | `01-modes.md` | ✅ |
| T10 | `--text-prose` (18px) separated from `--text-body` (UI text) | `mode.*.css`, `B-75` | `01-modes.md` | ✅ |
| T11 | **Two weights only**, regular + bold — `--font-weight-medium` removed | `mode.*.css`, `B-77` | `01-modes.md` | ✅ |
| T12 | Measure 40–80 characters, stated as the rule | `02-tokens.md` | `01-modes.md` | ✅ |
| T13 | Line height 1.5–2 for prose; raise for long lines / heavy faces | `02-tokens.md` | `01-modes.md` | ✅ |
| T14 | One sans serif; second face for headings only | `B-76` | `01-modes.md` | ✅ |
| T15 | Justified text prohibited outright | `B-12` | `01-modes.md` | ✅ |
| T16 | Four treatments for text on photos | `B-78` | `01-modes.md` | ✅ |
| T17 | Letter spacing tightens as size grows | `mode.*.css` | `01-modes.md` | ✅ |
| --- | --- | --- | --- | --- |
| T1 | Body **16 / 16 / 14px**. Editorial dropped 18→16 | `mode.*.css` | `01-modes.md` | ✅ |
| T2 | **One scale, ratio 1.200**, all modes: 14/16/20/24/32/40 | `mode.*.css` | `01-modes.md` | ✅ |
| T3 | Line height 1.65 body → 1.05 display. **Floor 1.5 on body/secondary, all modes** | `mode.*.css` | `01-modes.md` | ✅ |
| T4 | Measure 68 / 60 / 72ch | `mode.*.css` | `01-modes.md` | ⬜ |
| T7 | Line height = size + 8, on 4pt grid | `mode.*.css` | `01-modes.md` | ✅ |
| T8 | **Line heights unitless, not px.** 1.5 floor on body/secondary | `mode.*.css` | `01-modes.md` | ✅ |
| T5 | Weight 400 body minimum, 600 headings | `mode.*.css`, `B-14` | `01-modes.md` | ⬜ |
| T6 | Negative tracking on headings only | `mode.*.css` | `01-modes.md` | ⬜ |

## Simplification

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| L1 | Link treatment: three cases, not one blanket rule | `C-49` |  | ✅ |
| L2 | Brand-colour implication runs one way only | `I-56` |  | ✅ |
| L3 | Trend styles (glass, neumorphic) named and excluded | `A-04` |  | ✅ |
| L4 | Decorative style must not mimic a functional signal | `A-58` |  | ✅ |
| L5 | Repeated information lifted into a heading | `A-59` |  | ✅ |
| L6 | Icons subordinate to the text they support | `A-60` |  | ✅ |
| L7 | Show navigation that fits; expose off-screen edges | `E-61`, `E-62` |  | ✅ |
| L8 | Minimal ≠ simple; ceiling on Tiebreaker 5 | `E-63`, `04` |  | ✅ |
| L9 | Progressive disclosure as a pattern | `P-11` |  | ✅ |
| L10 | Four choice-reduction techniques | `P-10` |  | ✅ |
| L11 | Smallest screen first | `03` |  | ✅ |

## Colour

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| C12 | **Transparent foregrounds over solid elevation backgrounds** | `brand.default.css` |  | ✅ |
| C13 | Opacity ladder 90/60/45/10/4 light · 100/78/60/12/6 dark | `brand.default.css` |  | ✅ |
| C14 | Brand + system colours: 4 variations at 100/80/20/5 | `brand.default.css` |  | ✅ |
| C15 | Three elevation backgrounds, consistent across modes | `brand.default.css` |  | ✅ |
| C16 | Dark-mode depth from background, not shadow | `C-66` |  | ✅ |
| C17 | Large text = 24px regular / 18px bold (was 20px bold) | `02-tokens.md` |  | ✅ |
| C18 | Test contrast against `fill`, and `bg-overlay` in dark | `02-tokens.md` |  | ✅ |
| C19 | APCA as a secondary check; WCAG 2 for compliance | `02-tokens.md` |  | ✅ |
| C20 | Semantic naming `element.tone.emphasis.state` | `02-tokens.md` |  | ✅ |
| C21 | Brand colour with a system meaning stays non-interactive | `E-64` |  | ✅ |
| C22 | Exactly one interactive colour | `E-65` |  | ✅ |
| C23 | State layers: hover = fill, press = stroke-weak | `P-02` |  | ✅ |
| C24 | Design in black and white first | `04` Tiebreaker 5 |  | ✅ |
| C25 | Three system colours; `info` kept as my own fourth | `brand.default.css` |  | ➖ |

| --- | --- | --- | --- | --- |
| C6 | Links: colour **and** underline | `C-49` |  | ✅ |
| C7 | Headings never coloured | `C-50` |  | ✅ |
| C8 | Icons need visible labels, not just `aria-label` | `E-51` |  | ✅ |

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| C1 | Neutrals **tinted with `--brand-hue`**, not independent greys | `brand.default.css` |  | ✅ |
| C9 | Five neutral roles: text strong/weak, stroke strong/weak, fill | `brand.default.css` |  | ✅ |
| C10 | Brand colour marks **all** interactive elements, nothing else | `I-56` |  | ✅ |
| C11 | **Control borders need 3:1** (WCAG 1.4.11) | `02-tokens.md` |  | ✅ |
| C2 | Near-black on off-white, not pure | `C-18` |  | ⬜ |
| C3 | Text floor at ramp step `-700`; `-500` never text | `02-tokens.md` contrast contract |  | ⬜ |
| C4 | Semantic hues **0 / 42 / 162 / 220** (error / warning / success / info). This row previously read 25 / 75 / 150 / 240, which matched no token — the hues moved and the row did not. | `brand.default.css` | `02-tokens.md` | ⬜ |
| C5 | Dark mode: surfaces lighten, no inversion | `C-21`, `brand.default.css` |  | ⬜ |

## Spacing and layout

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| S7 | Four grouping tools; use the weakest that works | `A-67`, `03` |  | ✅ |
| S8 | Spacing grows outward: XS → M → L → XXL | `D-69` |  | ✅ |
| S9 | Card padding is **M (24)**, was L (32) in editorial | `mode.*.css` |  | ✅ |
| S10 | 12-column grid; gutters L→S, margins XXL→S | `mode.*.css`, `03` |  | ✅ |
| S11 | Six hierarchy variables + 3-step ordering method | `03` |  | ✅ |
| S12 | One alignment per component; start-aligned | `D-71` |  | ✅ |
| S13 | Baseline alignment for mixed-size text in a line | `D-72` |  | ✅ |
| S14 | Unbroken left edge down a text block | `D-70` |  | ✅ |
| S15 | Non-interactive must not look interactive | `C-68` |  | ✅ |
| S16 | Design for long content; crop truncation mid-string | `E-73`, `E-74` |  | ✅ |
| S17 | Squint test, with an agent-usable analogue | `03` |  | ✅ |
| --- | --- | --- | --- | --- |
| S1 | **8pt base, six options** XS 8 · S 16 · M 24 · L 32 · XL 48 · XXL 80 | `mode.*.css` |  | ✅ |
| S6 | Modes **select** options; they never define values | `mode.*.css` |  | ✅ |
| S2 | Section rhythm XXL 80 / XL 48 / M 24 | `mode.*.css` |  | ✅ |
| S3 | Card padding L 32 / M 24 / S 16 | `mode.*.css` |  | ✅ |
| S4 | Heading space-before exceeds space-after 2–3× | `D-24` |  | ⬜ |
| S5 | Optical over mathematical alignment | `D-27` |  | ⬜ |

## Form and elevation

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| F1 | Control heights 48 / 40 / 32px | `mode.*.css` |  | ⬜ |
| F7 | Touch target **48px** all modes (was 44px) | `mode.*.css` |  | ✅ |
| F8 | Stepper over select for small numeric ranges | `P-03` |  | ✅ |
| F9 | Split forms beyond ~3 question groups into steps | `P-04` |  | ✅ |
| F2 | **Three radii: 8 / 16 / 32px** by element size | `brand.default.css` | `01-modes.md`, `00-anti-patterns.md` | ✅ |
| F3 | **Two shadows: raised, overlay.** Stroke still preferred | `brand.default.css`, `A-08` |  | ✅ |
| F4 | Help text **before** the control | `P-03` |  | ⬜ |
| F5 | Validate on blur, revalidate on change | `F-38` |  | ⬜ |
| F6 | Table row 36px operator / 48px product | `mode.*.css` |  | ⬜ |
| F10 | **Unbranded radius default stays 8 / 16 / 32.** Considered 4 / 8 / 16 on the grounds that radius is the loudest carrier of brand character and the default should be as visibly provisional as the near-black accent. Rejected: radius has no null value, so a lower default is a different opinion rather than an absence — 0px reads brutalist, 4px reads technical, none reads as "undecided" the way near-black does. The value that actually asserted character was `--radius-lg` (32px), and no mode selects it. | `brand.default.css` | `01-modes.md`, `00-anti-patterns.md` | ✅ |

## Motion

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| M1 | 250 / 150 / 100ms base per mode | `mode.*.css` |  | ⬜ |
| M2 | Entrance animation: editorial first viewport only | `01-modes.md`, `G-42` |  | ⬜ |

---

## Not up for reconciliation

These are structural or safety decisions, not style, and the reference has no bearing on them:

- Everything in `00-anti-patterns.md` sections **E** (states), **F** (forms) and **H** (code-level)
- The contrast **floors** themselves — the ramp steps are negotiable, the 4.5:1 and 3:1 targets are not
- `--size-touch-target` at 48px in all modes
- `04-principles.md`

## Resolved — T8, line height

The conflict was in the framing, not the values. The reference gives line height in pixels, which is right for a design tool and wrong for CSS: a fixed px line height does not scale when a user increases their text size, so text overlaps (WCAG 1.4.12). Unitless ratios inherit and scale.

Expressed as ratios, the reference's table is already a clean ramp — 16/24 = 1.5, 20/28 = 1.4, 24/32 = 1.333, 32/40 = 1.25, 40/48 = 1.2. Only the 14px caption step breaks it at 1.43, and that step is raised to 1.5 because `operator` uses 14px as body text.

So: those values, expressed unitless, floor held. The 4pt-grid objection disappears, because line height is no longer a fixed number. A departure from the reference's *format* for a reason a design reference would not have had to consider.

## Copy

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| W1 | Copy split into its own file | `05-copy.md` |  | ✅ |
| W2 | Cut filler, introductory phrases; sentences under 20 words | `I-79` |  | ✅ |
| W3 | Inverted pyramid for anything over a sentence | `I-80` |  | ✅ |
| W4 | Headings must carry meaning out of context | `I-81` |  | ✅ |
| W5 | Parallel elements written to similar length | `I-82` |  | ✅ |
| W6 | Numerals, comma-separated; "1 billion" not the digits | `I-83` |  | ✅ |
| W7 | Expand abbreviations, or remove them | `I-84` |  | ✅ |
| W8 | Uppercase only as a short label: small, bold, tracked | `I-85` |  | ✅ |
| W9 | No full stops on fragments; consistent across siblings | `I-86` |  | ✅ |
| W10 | One word per concept; project term list | `I-87` |  | ✅ |
| W11 | No "my"/"your" on form labels | `I-88` |  | ✅ |
| W12 | Links name their destination; no "click here" | `I-89` |  | ✅ |
| W13 | Errors: what happened, why, what next; no apology words | `I-90` |  | ✅ |

## Buttons

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| B1 | **Tertiary must be underlined** — corrects my earlier "no edge, no underline" | `P-02` |  | ✅ |
| B2 | Secondary = brand outline + brand text; never grey, never a second solid fill | `P-02`, `E-92` |  | ✅ |
| B3 | Button shape 3:1, text 4.5:1, 3:1 between same-styled buttons | `P-02`, `E-91` |  | ✅ |
| B4 | Hierarchy through structure, not hue | `E-91` |  | ✅ |
| B5 | Equal importance → equal prominence (both secondary) | `P-02` |  | ✅ |
| B6 | One shape across all weights | `E-93` |  | ✅ |
| B7 | Label is verb + noun | `P-02` |  | ✅ |
| B8 | 16px minimum between adjacent buttons | `P-02` |  | ✅ |
| B9 | Start-aligned, most→least important; mobile stacks full-width | `P-02`, `E-95` |  | ✅ |
| B10 | Multi-step "Back" is tertiary, top left | `P-02`, `E-95` |  | ✅ |
| B11 | Single-field forms may attach the button to the field | `P-02` |  | ✅ |
| B12 | Three alternatives to disabling, in order | `E-32`, `P-02` |  | ✅ |
| B13 | Disabled buttons stay keyboard-focusable | `E-32` |  | ✅ |
| B14 | **Destructive is tertiary at rest, red only on confirm** | `E-94`, `P-02` |  | ✅ |
| B15 | Icon/text balance via weight, size, then contrast | `D-96` |  | ✅ |

## Forms

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| R1 | **Mark BOTH required and optional** — reverses my "mark optional only" | `F-97`, `P-03` |  | ✅ |
| R2 | Asterisk never red | `F-97` |  | ✅ |
| R3 | Labels stacked above, 4px away (`--spacing-2xs` added) | `F-98`, `mode.*.css` |  | ✅ |
| R4 | Hints above the input — autofill and keyboards cover the space below | `P-03` |  | ✅ |
| R5 | Field width matches expected input | `F-99` |  | ✅ |
| R6 | Radio buttons over dropdowns at ≤10 options | `F-100` |  | ✅ |
| R7 | Autocomplete over long dropdowns; ~10 suggestions, bold the diff | `F-101` |  | ✅ |
| R8 | Split browse-lists into two dependent fields | `F-101` |  | ✅ |
| R9 | Checkbox = on submit; toggle = immediate | `F-102` |  | ✅ |
| R10 | Positive checkbox phrasing, "Yes," test | `F-103` |  | ✅ |
| R11 | No instructional verbs in labels | `F-104` |  | ✅ |
| R12 | Radios/checkboxes stack vertically | `P-12` |  | ✅ |
| R13 | Stepper: +/− not arrows, horizontal, 48px targets | `P-12` |  | ✅ |
| R14 | Keep iconic control shapes when restyling | `P-03`, `E-52` |  | ✅ |
| R15 | Side-by-side fields allowed within the single column | `P-04` |  | ✅ |
| R16 | Multi-step: few full steps, easiest first, review before submit | `P-04` |  | ✅ |
| R17 | Placeholder allowed as a format example at 4.5:1 | `P-03` |  | ✅ |

## Also worth capturing

The reference will contain reasoning this system has no place for — why a rule holds, what it trades against, when it breaks. That belongs in your head, not in these files. If a piece of reasoning changes a *decision*, change the value. If it only explains one, leave the files alone.
