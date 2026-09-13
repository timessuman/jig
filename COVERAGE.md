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

Read so far: sections 1–2 (laws 1–8) on 2026-09-13.

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

**Nine positions read, none adopted.** Seven were already covered or
out of scope, and two are argued divergences. Worth stating plainly, because a
source that produces no new rules has still done its job — it has confirmed seven
existing positions and disagreed usefully on two.
