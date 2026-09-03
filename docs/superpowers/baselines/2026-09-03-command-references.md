# Baselines — the four command references

**Date:** 2026-09-03
**Purpose:** the RED phase required before writing `commands/init.md`,
`commands/check.md`, `commands/build.md` and `conflicts.md`.

Each was run as a fresh subagent against a copy of the same fixture — an
`ops-console` project (an SRE alerts dashboard) with one `AlertsTable.tsx` and
one `app.css`, with Jig installed as a Claude skill and nothing else said.

## Result summary

| Reference | Claimed failure | Reproduced? |
| --- | --- | --- |
| `conflicts.md` | resolves a false rule conflict by silently changing the design | **No** — but see the invented-token failure below |
| `commands/init.md` | no ask-versus-proceed gate; `/jig init` is not instruction | **No** |
| `commands/check.md` | runs the CLI, reports only the mechanical half | **Partly — for a different reason** |
| `commands/build.md` | improvises the build procedure | **No** |

Three of the four did not exhibit the failure the reference was meant to fix;
the fourth's cause turned out to be a packaging bug, fixed separately. Per `superpowers:writing-skills` — "always include a
no-guidance control; if the control doesn't exhibit the failure, there is
nothing to fix" — that is a reason not to write those files, not a reason to
write them anyway.

## `conflicts.md` — did not reproduce

The worked example was the `--size-control` (32px in `operator`) versus
`--size-touch-target` (48px, every mode) tension in `03-patterns.md` P-02. An
earlier baseline had read the two as contradictory and resolved it by setting
the **visual height** to 48px, silently changing the design.

This run did not. It kept the visual height at 32px and expanded the hit area
to 48×48 with a centred `::after` overlay, and named the governing text itself:

> `01-modes` says target size is not mode-negotiable and explicitly rejects
> shrinking targets for density. I gave way on density.

It also identified the second-order consequence unprompted — that a 48px target
on a 32px row overlaps its neighbours, so a click near a boundary acknowledges
the wrong alert — and raised the row height to 48px to prevent it.

The rules already carry this. `01-modes.md`'s "What mode does not control" and
`04-principles.md`'s tiebreakers did the work a `conflicts.md` would have done.

### What it *did* fail at — invented token values

The fixture had `install` run but not `init`, so no token layer existed. Rather
than stop, the agent invented one:

> The token files do not exist. I added a clearly marked stand-in `:root` block
> at the top of `app.css` with only the tokens this button needs. Control height
> (32), row height (48), duration (120ms) and the near-black brand default are
> **my resolved values, not the system's**.

It flagged them honestly, but it wrote invented design decisions into the
project's stylesheet to keep going. This is the one failure that reproduced
cleanly, and it has a precise trigger: **the skill is installed, `init` has not
been run, and the agent is asked to build.** Nothing in `SKILL.md` said what to
do in that state.

Note the shape of the failure. Step 5 said "consume tokens by semantic name
only", and the agent complied *to the letter* — it used semantic names — by
inventing the definitions behind them. A rule followed exactly and violated
completely, which is the loophole `superpowers:writing-skills` says to close
explicitly rather than restate.

### GREEN

`SKILL.md` gained a step 0 (no `jig.config.json` means no token layer: run
`init`, do not author a `:root` block of your own) and step 5 gained the
specific counter: *if a token you need has no value, that is a finding to
report, not a number to supply.*

Re-run on an identical fixture — installed, not initialised, same task — the
agent wrote no `:root` block at all. It consumed tokens by name, and where the
contract had no name for what it needed it said so instead of inventing one:

> `H-47` deliberately broken: the token contract has no border/outline-width
> namespace, so these two widths have no semantic name to consume. Reported as a
> missing token rather than added to the token layer here.

That gap is real — `--color-focus` exists, no width token does — so the fix
turned a silently invented value into a correctly reported hole in the system.
Recorded as M11.

## `commands/init.md` — did not reproduce

The claimed failures were "no ask-versus-proceed gate" and "`/jig init` isn't
instruction, the agent has to infer it". Neither held.

The agent drove the real CLI rather than hand-rolling, inferred `operator` mode
with the signals stated (`01-modes.md` M-03: package named `ops-console`,
content is records and rows, monitoring named explicitly), and handled the
un-askable question exactly as Tiebreaker 5 prescribes:

> The brand colour is an open question for you, not a decision I made. The skill
> wants that asked in chat one question at a time, which I can't do from here.

It also caveated its own attestation rather than overclaiming — "I ran the
mechanical check, but the judgment checklist is scoped to authored UI, and I
authored none."

### Product bugs it found

- **Stale licence paths in every vendored header** — headers cited
  `.jig/LICENSE`, which the harness-skills layout abandoned. Real; fixed in
  `245d114`. The agent found it and left it alone as "cosmetic, upstream".
- **Version skew** — it reached for `npx jig-ui`, got 0.3.0 from npm, and that
  build cannot see a new-layout install. An artefact of testing an unpublished
  layout, but it shows the skill never says *which* CLI to run.

## `commands/check.md` — reproduced, for a different reason

The agent produced a thorough judgment review — 31 findings, ordered by
severity, each with a rule id — and never ran the `check` CLI at all:

> The `check` command is listed as `planned — not yet implemented` in SKILL.md,
> so this was performed by hand rather than by CLI.

So the failure was not "reports only the mechanical half". It was the inverse:
**all judgment, no mechanical**, caused by the stale `command-metadata.json`
rather than by any missing procedure.

### The control, with the metadata fixed

Re-run against a fixture carrying the corrected metadata, the agent did reach
for the CLI — and still could not run it:

> **Mechanical check:** `npx jig-ui check --all` refused to run (`Jig is not
> installed in …`) — the CLI looks for an install marker this project does not
> present, even though the skill and tokens are vendored. All findings below are
> the judgment self-check applied by hand.

The remaining cause is not a missing procedure either. It is that the skill said
to run `npx jig-ui` unpinned, so the agent got npm's published build rather than
the one that wrote the bundle. Fixed in `d4f3bdd`; the skill now names its own
version.

So across two runs, the check reference's claimed failure never appeared. What
appeared twice was a packaging defect wearing its clothes. The judgment half was
never the weak point: both runs produced 26–31 findings ordered by severity,
each carrying a rule id, and both ran the `00-anti-patterns.md` self-check
unprompted — the second rendered it as a table with a pass/fail per question.

It also cited P-02, P-05, P-06, P-08 and M-02 — all real rules, none of them in
`rules.index.json`. See M10 in `docs/known-follow-ups.md`.

## The attestation drift

Both completed baselines emitted `SKILL.md`'s shape:

```text
JIG_CHECK: version=0.3.0 mode=operator self_check=ran
```

The CLI emits a different one under the same prefix:

```text
JIG_CHECK: version=0.3.0 mechanical=fail:5 judgment=not-run
```

Disjoint field sets, one label. Anything parsing `JIG_CHECK:` sees two
incompatible records.

## `commands/build.md` — did not reproduce

Run last, on a fixture that was both installed *and* initialised, so the token
layer existed and this tested the build procedure rather than the missing-token
failure above.

The claim was that the agent improvises the procedure — mode → pattern → tokens
→ copy → self-check — rather than following one. It did not improvise; it
followed it, and went past what the task asked for.

Asked only for a panel with a name, a status, a last-checked time, a button, and
the never-checked case, it produced a component handling **four** states —
never-checked, checking, error, and healthy — with `aria-live="polite"` scoped to
exactly the pair of values that change under the user's feet, and `role="alert"`
on the error. Nothing in the prompt asked for loading or error states; `P-05`,
`P-08` and `E-35` did.

Token discipline held completely: **zero** raw hex or pixel values in the
component, 64 token references in the stylesheet it wrote. Decisions carry their
rule id at the point they are made, in the code:

> `h2`, not `h3`, because heading order is document structure; the size step is
> set in CSS instead (B-17).

> Pill shape and a subtle tonal fill, so a non-interactive badge never carries
> the visual signature of the button beside it (C-68).

That is the procedure a `build.md` would have prescribed, applied without one.

## What this says about the plan

The four references were proposed off a single earlier baseline that showed real
failures. Re-tested one at a time, with the packaging defects fixed, none of the
judgment failures survived. The rules — `01-modes.md`'s "What mode does not
control", `03-patterns.md`'s anatomies, and above all `04-principles.md`'s
tiebreakers — were already carrying the load.

The failures that were real were **packaging**: a stale command status, an
unpinned CLI, two attestation shapes, a licence path pointing nowhere, an asset
in neither packaging list. Those are fixed. Reference files would not have
touched any of them.

The one judgment failure that did reproduce — inventing token values when `init`
had not been run — was fixed with two sentences in `SKILL.md`, not a file.
