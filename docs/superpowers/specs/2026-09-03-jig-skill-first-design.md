# Jig as a skill — corrected architecture

**Date:** 2026-09-03
**Status:** design, not yet implemented
**Supersedes:** the vendoring model in `2026-08-31-jig-packaging-design.md` §5.2

---

## 1. What is wrong now

`jig install` copies **220KB across 17 files** into every consuming project. Roughly
200KB of that is Jig's own property: the six rule files, `rules.index.json`, the
Apache licence, the default brand, and all three mode files. Committed into the
user's repo, in every repo.

The comparable system, impeccable, leaves **one file** — `.impeccable/design.json`,
describing that project's own design system. None of its rules or reference files
are copied anywhere. Its skill is installed once, globally.

Two specific defects follow:

1. **The skill file is written into every project.** `install --agent claude` writes
   `.claude/skills/jig/SKILL.md` unconditionally, even when Jig is already installed
   globally. A project that has both gets two `jig` skills whose rule paths
   contradict each other.
2. **The rules are copied for no one.** They are read by an agent, and the agent has
   them from the global skill install. The project copy is a second source that can
   drift from the first.

### The reasoning that produced it, and why it was wrong

The original spec argued for vendoring so that "a teammate who clones gets identical
agent behaviour with no setup", and so rule changes appear in PR diffs. That holds
for a **build input**. The rules are not a build input — nothing compiles them. They
are read by an agent that already has a copy.

The genuine exception is CSS. A stylesheet `@import` is an edge in a build graph and
must resolve inside the project, on every machine that builds it. That is the only
category with a real claim to being copied.

## 2. The corrected split

| Artifact | Lives | Why |
| --- | --- | --- |
| `SKILL.md`, command references | the harness's skill directory, once | it is the skill |
| Rules `00`–`05`, `rules.index.json` | beside `SKILL.md`, once | reference material the agent reads |
| Default brand, all three mode files | **nowhere in the project** | Jig's property |
| The project's brand CSS | project | identity; a build input; the user edits it |
| The selected mode's CSS | project | a build input; must resolve locally |
| `jig.config.json` | project | this project's mode map |

Rules live **beside the skill**, the way impeccable keeps `reference/*.md` inside its
own skill directory — not in a separate `~/.jig/`.

**The CLI needs no project copy at all.** `packages/cli/package.json` already lists
`rules` and `rules.index.json` in `files`, so `npx jig-ui` ships them. `check` reads
them from `assetRoot()`; the project copy it currently reads was never necessary.

## 3. What each command becomes

### `install`

Writes the skill and its reference material to **one** location — the harness's skill
directory, project or global — and nothing else. It stops writing `.jig/` entirely.

If a global install already exists, a project install warns rather than creating a
second, contradictory skill.

### `init`

Creates `.jig/` in the project containing only project state:

```
.jig/
  tokens/
    brand.<project>.css     the project's identity, user-editable
    <mode>.css              one per mode declared in jig.config.json
  state.json                version, modes in use, checksums
jig.config.json             route -> mode map
```

`<mode>.css` is a copy of Jig's mode file. It is the justified exception: a build
edge must resolve locally, including for a teammate and for CI. One file per mode
actually declared, not all three.

Target: **3 files** for a single-mode project, against 17 today.

### `check`

Reads rules and `rules.index.json` from the CLI package via `assetRoot()`, never from
the project. Continues to read the project's tokens for contrast resolution, since
those are the project's.

### `update`

Refreshes the skill install. It no longer refreshes vendored rules, because there are
none. It must still refresh the project's `<mode>.css` when the CLI version moves,
since that is a copy of Jig's file — tracked in `state.json`, skipped when edited.

## 4. Migration

This changes what `install` writes, so it is a minor bump with a migration path.

- On finding a pre-0.4.0 `.jig/` containing rule files, `init` and `check` report it
  and offer to remove the rule files while keeping the token and config files.
- Never delete without asking. A user may have edited a vendored rule; that edit is
  theirs and must be surfaced, not discarded.
- `check` must keep reading a legacy project `rules.index.json` for one minor version,
  so an un-migrated project does not break on upgrade.

## 5. What this does not change

The rule content, the token architecture, the six drift-check rules, the preview
harness, and the seven detectors are untouched. This is a change to **where files
live**, not to what the system says.

## 6. Open question, deliberately unresolved

Whether `init` should inline the resolved mode values into a single generated
stylesheet rather than copying a mode file. Inlining would mean nothing of Jig's is
copied at all. It costs the ability to `jig update` that file meaningfully, and makes
a mode switch a regeneration rather than an import change. Decide when implementing.
