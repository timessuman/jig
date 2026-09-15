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

## Candidates tested and rejected — 2026-09-14

Five candidates from both sources were drafted as rules, indexed, and run through
`AGENTS.md:32`'s control. **None was admitted.** Recorded here because a rejection
is a result, and the next person to reach for these should not have to re-run the
experiment to find out.

The task: a pricing page with site navigation for the project used in the control
runs — chosen because it gives all five somewhere to appear. Two cold agents,
identical briefs, same model, sealed corpora (a separate CLI build per arm, so the
control's binary could not serve a rule its markdown lacked).

| candidate | treatment | control | verdict |
|---|---|---|---|
| wayfinding — mark the current location | current nav item marked | **also marked**, `aria-current` plus underline and weight | already the model's default |
| control-to-thing mapping | billing switch immediately above the plans | **same position** | no difference |
| ordering — name the order you chose | named "ordered by price ascending" in its notes | did not mention ordering | both produced the same order; only the commentary differed |
| urgency the product cannot evidence | none produced | none produced | never exercised |
| emphasis spread until it stops meaning anything | no inline emphasis at all | no inline emphasis at all | never exercised |

### What each rejection means, separately

**Wayfinding and control mapping are the model's defaults — at the top of the
capability curve.** `AGENTS.md:32` is explicit about what to do with a rule whose
behaviour appears without it: delete it, or it is context cost charged on every
task for nothing. These two were the most confidently drafted of the five, which
is the useful part — confidence in drafting predicted nothing.

> **These three rejections are provisional.** Both arms ran on the strongest
> model available. Jig installs into four harnesses where the model is the user's
> choice, much of it a cheap tier, so "the strong model needs no rule" is not
> "Jig needs no rule." A strong model producing the behaviour unaided is evidence
> the *position is correct*; whether the *rule* is needed is decided at the floor,
> and the floor was never run. Pending that, `B22`, `B38` and `B56` stay `open`
> above rather than moving to a closed status.

**Ordering failed on a strict reading, and the strict reading is right.** Both
arms ordered the plans cheapest-first. The rule changed what the agent *wrote
about* the page, not the page. A rule that improves an agent's notes and leaves
the artifact identical has not earned its place in a file that is loaded on every
task.

### A gap is not a rule — a correction to how these were framed

The principles read described four of these as "genuine gaps — not candidates
needing argument." That framing was wrong, and this section is the evidence.

A gap is a fact about the corpus: grep it, run `jig explain`, nothing comes back.
Every one of these rows is still `open` above, because that fact has not changed.
Whether a rule earns a place is a different question, answered only by running the
task without it. The model carries defaults nobody wrote down, so corpus silence
predicts nothing about output. `jig explain "where am i"` returns nothing and the
control still shipped `aria-current` with underline and weight.

The two ledger states are therefore separate and both true: **open** means the
corpus says nothing, **tested and rejected** means the silence costs nothing.
A row can be the first without being a candidate for the second.

**Urgency and emphasis were not tested.** A pricing page with a two-sentence
intro gives emphasis nowhere to appear, and the project's `DECISIONS.md` — which
records a real owner decision against unmeasured superlatives — suppressed the
urgency behaviour in both arms. Both are still open. Testing them needs a task
that tempts them: long-form prose for emphasis, and a brief that asks for
persuasion without a decisions file already forbidding it.

### On the harness

Two flaws, one fixed and one found:

- **Fixed:** each arm had its own CLI build this time, so the control could not
  reach a stripped rule through `explain`. The previous round could only report
  that the escape hatch went unused.
- **Found:** the sandbox instruction confined each agent to its project
  directory while the CLI sat one level above it, so `jig check` ran in neither
  arm. Both attested `mechanical=skipped:0` rather than claiming a pass —
  correct behaviour by both agents, and a setup mistake. This round tested the
  judgment half only.
