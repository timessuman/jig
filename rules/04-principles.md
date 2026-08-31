# 04 · Principles

**Status:** draft v0.2
**Read when:** no rule covers the situation (Part 1), or two rules conflict (Part 2).

Two kinds of principle, doing opposite work.

**Part 1 — Frames (five).** Generative. Use these to find the rule that does not exist yet. `00`–`03` cover known failures; these are the method for recognising a new one. Adapted from the foundations in *Practical UI* (Adham Dannaway).

**Part 2 — Tiebreakers.** Adjudicative. Use only when two existing rules point in different directions.

If you reach for Part 2 often, the rules in `00`–`03` are underspecified and that is where the fix belongs. If you reach for Part 1 often, you are doing novel work, which is correct.

---

# Part 1 · Frames

## Frame 1 — Minimise usability risk

**Ask: who could struggle with this, and why?**

Design decisions are risk decisions. Almost every appealing choice carries a risk that somebody finds it harder to use:

| The appealing thing | The risk |
| --- | --- |
| Thin, light-grey text | Unreadable with low vision, in sunlight, on a poor screen |
| Icons without labels | Meaning unavailable to anyone who does not know the glyph |
| Coloured heading text | Reads as a link; invites a click that does nothing |
| A subtle, borderless control | Not recognised as interactive |
| Placeholder instead of label | Disappears exactly when it is needed |

The risk is rarely to the median user. It falls on people with reduced vision, low computer literacy, limited dexterity or reduced cognitive capacity — and on ordinary users in bad conditions, which is most conditions. You will usually not know who is on the other side, so design for the widest range you can.

**Use it like this:** for any decision no rule covers, name who could struggle and why. If the answer is uncomfortable, take the safer option. If the risk is real and recurring, it is a new rule — add it to `00`.

**Floor:** WCAG 2.1 level AA. Meeting AA is the starting point, not the achievement.

## Frame 2 — Every detail has a reason you can state

**Ask: why this way rather than another way?**

Some elements are decorative. Everything else should have a rationale you can articulate — not "it looks better", which is an opinion and cannot be discussed, tested, or handed to someone else.

This is the test every rule in this system had to pass, and it is why the token files hold resolved numbers rather than ranges. A range defers the decision to whoever reads it next; a number is a decision that can be argued with.

**Use it like this:** when you make a call the rules do not cover, state the reason in one line. If you cannot, you are guessing — and a guess should be surfaced as a question, not shipped as a decision (Tiebreaker 5).

## Frame 3 — Minimise interaction cost

**Ask: what does this cost the user, counted?**

Interaction cost is the total physical and mental effort to complete a task: clicks, scrolls, pointer distance, keystrokes, waiting, reading, and anything the user must remember or go and find. Its virtue is that it is **countable**, which makes it the most checkable idea in this file.

Three reliable reductions:

1. **Keep related actions close, and targets large.** Per Fitts's law, time to hit a target falls as it gets nearer and bigger. Put the action beside the thing it acts on; keep targets at `--size-touch-target` or larger. Start-aligning the action also keeps it visible to screen-magnifier users.
2. **Cut distraction.** Banners, autoplay, unsolicited dialogs — cost charged against a task the user did not choose to pause.
3. **Cut choices.** Per Hick's law, decision time rises with the number and complexity of options. Fewer options, or a promoted recommended subset, produces faster decisions.

**Use it like this:** count before and after, and state it. "3 clicks + 1 scroll → 2 clicks" is reviewable. "Improved the UX" is not. See `P-10`.

## Frame 4 — Minimise cognitive load

**Ask: how much thinking does this require that is not the user's actual task?**

Attention spent decoding the interface is unavailable for the work. Reliable reductions:

- Remove styles, information and decisions that carry no meaning.
- Break information into smaller groups, so relationships are visible rather than worked out.
- Use conventional patterns. Familiarity is free comprehension; novelty is charged to the user.
- Stay consistent — things that look alike must behave alike, or each instance is re-learned.
- Make hierarchy visible, so importance is seen rather than inferred.

**Use it like this:** when something feels heavy but no rule is broken, the load is usually ungrouped information or an unnecessary decision. Split it or remove it. A long form becomes steps; a wide table becomes fewer default columns; six equal options become two recommended and four behind "more".

## Frame 5 — Optimise for the common path

**Ask: what are most people here to do?**

Roughly 80% of effects come from 20% of causes: most users touch a small share of features, most attention lands on a small share of the page, most complaints trace to a few issues. The number is not the point — the asymmetry is.

Effort should follow it. Make the common task excellent before making the rare one possible. A checkout that is flawless for the standard order and merely adequate for the edge case beats one that is uniformly mediocre because every case was treated as equal.

**Use it like this:** when a design is getting complicated to accommodate a case, ask how often that case occurs. If it is rare, handle it somewhere else — a secondary flow, a support path, a manual step — and keep the common path simple. Complexity added for a rare case is paid for by every user on every visit.

**Caution:** this frame prioritises effort, never access. "Most users don't need it" is a valid reason to move a *feature* off the main path. It is never a reason to skip an accessibility requirement — that is Frame 1, and Frame 1 does not yield.

---

# Part 2 · Tiebreakers

Seven. Each resolves a specific conflict in a specific direction. A principle that does not tell you what to give up is decoration.

### 1. Prefer the loud failure

**Between silent failure and visible failure, choose visible.**

A form that discards a submission and shows success is worse than one that errors. A page serving stale data without saying so is worse than a slow one. Silent failure is the most expensive class of defect, because the cost is paid by someone who never finds out.

### 2. Never destroy on suspicion

**When the system suspects input is wrong, mark it and hold it. Do not discard it.**

Spam scores, validation failures, duplicate detection — all heuristics, all wrong sometimes. Hold the item, record why, let a person decide. Applies equally to the user's typing: never clear a form, drop a draft, or overwrite without a copy.

### 3. Recoverable beats correct

**Between preventing a mistake and allowing it to be undone, choose undo.**

Prevention charges every user friction on every interaction to guard against a rare error. Recovery costs nothing until the error happens. Exception: genuinely irreversible operations, which confirm — and in `operator`, confirm by typing.

### 4. Optimise for who is actually there

**When density and legibility conflict, decide by the user's real conditions, not by preference.**

A first-time visitor on mobile data in bright sun and an operator at a large display for eight hours need opposite things. Mode encodes this. When the mode is genuinely unclear, ask — do not average, because the average serves neither.

### 5. Restraint is the default

**When a decision has not been made, ship the plainer thing and surface the question.**

An invented accent, a decorative animation, a gradient filling an empty space — each is a decision made by default rather than on purpose. Greyscale plus a stated question is a better deliverable than colour plus an unstated assumption.

**Method: design in black and white first.** Build the layout, spacing, size and contrast with no colour at all, then introduce colour only where it carries meaning — interactive elements and system states. Starting in greyscale forces hierarchy to work structurally, and whatever colour you then add is doing a job rather than filling a gap. It is also the fastest route to a palette that survives a colour-blind user.

**Ceiling: restraint applies to decoration, never to information.** Minimal is not the same as simple. A sparse interface that has dropped labels, selected states or visible actions is harder to use than a busier one that keeps them — it just photographs better. Strip styling freely; never strip the answers to *what is this*, *which one is selected*, and *what can I do next* (`E-63`).

### 6. The platform before the framework

**When the browser can already do it, use the browser.**

`<dialog>`, `<details>`, `position: sticky`, `:has()`, container queries, native form validation, `popover`. Platform features carry accessibility, keyboard handling and state management that a reimplementation gets wrong and then needs maintaining.

### 7. Match the codebase before matching this document

**When local convention conflicts with these rules, local convention wins.**

A codebase with one consistent approach is more maintainable than one with a better approach applied to 30% of it. Note the divergence, raise it, change it deliberately as its own work — not silently, mid-task.

**This tiebreaker outranks the other six.** It does not outrank Part 1: a local convention creating a genuine accessibility risk is a defect to raise, not a convention to match.

---

## Notes for the author (not for the agent)

**What changed in v0.2.** Part 1 did not exist. The file was adjudicative only — seven tiebreakers that fire when rules collide, with no method for producing a rule not yet written. That meant the system handed an agent 51 known failures and no way to recognise the 52nd. The four frames are that method.

Frame 3 is the most immediately useful, because it is the only idea here that produces a number. Everything else in this system is checked by inspection; interaction cost is checked by counting, which makes it the one principle an agent can be held to objectively.

Frames 1 and 2 are close to reasoning already embedded in `00` — the risk frame is *why* most of those rules exist, and the rationale requirement is the decidability test that let them in. Stating them explicitly means the next rule can be derived rather than remembered.

**Tiebreaker 7 remains the one to argue about**, and now has a stated ceiling: it loses to Frame 1. Without that boundary, "match the codebase" would license inheriting anything.

Tiebreakers 1 and 2 are the same instinct from two directions, and both come from outside software — a document that looks wrong gets marked and filed, never destroyed.
