# Coverage ledger

`RECONCILE.md` answers *"we have a value — does the source agree?"* Its second
column is `Current default`, and it has served 154 rows.

This file answers the other question: **"the source covers something — do we?"**
There is often no current default to put in a column, and "adopt or diverge" is
the wrong question when the honest answer is "we do not cover this at all."

One row per position the source takes. The column that does the work is
**Where we stand**, and most rows end without a change to the corpus. That is the
point: a source is persuasive by construction, and most of what it says is
already covered, out of scope, or too vague to act on. A ledger that adopts
everything is not reading, it is copying.

**Status:** `covered` · `adopted` · `diverged` · `out of scope` · `open`

- **covered** — the corpus already says this. Cite the id. No change.
- **adopted** — a new entry was created. Cite the new id.
- **diverged** — we say something different on purpose. The reason goes in the
  row, in one line. A divergence that is not argued is drift.
- **out of scope** — true, and not Jig's subject.
- **open** — not yet decided.

Sources are never named here, for the same reason they are never named anywhere
else in this repository: the material is not ours to redistribute. Each is
described by what it is and how much of it has been read.

---

## Source A — typography, 33 numbered laws in five sections

Read: all five sections, 33 laws, on 2026-09-13. Complete.

| # | The source's position, in our words | Where we stand | Status |
| --- | --- | --- | --- |
| A1 | Do not accept a tool's default settings; they are tuned for the median user, not this work | Jig's whole premise, but about design systems rather than software preferences. The print half (RGB vs CMYK) is not our subject | out of scope |
| A2 | Text needs contrast against its background to be legible; pure black on pure white is harsh for sustained reading | `C-18` pure black on pure white, `C-19` grey below the floor, `T-08` the contrast contract | covered |
| A3 | Strip anything from a chart or page that does not carry information | `A-59` repeated information, `A-58` decorative styling that implies meaning, `A-67` a container around every group. Chart-specific junk is not covered — Jig has no chart pattern | covered |
| A4 | Two typefaces maximum, one for headings and one for body | `B-76` more than two typefaces, and it goes further: one sans for everything is the stated default | covered |
| A5 | Cap the palette at about five well-balanced colours | We answer this with semantic tokens instead of a count. A number would be the wrong shape — five greys and one accent is fine, five accents is not, and the count cannot tell them apart | diverged |
| A6 | Place emphasis so the eye is led through the page in order of importance | `L-01` step 2 — six variables carrying hierarchy, sections ordered before elements | covered |
| A7 | Group related elements with white space; less space within a group than between groups | `L-01` step 1 (four grouping tools ranked by cost) and `D-25` no proximity hierarchy | covered |
| A8 | Body text on the web: 16px maximum, 12px minimum used sparingly | **We say the opposite for long-form.** `B-75` sets `--text-prose` at 18px and reserves 16px for UI text read in glances. Kept: people read at roughly arm's length on every device, so a maximum of 16px optimises for the designer's screen rather than the reader's distance. The source is writing primarily for print, where the page distance is fixed | diverged |
| A9 | Line length of 50–75 characters including spaces | `B-11` unbounded line length, and `--measure-prose` at 60ch (product), 68ch (editorial), 72ch (operator) — inside the range at every mode | covered |

| A10 | Flush-left, ragged-right body text; never justified | `B-12` centred or justified body text | covered |
| A11 | One space after a sentence, not two | Not our subject — a typing habit, invisible in rendered HTML, which collapses whitespace | out of scope |
| A12 | Never leave fewer than seven characters alone on a line (an orphan) | `B-106` — adopted as one rule with `A13` and `A14`, since they are one failure with one fix | adopted |
| A13 | Avoid a paragraph's last line stranded alone (a widow) | `B-106` | adopted |
| A14 | Do not let a hyphen be the last character on a line | `B-106` | adopted |
| A15 | Signal a new paragraph once — blank line **or** indent, never both | The web default is a blank line and indents are rare, so there is no failure to prevent. A rule with no failure mode is context cost | out of scope |
| A16 | Break long text into paragraphs, roughly every five lines | `I-80` long text without a structure | covered |
| A17 | Emphasise a tenth of the text or less | **Nothing covers this.** `B-77` caps how many weights exist, not how much text carries them; `C-50` is about colour on headings. The reason is good: emphasis works by contrast with unemphasised text, and past a point there is nothing left to contrast against | open |
| A18 | Avoid all caps; avoid underline, which reads as a link on the web | `B-16` all-caps for anything long, `I-85` UPPERCASE, and `C-49` link treatment for the underline half | covered |
| A19 | Set acronyms in small caps | `I-84` covers acronyms as a copy decision. Small caps specifically is a print refinement — `font-variant: small-caps` is poorly drawn in most UI faces | out of scope |
| A20 | Hang punctuation off the aligned edge in small blocks | `D-27` optical alignment ignored covers the principle. `hanging-punctuation` has almost no browser support, so the CSS half is not actionable | covered |
| A21 | Hang numbers and bullets in lists | Browser default for `<ul>`/`<ol>`. No failure to prevent | out of scope |
| A22 | Set line breaks manually rather than letting margins decide | Directly wrong for responsive UI, where the margin *is* the variable. A manual break is a bug at the next viewport width | diverged |
| A23 | Use symbols and special characters, encoded so every browser renders them | Encoding, not design | out of scope |
| A24 | Old-style figures in prose, tabular figures where columns align | `P-06` — numeric columns right-aligned with tabular figures (`--font-numeric`). The old-style half is a refinement Jig has no token for and has not needed | covered |
| A25 | Large text needs its leading and tracking adjusted; it does not scale linearly | `B-13` one line-height for everything is exactly this failure | covered |
| A26 | Trust your eye over the software's alignment | `D-27` optical alignment ignored | covered |
| A27 | Em dash to join thoughts; en dash for ranges, unspaced; hyphen for compounds | Nothing in `05-copy.md` covers dashes. Real, small, and genuinely decidable — a date range written with a hyphen is wrong and checkable | open |
| A28 | Prime symbols for feet and inches, not quote characters | Unit notation, and rare in product UI | out of scope |
| A29 | Apostrophes mark omission, never plurals | Spelling, not design | out of scope |
| A30 | Two typefaces per project, one heading and one body | `B-76`, already recorded as `A4`. **The source repeats itself** — laws 4 and 31 are the same position | covered |
| A31 | Let the typeface carry the document's mood; never Comic Sans, Papyrus, Jokerman, Curlz | Font choice is the project's, set once in the brand file. A blocklist of four faces is not a rule, it is a joke with a long tail | out of scope |
| A32 | Pair a serif and a sans by judgement, not by formality | Jig's stated default is one sans for everything (`B-76`), on the grounds that it keeps content rather than lettering in focus. A pairing is allowed, not encouraged | diverged |

**32 positions read, 3 adopted, 2 open.**

The four open rows are the ledger doing its job — they are candidates, not
entries. Minting a rule needs more than a source agreeing with itself: `S4`
requires a detector or a stated self-check question and a `pass`, and
`AGENTS.md:32` requires the twice-run control showing the output actually
changes. `B-105`, the last rule added, took a release and a measurement.

`A12`–`A14` became **`B-106`** — one rule, not three, because they are one
failure (a word stranded at the end of a block) with one fix family
(`text-wrap: balance` / `pretty`). They only became admissible when `critique`
learned to render: where a line breaks cannot be judged from a stylesheet, so
`B-106` carries `pass: screen`. The capability arrived before the rule that
needed it, which is the right order.

Admitted on evidence, per `AGENTS.md:32`. Two cold agents built the same hero
section from identical briefs, one arm with the rule and one without:

| | `text-wrap` in the CSS | cites `B-106` |
|---|---|---|
| with the rule | `balance` on the heading, `pretty` on the paragraph | yes, in a comment |
| control | **none** | never mentioned |

So it is not the model's default, and it does change the output — the two things
that decide whether a rule earns its context cost.

`A17` (emphasis ≤ 10%) and `A27` (dash usage) stay open, and the reasons differ.
`A17` rests on an unreconciled number, where this system's convention is a reason
rather than a threshold. `A27` is real and small, and it is hard to argue a dash
convention changes what an agent builds — which is the same test `B-106` had to
pass.

---

## What this source was worth

32 positions across five sections: **14 covered**, each citing the id that
covers it; **9 out of scope**, mostly print and word-processor concerns that do
not survive contact with a browser; **4 argued divergences**; **5 left open**.

**No new rules.** That is a successful read, not a failed one. The corpus was
confirmed on 14 points by a source that had never seen it, contradicted on 4
where we have a reason, and shown one genuine blind spot — line breaking — that
nothing in `00`–`05` has ever addressed.

A ledger that adopted all 32 rows would have doubled the typography section with
restatements of `B-12`, `B-13`, `B-16`, `B-76` and `I-80`, and buried the one
finding that matters.

---

## Source B — design principles, 150 numbered cross-disciplinary entries

Read: all 150 headwords and definitions, plus the full text of the entries that
survived triage, on 2026-09-14. It has a text layer, so `render-reference.mjs`
was not needed — that script exists for a source that has none.

### Triage first, because most of it is not about interfaces

The criterion: **does this change what an agent builds in a UI?** Applied to
headword and definition, it puts 93 of 150 out of scope before any reading:

| not our subject | n |
|---|---|
| cognition with no UI decision attached — priming, mere exposure, flow, uncanny valley | 40 |
| faces, bodies, attractiveness | 9 |
| engineering and physics — safety factors, golden ratio, self-similarity | 8 |
| architecture and environment — cathedral effect, defensible space, savanna preference | 7 |
| colour folklore — "red effects", "blue effects" | 6 |
| process and organisation — development cycle, design by committee, prototyping | 10 |
| **persuasion techniques** — see below | 13 |

That last group is not "out of scope" in the same sense, and it is the most
interesting thing in the source.

### The persuasion cluster — deliberately not adopted

Thirteen entries teach, neutrally, how to change behaviour without changing
incentives: scarcity, reciprocity, framing, operant conditioning, the left-digit
effect, supernormal stimulus, sunk cost, the Veblen effect. They are accurate.
They also describe, almost exactly, what an agent produces when asked to "make
the landing page more compelling": *Only 3 left. 2,847 developers joined this
week. Was £99.*

**Jig has no principle forbidding this, and that is a gap this source found by
arguing the other side.** `A-09` catches marketing voice and `A-10` catches
placeholder content, but neither says a system must not manufacture urgency it
does not have. An agent reading these thirteen entries as guidance would be
following the source correctly and building something Jig should refuse.

Recorded as open (`B58`) rather than adopted, because a principle is the right
shape for it and principles are `R-`, not a rule in `00`.

### The 57 that survived

| # | The source's position, in our words | Where we stand | Status |
| --- | --- | --- | --- |
| B01 | A small share of causes produces most effects; design for the common path | `R-05` optimise for the common path | covered |
| B02 | Design to be usable by as many people as possible without modification | `R-01` minimise usability risk, WCAG AA as floor | covered |
| B03 | Attractive things are *perceived* easier to use than they are | Nothing says this. It cuts against `R-02` — if beauty buys perceived usability, "it looks better" becomes tempting again. Useful as a caution, not actionable as a rule | out of scope |
| B04 | A thing's form suggests how it is used | `E-52` unconventional controls, `C-68` non-interactive styled as interactive, `E-31` hover-only affordances | covered |
| B05 | Elements aligned on common edges or axes are perceived as ordered | `D-70` broken left edge, `D-71` multiple alignments | covered |
| B06 | Align by optical area, not by bounding box | `D-27` optical alignment ignored | covered |
| B07 | Group units of information so they can be held in mind | `L-01` step 1, `D-25` no proximity hierarchy | covered |
| B08 | The eye completes interrupted forms | Gestalt closure. `L-01` uses four tools and this is not one of them; in UI it rarely decides anything on its own | out of scope |
| B09 | Things that move together are perceived as related | **Common fate — a fifth grouping tool `L-01` does not have.** Its table ranks continuity, similarity, proximity and common region by cost. Motion as a grouping cue is real in UI (a row and its detail panel animating together) and absent here | open |
| B10 | Show relationships by depicting information under controlled comparison | Charts. Jig has no chart pattern, by choice | out of scope |
| B11 | Require verification before an action is carried out | `R-08` recoverable beats correct, and its irreversible-operation exception; `P-07` dialog | covered |
| B12 | Similar things should mean and behave similarly | `H-46` local convention overridden, `B-15` ad-hoc type sizes, `D-26` one padding value | covered |
| B13 | Limit what a user can do to prevent error | `F-40` missing input affordances, and `R-08` argues the other way round — prevention is the second choice after recovery | covered |
| B14 | Match the level of control to the user's proficiency | `R-09` optimise for who is actually there; mode encodes it | covered |
| B15 | Value is benefit set against the cost of acquisition and use | `R-03` minimise interaction cost | covered |
| B16 | The entry point sets the emotional tone for everything after it | Nothing covers this as a principle. `P-05` empty state and `E-30` touch the first-run case. Weak on its own — "set the tone" is not decidable | out of scope |
| B17 | Errors are slips or mistakes; design for both | `F-37` unhelpful error text, `R-06` prefer the loud failure, `R-07` never destroy on suspicion | covered |
| B18 | Features accumulate past the point of usefulness | `R-10` restraint is the default | covered |
| B19 | Output that feeds back as input, changing what follows | `P-01` feedback placement | covered |
| B20 | Elements are read as figure or as ground | Underpins contrast and `C-19`, but states no decision of its own | out of scope |
| B21 | Time to hit a target falls as it grows and nears | `R-03`, which cites Fitts by name | covered |
| B22 | Information can be organised five ways: location, alphabet, time, category, hierarchy | **Nothing covers how to order a list, a nav or a table.** An agent choosing an order today has no guidance, and picks the order the data arrived in. This is the most useful gap the source found | open |
| B23 | Flexibility costs usability; a thing that does everything does nothing well | `H-45` new component instead of the existing one, and `R-10` | covered |
| B24 | Help people avoid errors, and protect them when they happen anyway | `R-07`, `R-08` | covered |
| B25 | Function before aesthetics | `A-58` decorative styling that implies meaning | covered |
| B26 | The eye follows a line's established direction | `L-01` continuity, first of the four tools | covered |
| B27 | Reading gravity runs top-left to bottom-right; the bottom-right is the terminal area where the primary action belongs | **We say the opposite.** `E-95` start-aligns the primary action: right-aligned actions get missed on wide screens and by screen-magnifier users, and sit further from the fields they submit. The source is describing a printed page, which has neither a variable width nor a magnifier. Kept — and `R-01` says an accessibility reason does not yield | diverged |
| B28 | Decision time rises with the number of options | `R-03`, which cites Hick by name | covered |
| B29 | Hierarchy is the simplest way to show complex relationships | `L-01` step 2, `B-17` skipping heading levels | covered |
| B30 | Highlight to focus attention, sparingly — heavy highlighting defeats itself | **Reopens `A17`.** A second source, independent of the first, on the same position: emphasis works by contrast and stops working when it is everywhere. Two sources agreeing raises this from a stray number to a candidate | open |
| B31 | The urge to fill empty space | `A-67` a container around every group, `R-10` | covered |
| B32 | Pictures aid recognition and recall | `E-51` icon without a visible label, `E-34` icon-only controls without names — both the *limits* of this | covered |
| B33 | An unexpected thing in clear view can go unseen | `E-61` important navigation hidden when it fits is adjacent but not the same claim. Not decidable without a user | out of scope |
| B34 | Put the most important information first | `I-54` text that buries the point | covered |
| B35 | The eye prefers simple, complete, regular forms | States no decision | out of scope |
| B36 | Stack information in layers to manage complexity | `P-11` progressive disclosure | covered |
| B37 | Text clarity from size, typeface, contrast, spacing | `B-11`, `B-75`, `C-19`, `T-08` | covered |
| B38 | Controls should map, in layout and movement, to what they control | **Nothing covers this.** A control for the left panel belongs on the left; a slider that increases should move the way the value moves. Real and decidable, and agents get it wrong in toolbars | open |
| B39 | People act on a mental simulation of how a thing works | `E-52` unconventional controls is the failure case | covered |
| B40 | Divide a large system into small self-contained parts | `L-02` building modularly — primitives, composites, templates | covered |
| B41 | Prefer the simpler design | `R-10` restraint is the default | covered |
| B42 | Mental and physical effort required to complete a task | `R-03`, `R-04` minimise cognitive load | covered |
| B43 | Show only what is needed, when it is needed | `P-11` progressive disclosure | covered |
| B44 | Near things are read as related | `L-01` proximity, `D-25` | covered |
| B45 | Ease of understanding, from word and sentence complexity | `I-80` long text without a structure, `I-79` padding words | covered |
| B46 | Recognising is easier than recalling | `E-34` icon-only controls without names is one case of it; the principle is not stated. Adding it would restate the rule it produced | covered |
| B47 | Back-up elements maintain performance when one fails | Systems engineering | out of scope |
| B48 | What works at one scale fails at another | `E-73` interface built only for short content is the content-scale half. The viewport half is `B-106`'s neighbourhood and `RESPONSIVE`-shaped | covered |
| B49 | First and last in a sequence are best recalled | `L-01` step 2 states exactly this, about a price beside the primary action | covered |
| B50 | Ratio of relevant to irrelevant information | `A-59` repeated information, `A-58` | covered |
| B51 | Alike things are read as related | `L-01` similarity | covered |
| B52 | Visual equivalence across an axis | `D-71` multiple alignments in one component | covered |
| B53 | Things connected by lines or boxes are read as related | `L-01` common region, ranked last for its clutter cost | covered |
| B54 | Things in clear view are more likely to be used | `E-61`, `E-62` off-screen content with no affordance, `E-31` | covered |
| B55 | Uncommon things are recalled better | Same candidate as `B30` — the mechanism behind emphasis working | open |
| B56 | People need to know where they are, where they can go, and how to get back | **Nothing covers this.** `E-61` says navigation must not hide when it fits; nothing says a screen must answer *where am I*. For a multi-page site that is a real omission, and `jig explain "where am i"` returns nothing | open |
| B57 | An interrupted task produces intrusive thoughts until it is finished | `P-08` loading, `E-30` empty states — the UI halves of it | covered |
| B58 | Thirteen entries teaching persuasion: scarcity, reciprocity, framing, conditioning, left-digit pricing, sunk cost | **No principle forbids manufacturing urgency.** `A-09` and `A-10` are adjacent and narrower. An agent following these thirteen would build what Jig should refuse | open |

**58 positions read, 0 adopted, 7 open.**

### What this source was worth

150 entries, 93 triaged out before reading, 58 rowed, **0 adopted, 7 open, 1
argued divergence.**

The divergence is the sharpest thing in it. `B27` puts the primary action in the
bottom-right terminal area, which is right for a printed page and wrong for a
screen of variable width read by someone using magnification — the reason `E-95`
already gives. A source disagreeing with us on a point we can defend is worth
more than one agreeing.

Four of the seven open rows are genuine gaps rather than candidates needing
argument: **how to order information** (`B22`), **control-to-thing mapping**
(`B38`), **wayfinding** (`B56`), and **a principle against manufactured urgency**
(`B58`). None is typography, spacing or colour — Jig's dense areas. All four are
about structure and intent, which is where a system built from anti-patterns
would be thin, and is exactly what the six-layer restructure predicted.

`B30` and `B55` reopen `A17` from the typography source. Two independent sources
now take the same position on emphasis, which is the difference between a stray
threshold and a candidate.
