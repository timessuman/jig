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
| `conflicts.md` | resolves a false rule conflict by silently changing the design | **No** |
| `commands/init.md` | no ask-versus-proceed gate; `/jig init` is not instruction | **No** |
| `commands/check.md` | runs the CLI, reports only the mechanical half | **Partly — for a different reason** |
| `commands/build.md` | improvises the build procedure | Not run (cancelled) |

Two of the three completed baselines did not exhibit the failure the reference
was meant to fix. Per `superpowers:writing-skills` — "always include a
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
been run, and the agent is asked to build.** Nothing in `SKILL.md` says what to
do in that state.

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
rather than by any missing procedure. That metadata is fixed in `8b703b6`, so
this baseline needs re-running as a control before `check.md` can be justified.

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
