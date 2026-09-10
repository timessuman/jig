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

## What the reference extract covers

The reconciliation source is supplied one chapter at a time, as a PDF that is
replaced in place. Chapters read so far on 2026-09-10: **Colour** (book pages 78–152),
**Layout and spacing** (164–218), **Typography** (229–257) and **Buttons**
(295–324). It has no text layer, so it can only be
read as rendered images — see `scripts/render-reference.mjs`, which also records
the two approaches that do not work.

Colour answered `C1`–`C5` and confirmed the APCA table now in `02-tokens.md`.
Typography answered `T4`, `T5`, `T6` directly rather than by entailment, and
produced `T18`–`T21`. Layout and spacing confirmed `S1`, `S8` and `S10` to the
number, and settled `S4`, `S5`, `F1` and `F6` the other way — as ours, because
it covers none of them and it was the chapter most likely to.

Buttons confirmed fourteen of the fifteen `B` rows against the source, most of
them verbatim. `B14` briefly reopened — the first extract stopped at page 322
mid-topic — and closed once pages 323–324 arrived, which turned out to grade
what our row had flattened. It also settled `F1` — no
chapter states a visual control height — while raising the one live tension in
this whole pass, recorded in that row.

**This reference has no motion chapter** — confirmed by its owner after four
chapters had turned up no duration anywhere. `M1` and `M2` are therefore waiting
on a *different* source, not on a further chapter of this one, and they stay ⬜
to say so. `T21` likewise: responsive type scales came from Typography, and
nothing since has revisited them.

When a motion source does arrive, run `scripts/open-rows.mjs` and brief against
its output. The one mistake this process has made twice is asking a source a
subset of what it could answer.

**Because the PDF is replaced rather than added to, evidence has to be written
into this file as it is found.**

`C1` and `C4` were nearly lost to that. The brief for the Colour pass was
written from memory and asked about three open rows while omitting those two,
and the chapter was replaced before the omission surfaced. They were recovered
from the illustration assets extracted out of that PDF — which had been
dismissed as decorative, because the first one out was a background grid, when
in a colour chapter the diagrams are exactly where the values live. Run
`scripts/open-rows.mjs` before writing any brief; it prints the questions this
one should have contained.

One near-miss worth recording as method. A subagent's summary of the APCA scale
quoted five thresholds where the book lists six, having elided one; our own doc
listed all six and briefly looked wrong. Reading the page directly showed the
doc was right. **Check a quotation against the page before correcting a rule
to match it** — an elision reads exactly like an absence.

## What has been checked without the reference

A row can be wrong in two independent ways: it can disagree with the reference,
and it can misstate our own current value. Only the first needs the source. The
second was audited on 2026-09-10 against the code, because `C4` had already
proved it happens — that row read `25 / 75 / 150 / 240`, hues that matched no
token in the system.

Audited and correct:

- Every numeric row's stated default matches the token files: `T4` measure
  (68/60/72ch), `F1` control heights (48/40/32px), `F6` row heights (36/48px),
  `M1` durations (250/150/100ms), and `C4`'s corrected hues (0/42/162/220).
- All 69 rule ids cited across this file resolve to a real rule.
- Every file path cited exists.

Found wrong and corrected:

- **`C1`** claimed neutrals are tinted with the brand hue and was marked
  reconciled. Dark backgrounds are tinted; light backgrounds use a fixed warm
  hue independent of the brand, and every foreground is black or white at an
  opacity. Reopened, with the decision stated in the row.
- `C1` also named `--brand-hue`, which does not exist. The token is `--brand-h`.

`T11` cites `--font-weight-medium`, which correctly does not exist — that row
records its removal.


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
| T18 | **Scale ratio tracks interface complexity** — the reference ties ratio choice to exactly this: "small type scales are generally more suitable for complex website applications, tools, and dashboards where more detail is needed", against large scales "for less complex interfaces, like marketing websites". That is the mode architecture, arrived at independently: `editorial` 1.250, `product` 1.200, `operator` 1.125. | `mode.*.css`, `02-tokens.md` |  | ✅ |
| T19 | **Line height decreases as size increases** (p.247), and long body sits between 1.5 and 2 (p.245). Ours: `--leading-h1` 1.25 → `h2` 1.333 → `h3` 1.4 → `body` 1.5 → `prose` 1.6, monotonic in the right direction, with prose inside the band. | `mode.*.css`, `02-tokens.md` |  | ✅ |
| T20 | **Long body text at least 18px** (p.244). `operator` had `--text-prose` at 16px, contradicting both this and our own `B-75`, which names 18px in its correction. Raised to 18px: sustained readability is a floor like `--size-touch-target`, not a density dial, and `operator` is the mode most likely to be read for hours. | `mode.operator.css`, `B-75` |  | ✅ |
| T21 | **Responsive type scales** — the reference recommends dropping to a smaller scale on mobile to avoid wrapping. We have no mechanism for this: a mode picks one ratio for all viewports. Not a divergence yet, because it was never considered. | `mode.*.css` |  | ⬜ |
| --- | --- | --- | --- | --- |
| T1 | Body **16 / 16 / 14px**. Editorial dropped 18→16 | `mode.*.css` | `01-modes.md` | ✅ |
| T2 | **One scale, ratio 1.200**, all modes: 14/16/20/24/32/40 | `mode.*.css` | `01-modes.md` | ✅ |
| T3 | Line height 1.65 body → 1.05 display. **Floor 1.5 on body/secondary, all modes** | `mode.*.css` | `01-modes.md` | ✅ |
| T4 | Measure 68 / 60 / 72ch. **Confirmed directly** (p.248): "ensure text is 40–80 characters per line (including spaces)", with a diagram marking 40–80 as the ideal span. Our three values sit inside it. The reference gives one range and no per-mode split, so the split is ours within a settled rule. | `mode.*.css` | `01-modes.md` | ✅ |
| T7 | Line height = size + 8, on 4pt grid | `mode.*.css` | `01-modes.md` | ✅ |
| T8 | **Line heights unitless, not px.** 1.5 floor on body/secondary | `mode.*.css` | `01-modes.md` | ✅ |
| T5 | Weight 400 body minimum, 600 headings. **Confirmed directly** (p.239): "use regular and bold font weights only", with thin, light *and semi-bold* crossed out in the diagram — and the carve-out that "some typefaces have a semi-bold font option that you can use instead of bold if bold is too heavy", which is what our 600 is. The reference gives **no numeric weights anywhere**, so 400/600 are ours. It adds a rule we should hold: "reserve very thin or thick font weights for headings and larger text, as they can be difficult to read at smaller sizes". | `mode.*.css`, `B-14` | `01-modes.md` | ✅ |
| T6 | Negative tracking on headings only. **Confirmed in substance, and the row overstates it** (p.253): the reference says "decrease letter spacing for large text… decrease letter spacing more as text gets bigger". It frames this by *size*, not by *headings* — and notes text-type faces, used for long body, generally do not need it. Our headings are our large text, so the effect is the same, but "headings only" is a stronger claim than the source makes. No numeric values are given anywhere, so ours are ours. **`--tracking-caps` (positive, 0.06em / 0.07em) is not covered at all** — the chapter says nothing about all-caps tracking, so that token is unreconciled rather than adopted. | `mode.*.css` | `01-modes.md` | ✅ |

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
| C13 | Opacity ladder 90/60/45/10/4 light · 100/78/60/12/6 dark. **The light ladder is the reference's, to the number**: its neutral ramp is Text strong 90, Text weak 60, Stroke strong 45, Stroke weak 10, Fill 4. The dark ladder is ours — it raises every step, which the reference asks for in principle ("increase the contrast well above the minimum") without giving figures. | `brand.default.css` |  | ✅ |
| C14 | Brand + system colours: 4 variations at 100/80/20/5. **Confirmed**: the reference's tonal ramp for each semantic colour is 100% Text, 80% Stroke strong, 20% Stroke weak, 5% Fill. | `brand.default.css` |  | ✅ |
| C15 | Three elevation backgrounds, consistent across modes. **Confirmed to the number**: the reference's dark surfaces are Base 10, Raised 15, Overlay 20, which is exactly ours. | `brand.default.css` |  | ✅ |
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
| C1 | Neutrals tinted with the brand hue. **The row misread the reference, which offers both and mandates neither.** It sets "Neutral greys" — `HSB(0, 0, B)`, zero saturation — beside "Monochromatic greys" tinted with the brand hue, presented as two techniques rather than a default and a mistake. We use one in each mode: light foregrounds are black at an opacity, so neutral; dark surfaces are `hsl(var(--brand-h) 6% …)`, so tinted, though at 6% against the reference's 20–30% — a fainter tint than it draws. That is a choice inside what the reference offers, not a divergence from it. | `brand.default.css` |  | ✅ |
| C9 | Five neutral roles: text strong/weak, stroke strong/weak, fill | `brand.default.css` |  | ✅ |
| C10 | Brand colour marks **all** interactive elements, nothing else | `I-56` |  | ✅ |
| C11 | **Control borders need 3:1** (WCAG 1.4.11) | `02-tokens.md` |  | ✅ |
| C2 | Near-black on off-white. **Resolved, and the reference's position is asymmetric.** It argues against pure black — "avoid pure black as it has a high contrast against white… opt for a dark grey instead", worked at `#1A1A1A` — which `--color-text-strong` at 90% black adopts. It does **not** argue against pure white: it recommends "use white backgrounds for light mode" outright. So the off-white half is ours, not the reference's, and `C-18` already says so in as many words — "this is a house preference and it is deliberate". Narrower than the row implied, too: only `--color-bg-base` is off-white; `--color-bg-raised` is pure white. | `C-18` |  | ➖ |
| C3 | Text floor at ramp step `-700`; `-500` never text. **Confirmed, and the premise objection was half wrong.** The reference does state the floor as contrast ratios first — 4.5:1 for both text roles, 3:1 for strokes, with fills called "a decorative colour, so it doesn't need to be high contrast" — but it *also* defines a 0–1000 numbered primitive ramp, where higher means more contrast. In its own worked palette `grey.light.1000` (90%) is text-strong, `grey.light.700` (65%) is text-weak, and `grey.light.500` is stroke-strong at 3:1, non-text. So 700 is the lightest step used for text and 500 is never text — exactly this row, in the reference's ascending notation rather than our negative one. One value differs: its text-weak is 65% black, ours is 60%, which is lighter. Both clear 4.5:1 (enforced by `check-tokens` rule 5), so this is a choice inside the rule, not a breach of it. | `02-tokens.md` contrast contract |  | ✅ |
| C4 | Semantic hues **0 / 42 / 162 / 220** (error / warning / success / info). **Confirmed exactly on the three the reference defines.** It gives red `HSB(0, 71, 78)`, amber `HSB(42, 82, 56)`, green `HSB(162, 95, 48)` — hues 0, 42 and 162, matching ours to the number. It defines **no fourth** semantic colour: its component sheet shows Error, Warning and Success only, and its hue-230 token is labelled Brand, not Info. So `--info-h: 220` is ours, which `C25` already records as a deliberate fourth. Only the hues are comparable: the reference works in HSB and we work in HSL, so its saturation and brightness figures do not map onto our S and L directly. | `brand.default.css` | `02-tokens.md` | ✅ |
| C5 | Dark mode: surfaces lighten, no inversion. **Confirmed directly.** The reference builds exactly our three levels — "Base, the darkest colour for the main background… Raised, slightly brighter than the base… Overlay, slightly brighter than the raised" — matching `C15` and verified at 10% → 15% → 20% lightness. On shadows: "shadows can be difficult to see in dark interfaces, so you mostly need to rely on colour to indicate depth", which is `C16`. It also prescribes transparent foregrounds so a colour stays legible across those surfaces, which is `C12`. **The "no inversion" half is an inference, not a quotation** — the reference never warns against flipping a light palette; it constructs the two independently and requires dark to be contrast-checked on its own ("increase the contrast well above the minimum WCAG requirements for dark interfaces"), which our separate dark ladder in `C13` satisfies. | `C-21`, `brand.default.css` |  | ✅ |

## Spacing and layout

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| S7 | Four grouping tools; use the weakest that works | `A-67`, `03` |  | ✅ |
| S8 | Spacing grows outward: XS → M → L → XXL. **Confirmed as the reference's own worked sequence** (pp.195–200): innermost card text XS 8 → card padding and section content M 24 → nav links and card gutters L 32 → between major page sections XXL 80. It gives no fixed multiplier, mapping relatedness onto the scale instead. | `D-69` |  | ✅ |
| S9 | Card padding is **M (24)**, was L (32) in editorial | `mode.*.css` |  | ✅ |
| S10 | 12-column grid; gutters L→S, margins XXL→S. **Confirmed to the number, and the row describes `editorial`.** The reference gives 12 columns on desktop dropping to 4 on mobile, gutters "large (32pt)… decrease to 16pt on mobile", margins "XXL 80pt… decrease to small 16pt" — which is `editorial` exactly (32→16, 80→16, 12→4). `product` and `operator` step the gutter and margin down one and two rungs for density; the responsive shape is the same. | `mode.*.css`, `03` |  | ✅ |
| S11 | Six hierarchy variables + 3-step ordering method | `03` |  | ✅ |
| S12 | One alignment per component; start-aligned | `D-71` |  | ✅ |
| S13 | Baseline alignment for mixed-size text in a line | `D-72` |  | ✅ |
| S14 | Unbroken left edge down a text block | `D-70` |  | ✅ |
| S15 | Non-interactive must not look interactive | `C-68` |  | ✅ |
| S16 | Design for long content; crop truncation mid-string | `E-73`, `E-74` |  | ✅ |
| S17 | Squint test, with an agent-usable analogue | `03` |  | ✅ |
| --- | --- | --- | --- | --- |
| S1 | **8pt base, six options** XS 8 · S 16 · M 24 · L 32 · XL 48 · XXL 80. **Confirmed to the number** (p.192): "set simple t-shirt sized spacing options based on increments of 8 points… many popular screen sizes are divisible by 8", with exactly these six values. Our `--spacing-2xs` (4px) is covered too: "for more detailed interfaces, you could use 4 point increments for a bit more control". | `mode.*.css` |  | ✅ |
| S6 | Modes **select** options; they never define values | `mode.*.css` |  | ✅ |
| S2 | Section rhythm XXL 80 / XL 48 / M 24 | `mode.*.css` |  | ✅ |
| S3 | Card padding L 32 / M 24 / S 16 | `mode.*.css` |  | ✅ |
| S4 | Heading space-before exceeds space-after 2–3×. **Not covered by the reference.** Read the whole Layout and spacing chapter (book pages 164–218): it states the proximity principle — "place related elements close together… separate unrelated elements by placing more space between them" — and works it through a nested example, but never gives a multiplier for the space above a heading against the space below. `D-24`'s 2–3× is ours, and it is the kind of rule the reference's own principle supports without stating. | `D-24` |  | ➖ |
| S5 | Optical over mathematical alignment. **One case covered, the general principle not.** The reference gives baseline alignment for mixed-size text on a line — "align it to the baseline, rather than the vertical centre… the '/month' text is floating on its own when it's vertically centred" (p.209), which is `S13` and `D-72`. It never generalises to icons, buttons or punctuation, and never uses the term. `D-27`'s broader claim is ours. | `D-27` |  | ➖ |

## Form and elevation

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| F1 | Control heights 48 / 40 / 32px. **Four chapters give no visual control height — but the Buttons chapter creates a real tension.** It states the target minimum twice, once as "make buttons at least 48pt by 48pt in size… slightly larger than the WCAG recommendation of 44pt by 44pt", and illustrates it with a stepper marked bad at 32pt × 24pt against good at 48pt × 48pt. Read as *rendered size*, that fails our `operator` (32px) and `product` (40px) controls. Read as *target area*, all three pass, because `--size-touch-target` is 48px in every mode and `P-02` requires the hit area to reach it regardless of visual height. We take the second reading, and it is a genuine interpretation rather than a match: the reference never separates the two the way we do. Worth revisiting if a later chapter distinguishes them. | `mode.*.css` |  | ➖ |
| F7 | Touch target **48px** all modes (was 44px) | `mode.*.css` |  | ✅ |
| F8 | Stepper over select for small numeric ranges | `P-03` |  | ✅ |
| F9 | Split forms beyond ~3 question groups into steps | `P-04` |  | ✅ |
| F2 | **Three radii: 8 / 16 / 32px** by element size | `brand.default.css` | `01-modes.md`, `00-anti-patterns.md` | ✅ |
| F3 | **Two shadows: raised, overlay.** Stroke still preferred | `brand.default.css`, `A-08` |  | ✅ |
| F4 | Help text **before** the control. **Duplicate of `R4`, which reconciled it.** The Forms chapter is explicit: hints go above the field, so a password's length rule arrives before typing rather than after failing, and because autofill menus and on-screen keyboards cover the space below. `P-03` carries both reasons. | `P-03` |  | ✅ |
| F5 | Validate on blur, revalidate on change. **Confirmed.** The reference prescribes none of the three approaches on its own, but pairs blur validation with keystroke validation explicitly and for one purpose — "remove the error message once the error has been resolved... this involves using the third validation approach". That is exactly `F-38`, and it is why the keystroke half is scoped to fields that have already failed rather than applied from the first character. | `F-38`, `P-04` |  | ✅ |
| F6 | Table row 36px operator / 48px product. **Not covered.** Tables appear in the Layout chapter only as worked examples, with no row height stated anywhere, and the Forms chapter has no tables. Ours. | `mode.*.css` |  | ➖ |
| F10 | **Unbranded radius default stays 8 / 16 / 32.** Considered 4 / 8 / 16 on the grounds that radius is the loudest carrier of brand character and the default should be as visibly provisional as the near-black accent. Rejected: radius has no null value, so a lower default is a different opinion rather than an absence — 0px reads brutalist, 4px reads technical, none reads as "undecided" the way near-black does. The value that actually asserted character was `--radius-lg` (32px), and no mode selects it. | `brand.default.css` | `01-modes.md`, `00-anti-patterns.md` | ✅ |

## Motion

| # | Current default | Where | Also documented in | Status |
| --- | --- | --- | --- | --- |
| M1 | 250 / 150 / 100ms base per mode. **This reference has no motion chapter**, confirmed by its owner. Four chapters read — Colour, Typography, Layout and spacing, Buttons — gave no duration in ms or seconds anywhere; the closest is "make sure the animation is quick and subtle, so it doesn't get in the way of the user completing their task". **A second source was read in full and gives no number either** (see "The second source, on motion" below): it names duration as one of four building blocks of motion and says timing should differ by context — "consistency doesn't mean everything we do should move with the same timing for the same duration through every screen" — which is an argument for varying duration per mode, but never states a value. The numbers stay ours, now on the second source's reasoning rather than for want of one. | `mode.*.css` |  | ➖ |
| M2 | Entrance animation: editorial first viewport only. **Not in this reference**, same as `M1`, and the second source has no scroll- or load-triggered entrance policy either. It does argue the underlying principle: motion earns its place by explaining a change of state, and "every animation serves a meaningful purpose" — which is `G-42`'s reasoning, not a viewport rule. The first-viewport scope is ours. | `01-modes.md`, `G-42` |  | ➖ |
| M3 | **Easing direction is now stated.** We shipped `--ease-out` and `--ease-in-out` in every mode with no rule for choosing between them — a token pair with no usage guidance, which is the same failure as a pointer that leads nowhere. The second source gives the rule directly: "ease-out objects that are entering or gaining attention, and ease-in objects that are leaving and losing attention", because natural forces accelerate and only lightning appears instantly. Adopted in `02-tokens.md`, with one deliberate difference: we ship no pure `--ease-in`, so exits take `--ease-in-out`. Exits here fade or collapse in place rather than fly off screen, and a third easing token bought only that case. | `02-tokens.md` | `mode.*.css` | ✅ |


### The second source, on motion

The primary reference has no motion chapter, so a second one was read in full for
`M1`–`M3`: a freely published handbook on animation in product design, at
<https://uxlib.net/onlinebooks/animation/index.html>. It is qualitative from end to
end — **it contains no duration, no frame count and no timing curve anywhere in its
text**, which is why `M1` closes as ours rather than as adopted. What it does supply
is reasoning: easing direction (`M3`), duration as one of four named building blocks
alongside behaviour, easing and sequencing, and a minimum-duration argument from
assistive technology — a screen reader must have time to announce a notification
before it leaves the screen, which is a floor on duration rather than the ceiling
`G-44` states.

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
| B3 | Button shape 3:1, text 4.5:1, 3:1 between same-styled buttons. **Confirmed verbatim** (p.302): "the contrast ratio of the button shape must be at least 3:1… the button text contrast ratio must be at least 4.5:1… if buttons have identical styles, the contrast ratio between them must be at least 3:1." | `P-02`, `E-91` |  | ✅ |
| B4 | Hierarchy through structure, not hue | `E-91` |  | ✅ |
| B5 | Equal importance → equal prominence (both secondary) | `P-02` |  | ✅ |
| B6 | One shape across all weights. **Confirmed for primary and secondary** — "elements that function the same should look the same. Avoid inconsistent button shapes as they can cause confusion." Tertiary is outside it by construction: in this system a tertiary button is underlined text with no rectangle, so it has no corner radius to match. | `E-93` |  | ✅ |
| B7 | Label is verb + noun | `P-02` |  | ✅ |
| B8 | 16px minimum between adjacent buttons. **The reference gives two numbers and we took the stricter.** Its stated guideline is "separate buttons by at least 8pt" (p.318); its author's own habit is "I usually use 16pt to be safe" (p.302). `P-02` calls 16px a minimum, which is stricter than the reference's minimum rather than equal to it — fine as a house floor, but the row should not imply the reference sets it there. | `P-02` |  | ✅ |
| B9 | Start-aligned, most→least important; mobile stacks full-width | `P-02`, `E-95` |  | ✅ |
| B10 | Multi-step "Back" is tertiary, top left | `P-02`, `E-95` |  | ✅ |
| B11 | Single-field forms may attach the button to the field | `P-02` |  | ✅ |
| B12 | Three alternatives to disabling, in order | `E-32`, `P-02` |  | ✅ |
| B16 | **Undo beats friction for destructive actions** — "even with added friction, mistakes will still be made… consider allowing people to undo or reverse destructive actions. This generally takes more time and effort to implement, but it removes a lot of risk." Tiebreaker 3 ("recoverable beats correct") says the same thing and was written independently. | `04-principles.md` |  | ✅ |
| B17 | **Heavy friction is a required checkbox**, not a typed confirmation: "use red and include a checkbox. The checkbox must be selected before the destructive action can occur." `04-principles.md` Tiebreaker 3 asks `operator` to "confirm by typing", which is stricter than the reference and stays ours — typing the resource name defeats muscle memory in a way a checkbox does not, which matters most in the mode where the same dialog is met daily. | `04-principles.md` |  | ➖ |
| B13 | Disabled buttons stay keyboard-focusable | `E-32` |  | ✅ |
| B14 | **Destructive is tertiary at rest, red only on confirm.** **Confirmed, and the reference grades what our row flattened.** Tertiary at rest and "don't colour the action red" both hold. But red is not simply "on confirm": there are three levels. *Light friction* — "simply ask people to confirm" — keeps the confirming button **brand-coloured, not red**. *Moderate* highlights the confirmation in red. *Heavy*, for very destructive actions, is red **plus a checkbox that must be ticked before the action can occur**. `E-94` now carries the table. It also says "consider allowing people to undo or reverse destructive actions… it removes a lot of risk", which is Tiebreaker 3 arriving from the other direction. | `E-94`, `P-02` |  | ✅ |
| B15 | Icon/text balance via weight, size, then contrast | `D-96` |  | ✅ |

## Forms

Reconciled against the Forms chapter in full. `R1`–`R17` below were settled in an
earlier pass; re-checked on 2026-09-10 against the chapter text and every one
still holds. `P-03`, `P-04` and `P-12` carry the chapter closely enough that the
worked examples survive — the four-character postcode field, expiry-date and CVC
side by side, industry→occupation as two dependent fields, the "Yes," test for
checkbox phrasing.

**The correction the validation pages produced.** `P-03` placed the hint above
the input and the error after it — while giving, as the reason for the hint,
that "the space below an input gets covered by autofill menus and on-screen
keyboards". The reference applies that same reason to the error, and more
sharply: an error appears at the moment a keyboard is open. Half an argument had
been adopted and the other half left on the page. The error now sits above the
input too, after the hint. See `R23`.

**The one spacing divergence found on re-check.** The chapter's spacing diagram pairs a
4pt label gap with 32pt between fields. `--spacing-label` is 4px, matching
exactly; `--spacing-stack` is 16px in `product` and `operator`, 24px in
`editorial`. The principle the diagram argues — a label must sit visibly closer
to its own input than to the field above — holds at every one of those (a 4×
ratio at the tightest), but the absolute gap is smaller than the reference
draws. Recorded as ➖ in `R18` rather than adopted: the ladder is shared, and
widening field spacing to 32px everywhere would push `operator` off its own
density.


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
| R18 | Field-to-field spacing 16px (`product`, `operator`) / 24px (`editorial`), against the reference's 32pt. The label gap matches at 4px, and the closer-to-its-own-input principle holds at every mode. Kept tighter because the spacing ladder is shared across modes and 32px everywhere would cost `operator` the density that defines it. | `mode.*.css`, `P-03` |  | ➖ |
| R19 | Single-column layout, with all three of the chapter's reasons: no decision about what to fill next, nothing missed, and screen-magnifier users cannot lose a second column | `P-04` |  | ✅ |
| R20 | Minimise fields; prefer an opt-in to an optional field | `P-04`, `P-11` |  | ✅ |
| R21 | Group related fields under `<fieldset>`/`<legend>` headings | `P-04` |  | ✅ |
| R22 | Conventional field styling; field borders clear 3:1 | `P-03`, `E-52` |  | ✅ |
| R23 | **Error message above the input, not below** — corrected on 2026-09-10. `P-03` had it after the input while placing the hint above, and cited "autofill menus and on-screen keyboards cover the space below" as the reason for the hint. That reason applies at least as strongly to an error, which appears at the exact moment a keyboard is open. Half an argument had been adopted. | `P-03` |  | ✅ |
| R24 | Error summary states the **count** and links to each failed field | `P-04` |  | ✅ |
| R25 | Never disable the submit button to block an invalid submission — a disabled control cannot be focused, so it cannot explain itself | `E-32`, `P-04` |  | ✅ |
| R26 | An invalid field is marked by border, background tint, icon **and** text together | `P-03`, `C-20` |  | ✅ |

## Also worth capturing

The reference will contain reasoning this system has no place for — why a rule holds, what it trades against, when it breaks. That belongs in your head, not in these files. If a piece of reasoning changes a *decision*, change the value. If it only explains one, leave the files alone.
