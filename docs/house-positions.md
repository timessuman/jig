# House positions

Rules that record a deliberate taste decision rather than a general best
practice. They should be defended or changed consciously, not drifted away from.

This lived at the end of `rules/00-anti-patterns.md` under the heading
"Notes for the author (not for the agent)". That heading was a label, not a
mechanism: the file ships in the npm tarball and installs into every agent's
skill directory, so every agent read it. One did more than read it — handed a
docs site to build, it quoted the `A-07`/`A-08` line back as "the author's own
notes... license to go tighter than the shared default" and halved the radius
scale on that authority.

Notes addressed to the author belong where only the author reads them.

---

Rules carrying a deliberate house position rather than a general best practice — these are where your taste is recorded, and they should be defended or changed consciously:

- **C-18** — off-white over pure white. Already evidenced in your site's `#fafaf7`, now the anchor of the default neutral ramp.
- **A-07, A-08** — bordered, low-radius, low-shadow surfaces. This is a stance, not a consensus.
- **F-41, G-42** — resilience and restraint weighted above visual richness. Connects directly to your writing on JS-dependent form fields.
- **D-24** — heading space asymmetry. Universal advice, but stating a ratio makes it enforceable.

Candidates deferred to mode profiles because they are not universal: information density, table row height, use of colour fills for status, page-section rhythm, hero presence, illustration and imagery policy, animation budget.

---

# Notes moved here in 0.8.1

The 0.7.x fix above removed the section from `00-anti-patterns.md` and stopped
there. Four other rule files carried a section under the same heading, and all
four kept shipping — the fix addressed the instance, not the class, and the
commit claiming "no author notes in the shipped rules" had checked only the
file it had just edited.

What follows is that content, unchanged. Only its audience is.

## From `rules/01-modes.md`

**Decided, not derived.** These numbers are internally consistent and defensible, but several are judgement calls that should be tuned once you have run real work through them: the operator row height, the three section-rhythm values, and the motion durations. Change them in `tokens/mode.*.css`, never at the call site — this file describes them, `02-tokens.md` resolves them, and neither is where they live.

**Where your taste is recorded here:**
- The zero-JS default in `editorial` — a stronger position than most systems take, and consistent with your writing on JS-dependent forms.
- Absolute-first timestamps in `operator` — that is the procurement instinct: the record is evidence before it is a convenience.
- Typed confirmation for destructive operator actions, and no hover-hidden information in all-day tools.
- Border-led elevation as the unbranded default.

**Open question worth resolving before tokens.** `product` is currently defined as the midpoint of the other two, which is how it earns its place, but it is also the mode that most often needs to lean. A customer dashboard leans editorial; a billing admin screen leans operator. Consider whether `product` needs a documented `dense` variant, or whether such surfaces should simply be declared `operator`. My inclination is the latter — three modes you apply confidently beat five you deliberate over — but it is your call, and it affects how many token sets `02` has to emit.

## From `rules/03-patterns.md`

**Where your taste is recorded here:**
- `P-01` — the whole feedback table is a position. Toasts are over-used because they are easy to build and require no layout decisions; treating them as the narrowest case rather than the default is deliberate.
- `P-03` help-text-before-control. Contested — many systems put it after. Placing it before means it is read before the user commits to typing, which matters more in forms people fill once.
- `P-04` one-column forms, and the no-JS baseline for the primary action.
- `P-06` stable row identity, absolute timestamps, no hover-only truncation. The procurement instinct again: the record is evidence before it is a convenience.

**Deliberately absent.** Navigation, cards, tabs, and toasts-as-a-component. Navigation and cards vary too much by project to have decidable rules yet — they would produce prose, not constraints. Add them once you have built enough to see the invariant.

**Worth testing before extending.** These 12 cover most of what generated UI gets wrong. Point an agent at a form and a table with `00`, `01`, `02` and `03` loaded, and compare against the same task with nothing loaded. If `P-03` and `P-05` do not visibly change the output, the rules are not decidable enough and the fix is more specificity, not more patterns.

## From `rules/04-principles.md`

**What changed in v0.2.** Part 1 did not exist. The file was adjudicative only — seven tiebreakers that fire when rules collide, with no method for producing a rule not yet written. That meant the system handed an agent 51 known failures and no way to recognise the 52nd. The four frames are that method.

Frame 3 is the most immediately useful, because it is the only idea here that produces a number. Everything else in this system is checked by inspection; interaction cost is checked by counting, which makes it the one principle an agent can be held to objectively.

Frames 1 and 2 are close to reasoning already embedded in `00` — the risk frame is *why* most of those rules exist, and the rationale requirement is the decidability test that let them in. Stating them explicitly means the next rule can be derived rather than remembered.

**Tiebreaker 7 remains the one to argue about**, and now has a stated ceiling: it loses to Frame 1. Without that boundary, "match the codebase" would license inheriting anything.

Tiebreakers 1 and 2 are the same instinct from two directions, and both come from outside software — a document that looks wrong gets marked and filed, never destroyed.

## From `rules/05-copy.md`

**Where your taste is recorded here:** the ban on apology words in errors, and `I-90`'s requirement that the heading and button work without the body text. Both come from the same instinct as the rest of the system — the person reading is trying to get something done, and the interface should not make them wade.

`I-87` is the rule most likely to need a project-specific companion. A term list belongs in the brand file's voice section, not here; this rule only says that one must exist and be followed.

Deliberately absent: tone-of-voice guidance beyond plain language. Tone is a brand decision and varies per client, so it belongs in `03-brand.md` when that file exists.
