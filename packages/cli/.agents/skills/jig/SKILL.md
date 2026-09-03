---
name: jig
description: "Design system rules for generating and reviewing UI. Load before building any interface."
---

Jig is a design system consumed by coding agents. Rules are numbered and stable;
cite the number when you follow or deliberately break one.

## Before generating or reviewing any UI

1. Load `.agents/skills/jig/rules/00-anti-patterns.md` and `.agents/skills/jig/rules/01-modes.md`.
2. Determine the mode from `jig.config.json`, or infer it using the procedure in
   `.agents/skills/jig/rules/01-modes.md` and state the inference in one line before building.
3. Load the relevant section of `.agents/skills/jig/rules/03-patterns.md` for the component you are building.
4. Load `.agents/skills/jig/rules/05-copy.md` whenever you write a label, button, heading, error or empty state.
5. Consume tokens by semantic name only. Never write a raw colour or pixel value
   at a call site.
6. Run the self-check at the end of `.agents/skills/jig/rules/00-anti-patterns.md` before finishing
   (a future `check` command will automate this).
7. Cite any rule you deliberately break, with the reason, in one line.

Load `.agents/skills/jig/rules/04-principles.md` only when two rules conflict.

## Commands

| Command | Description | Status |
| --- | --- | --- |
| `install --agent <name> [--scope project\|global]` | Install Jig rules and the agent skill file into a repository. | available |
| `update` | Update the vendored rules to a newer version, showing a diff and skipping files you have edited. | available |
| `init [--yes]` | Set up Jig in this project: detect the CSS system, derive or interview for brand values, validate them against the token contract, and write tokens plus jig.config.json. | available |
| `check [target]` | Check changed files or a named target against the rule set. Reports violations by rule id. | planned — not yet implemented |
| `explain <rule-id>` | Print a rule's full text, its correction, and the version it was introduced in. | planned — not yet implemented |

Commands marked `available` run via the CLI at `npx jig-ui`. Commands
marked `planned` are listed for context only — running one errors out, since
it is not yet registered.

## Reading command output

Consume the full output of any Jig command. Never pipe it through `head`, `tail`,
`grep`, or `jq` — findings are ordered by severity, not by position, and
truncating drops the ones that matter.

If a command's output is already in this session's history and no files have
changed since, do not re-run it.

## Asking the user

Ask the user directly in chat, one question at a time, and wait for an answer before continuing.

## Attestation

Before you finish a task that generated or modified UI, emit this line:

```text
JIG_CHECK: version=<version> mode=<mode> self_check=<ran|skipped>
```

<!-- `mechanical=<pass|fail>:<n>/<total>` and `judgment=<ran|skipped>` fields
     belong here once the `check` command lands and can actually produce
     them — do not add them back before that. -->

A skipped self-check must say `skipped` and give the reason. Do not report
`ran` for a check you did not perform.

