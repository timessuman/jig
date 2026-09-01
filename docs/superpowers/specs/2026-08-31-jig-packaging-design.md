# Jig — packaging design

**Date:** 2026-08-31
**Status:** approved design, pending implementation plan
**Supersedes:** the unpackaged `squint` content repo

---

## 1. Problem

The rule content exists and is good: 104 numbered rules with written corrections
(87 anti-patterns in `00`, 17 copy rules in `05`), three mode profiles, a token
architecture, a pattern library, and a copy standard. It is not installable, not versioned, not enforceable, and not
usable by anyone who is not sitting in this directory.

Three gaps stand between the content and an open-source project:

1. **No distribution.** No way for a user to get the files into their repo, and
   no way to update them afterwards.
2. **No multi-agent story.** Every coding agent expects instructions in a
   different path and format.
3. **No enforcement.** The self-check at the end of `00-anti-patterns.md` is a
   list an agent can silently skip, and nobody can tell whether it ran.

## 2. Goals

- One-paste install for any supported agent, at project or global scope.
- Rules vendored and version-pinned in the consuming repo, so a teammate who
  clones gets identical agent behaviour with no setup.
- Deterministic enforcement of every rule that can be checked deterministically,
  runnable in CI with no model and no API key.
- Model-based review for the rules that genuinely need judgment.
- A measurement loop that shows which rules actually change output.

## 3. Non-goals

- A component library. Jig ships rules and tokens, never components.
- A runtime. Nothing Jig installs executes in the user's application.
- Design generation. Jig constrains and checks output; it does not produce
  visual concepts.
- Framework lock-in. Tokens are CSS custom properties; rules are stated in CSS
  properties and behaviour, never in one framework's class names.

## 4. Name and namespace

**Jig.** A jig is a guide clamped to the workpiece so every cut comes out
identical regardless of who is holding the tool — which is what this system does
to a coding agent.

| Surface | Value |
| --- | --- |
| npm package | `jig-ui` (verified available 2026-08-31) |
| CLI binary | `jig` |
| Slash commands | `/jig init`, `/jig check`, … |
| Vendored dir | `.jig/` |
| Project config | `jig.config.json` |
| Licence | Apache-2.0 |

`squint` was taken on npm, which forced the rename. Following the precedent of
`tailwindcss` and `styled-components`, the bare word is qualified for the package
while the command stays short.

### Licence rationale

Copyleft is excluded by the distribution model: rule files are vendored into
consuming repos and edited there. GPL would reach into the consumer's
stylesheets; even MPL-2.0's file-level reciprocity would compel publication of
private rule edits, which is the exact customisation `README.md` instructs users
to make. Only a permissive licence is viable.

Apache-2.0 over MIT for three reasons, in order of weight:

1. **§4(b) change notices.** Jig's central property is stable, citable rule IDs.
   A fork that renumbers or redefines `E-29` silently invalidates every downstream
   citation. Apache requires modified files to announce that they changed; MIT
   does not. This clause defends the design's foundation.
2. **§3 contributor patent grant**, with termination on patent litigation.
   Relevant the moment the project accepts pull requests. MIT provides nothing
   equivalent.
3. **Ecosystem compatibility.** Adjacent agent design skills are Apache-2.0. If
   Jig ever incorporates text from that lineage, matching terms avoids a
   mixed-licence file.

Cost is a longer `LICENSE` and a `NOTICE` to maintain. Apache-2.0 sits on
standard corporate allowlists, so adoption friction against MIT is negligible.

### Attribution through vendoring

Because `install` copies rule files into a repo that has its own licence, each
vendored file must carry attribution independently:

- `install` writes `.jig/LICENSE` and `.jig/NOTICE` alongside the rules.
- Each vendored rule file gets a one-line header comment naming the project,
  version, and licence.
- `update` treats these as generated and always replaces them, regardless of
  checksum, so attribution cannot drift or be stripped by a stale install.

### Rename tasks

- `ui.config.json` → `jig.config.json` (update `README.md`, `AGENTS.md`,
  `01-modes.md`, and `ui.config.example.json`).
- Repo directory and all prose references to "Squint".
- The squint test in `03-patterns.md` keeps its name — it is a real technique
  and the collision is now harmless.

## 5. Architecture

### 5.1 Source repo

```
jig/
├─ rules/                     canonical rule content
│  ├─ 00-anti-patterns.md        01-modes.md        02-tokens.md
│  ├─ 03-patterns.md             04-principles.md   05-copy.md
├─ tokens/
│  ├─ brand.default.css
│  └─ mode.{editorial,product,operator}.css
├─ rules.index.json           rule id → bucket, severity, detector, fix
├─ templates/
│  ├─ SKILL.md.tmpl           ONE skill body, rendered per agent
│  └─ commands/*.md           per-command reference, lazy-loaded
├─ packages/cli/              npm package `jig-ui`
│  └─ src/
│     ├─ commands/            install init check explain update token audit bench
│     ├─ detectors/           one module per mechanical rule
│     ├─ adapters/            per-agent paths and formats
│     ├─ codemods/            fixes for auto-fixable mechanical rules
│     └─ color.ts             contrast math, ramp derivation
├─ docs/
├─ RECONCILE.md
└─ README.md  LICENSE
```

The rule markdown is the single source of truth. `rules.index.json` is generated
from it by a build step that parses the `### A-01 Title` headings, then
hand-annotated with bucket and detector. A rule present in the markdown but
absent from the index fails the build — this prevents silent drift between the
prose and the enforcement layer.

### 5.2 What lands in a consuming repo

```
their-project/
├─ .jig/
│  ├─ 00-anti-patterns.md … 05-copy.md    vendored, pinned
│  ├─ rules.index.json
│  └─ manifest.json                        version, agent, scope, checksums
├─ .claude/skills/jig/SKILL.md             thin; points at ../../.jig/
├─ .jig/tokens/                            written by `install`
│  ├─ brand.default.css                    copy to brand.<project>.css and edit
│  └─ mode.{editorial,product,operator}.css
└─ jig.config.json                         written by `init`
```

**Tokens have exactly one location: `.jig/tokens/`.** `install` writes them
there, `update` refreshes them there, and `init` does NOT relocate them — it
wires the project's own CSS to import from that path. A second location would
make every documented import path context-dependent, and the rule markdown is
both the source of truth and the artefact vendored into a consumer's repo, so a
path correct in one context and wrong in the other is a dual truth that drifts.
`scripts/check-tokens.mjs` rule 4 enforces this.

**`install` and `init` are separate commands.** Install is mechanical, safe to
run anywhere, and touches no source files. Init asks questions and writes into
the source tree. Conflating them means a user evaluating the rules gets an
unrequested token migration.

### 5.3 `manifest.json`

```json
{
  "version": "1.0.0",
  "agent": "claude",
  "scope": "project",
  "installedAt": "2026-08-31T00:00:00Z",
  "files": { ".jig/00-anti-patterns.md": "sha256:…" }
}
```

Checksums make `update` safe. An untouched file is replaced silently; a file the
user edited is reported and skipped. This matters because the README explicitly
tells users to change rules in `00`–`03` rather than by exception, so local edits
are expected behaviour, not misuse.

## 6. Rule model

The rule set totals **104** rules across two files: 87 in `00-anti-patterns.md`
(sections A–H) and 17 in `05-copy.md` (section I, ids `I-53`–`I-90`). They share
one numbering space — `tokens/brand.default.css` cites `I-56` — so the index
covers both.

Every rule is classified into one of three buckets. The classification pass over
all 104 rules is a one-time task and is itself valuable: a rule that fits no
bucket cannot be enforced, which is the deletion test the README already argues
for.

| Bucket | Count (est.) | Enforced by | Examples |
| --- | --- | --- | --- |
| Mechanical | ~35 | CLI, deterministic | `E-29` focus removed · `H-47` hard-coded value past the token layer · `C-19` contrast below floor · `B-77` more than two weights · `G-43` no reduced-motion path · `F-36` placeholder as label |
| Judgment | ~57 | Agent, via skill | `A-06` three-column grid reflex · `A-59` repeated information · `D-69` spacing that does not grow outward · `F-37` unhelpful error text · `H-45` new component instead of existing |
| Hybrid | ~12 | CLI narrows, agent decides | `A-01` CLI flags a violet-band hue, agent judges whether it was chosen · `E-28`/`E-30` CLI finds a fetch with no loading or error branch, agent judges adequacy |

### 6.1 `rules.index.json`

```json
{
  "id": "E-29",
  "title": "Focus removed without replacement",
  "bucket": "mechanical",
  "severity": "error",
  "detector": "focus-removed",
  "fix": "add-focus-visible",
  "source": "00-anti-patterns.md#e-29",
  "since": "1.0.0"
}
```

`bucket` routes enforcement. `severity` gates CI. `fix` names a codemod or is
absent. `since` supports per-rule history in `explain`. A `fires` counter is
added by `bench` (§8.2) — the field is reserved in v1.0 so no migration is
needed later.

## 7. Commands

| Command | Ships | Notes |
| --- | --- | --- |
| `jig install --agent <x> --scope <project\|global>` | 1.0 | CLI only; run by the agent at install time |
| `/jig init` | 1.0 | Detect, derive, interview, validate, write, baseline |
| `/jig check [target]` | 1.0 | Merged mechanical + judgment report |
| `/jig explain <rule-id>` | 1.0 | Rule text, correction, version history |
| `/jig update` | 1.0 | Checksum-aware rule update with diff |
| `/jig token <name>` / `token add` | 1.1 | Lookup, and guarded add to the correct layer |
| `/jig audit` | 1.1 | Whole-repo sweep |
| `/jig bench <task>` | 1.2 | Evidence loop (§8.2) |

### 7.1 `install`

Copies `rules/` and `rules.index.json` into `.jig/`, renders `SKILL.md.tmpl`
through the target agent's adapter, writes `manifest.json`. Idempotent. Never
touches source files or config.

The user-facing instruction in the README is one line per agent:

```
Install Jig into this repo:
npx jig-ui@latest install --agent claude
```

### 7.2 `init`

```
1. Detect      framework; CSS system (tailwind v4 / v3 / plain / CSS-in-JS); existing tokens
2. Derive      if the codebase already has colours, extract them and propose a brand
               file rather than interviewing cold
3. Interview   brand seed · typeface · surfaces → modes
4. Validate    contrast vs --color-bg-raised AND --color-fill · hue collision (E-64)
               · violet-band warning (A-01)
5. Write       tokens/ · jig.config.json · CSS import wiring · agent instruction block
6. Baseline    run `check` and print the current violation count
```

Step 4 holds the user to the contract `brand.default.css` already states. A seed
failing 4.5:1 against either surface is rejected with the nearest passing
lightness offered. A seed in the red, amber or green bands warns under `E-64`
because it will collide with the system colours.

Tailwind v4 wraps both token imports in `@theme`; v3 writes a
`tailwind.config.js` extension mapping semantic names to the custom properties;
plain CSS writes two `@import` lines. Detection failure falls back to printing
the imports for manual placement rather than guessing.

Step 6 is what proves the system pays for its context cost — init ends with a
number the user can move.

### 7.3 `check`

```
$ /jig check src/components/Dialog.tsx

  ✗ E-29  Focus removed without replacement          Dialog.tsx:44   [mechanical]
  ✗ H-47  Hard-coded #6D28D9 past the token layer    Dialog.tsx:12   [mechanical]
  ⚠ A-01  Violet brand hue — intentional?            tokens:brand    [hybrid]
  ✗ E-30  No empty state for the results list        Dialog.tsx:88   [judgment]

  2 errors, 1 warning, 1 review note · 104 rules, 4 fired
  JIG_CHECK: version=1.0.0 mode=product mechanical=pass:33/35 judgment=ran
```

One report keyed by rule ID; the engine is tagged but not foregrounded. The
`JIG_CHECK:` attestation line makes a skipped check visible in the agent
transcript — the mechanism is borrowed from impeccable's `IMPECCABLE_PREFLIGHT`.

`--ci` runs only the mechanical bucket and exits non-zero on any `error`. No
model, no API key, deterministic. This is what makes Jig adoptable by a team
rather than an individual.

`--json` emits machine-readable findings for editor integrations.

### 7.4 `check --fix` (v1.1)

Every rule in `00` carries a written correction, not just a prohibition. For the
mechanical bucket that correction is largely deterministic, so roughly 20 of the
35 mechanical rules get a codemod:

```
E-29  outline: none      →  add :focus-visible with --focus-ring
H-47  color: #6D28D9     →  color: var(--color-brand)
D-23  padding: 18px      →  padding: var(--spacing-s)
C-18  background: #fff   →  background: var(--color-bg-raised)
```

Fixes are applied with a diff and never silently. Rules without a `fix` field
report only.

This capability is downstream of an authoring decision already made — writing
✅ corrections rather than bare bans — and is not available to any rule set
written as prohibitions.

## 8. The measurement loop

### 8.1 Why

104 rules is significant always-on context. Without measurement there is no
principled way to prune, and the README's own standard — *a rule that does not
change the output is either already the model's default or too vague to act on* —
cannot be applied.

### 8.2 `bench`

Runs a task prompt twice, rules loaded and rules absent, and diffs both outputs
through `check`:

```
$ jig bench "a signup form with validation"

  Rules that changed the output    F-36  F-38  F-39  E-29  D-24  C-19
  Already the model's default      A-02  A-04  B-16  G-44        → delete candidates
  Fired in neither run             A-59  D-69  E-73              → too vague, or untested
  Net                              12 of 104 rules did work on this task
```

Output feeds the `fires` counter in `rules.index.json`. This converts
`RECONCILE.md` from a reading list into a measurement, and answers the question
every serious adopter asks: does this actually change anything.

## 9. Agent adapters

| Target | Project scope | Global scope |
| --- | --- | --- |
| Claude Code | `.claude/skills/jig/SKILL.md` | `~/.claude/skills/jig/` |
| Codex | `AGENTS.md` block + `.codex/` | `~/.codex/AGENTS.md` |
| Cursor | `.cursor/rules/jig.mdc` | — |
| opencode | `.opencode/skills/jig/` | `~/.config/opencode/` |
| Generic | `AGENTS.md` block | — |

Adding a target is one table entry plus a format function. `SKILL.md.tmpl` is
rendered through these variables:

| Variable | Purpose |
| --- | --- |
| `{{command_prefix}}` | `/jig ` vs `jig ` vs other |
| `{{scripts_path}}` | Resolved path to the CLI |
| `{{ask_instruction}}` | How this harness asks the user a question |
| `{{available_commands}}` | Rendered from `command-metadata.json` |
| `{{config_file}}` | `jig.config.json` path |

`command-metadata.json` holds each command's description and argument hint once,
rendered into every agent's format.

The generic `AGENTS.md` block is the fallback for any agent without a dedicated
adapter, and is written to be correct standalone.

### 9.1 Skill body conventions

Adopted from observed failure modes in comparable skills:

- Instruct consumers to read full JSON output, never to pipe it through `head`,
  `tail`, `grep`, or `jq`.
- Instruct agents not to re-run a loader whose output is already in session
  history.
- State the `JIG_CHECK:` attestation format explicitly for harnesses that can
  emit it.

## 10. Testing

| Layer | Method |
| --- | --- |
| Detectors | Unit tests per detector against fixture files, positive and negative cases |
| Codemods | Snapshot tests: input → fixed output |
| Colour maths | Property tests for contrast against known WCAG pairs |
| Adapters | Golden-file tests: `install --agent X` produces expected paths and frontmatter |
| Install/update | Integration tests over a temp repo, including the edited-file skip path |
| Judgment layer | `bench` against a fixed task set, run on every rules change |

## 11. Milestones

**v1.0 — the useful minimum**
`install`, `init`, `check`, `explain`, `update`, the five adapters, Apache-2.0
licence with `NOTICE`, README with per-agent paste blocks.

`check` is complete in v1.0 across all three buckets. The judgment layer needs no
new code — it is the vendored rules plus the `SKILL.md` instructions, both of
which already exist; the agent performs it and reports in the shared format. The
CLI detectors are the build work, and the hybrid bucket is the seam between them.
Shippable as a real open-source release: a deterministic linter with ~35 rules, a
model-driven review for the other ~69, a validating setup command, and
multi-agent install.

**v1.1** — `check --fix` codemods, `token`, `audit`.

**v1.2** — `bench`, `fires` data, first RECONCILE-driven rule pruning.

**Cut line.** If capacity runs short, v1.0 minus `check` still installs and
configures — but it ships a file copier, and the rules stop being enforced the
moment `init` finishes. `check` is the component that makes the system recurring
rather than one-shot; cut anything before cutting it.

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Classification pass stalls the build | Ship v1.0 with only the ~20 highest-confidence mechanical rules indexed; the index is additive |
| Codemods corrupt user code | Diff-and-confirm by default; `--fix` never runs implicitly as part of `check` |
| Agents ignore the vendored rules | `JIG_CHECK:` attestation makes omission visible; `--ci` enforces the mechanical subset regardless of agent behaviour |
| Numeric defaults still unreconciled | `RECONCILE.md` ships with the repo and is public; `since` fields let values change without breaking citations |
| Five adapters is a maintenance surface | Golden-file tests per adapter; generic `AGENTS.md` fallback keeps unsupported agents working |

## 13. Open items

None blocking implementation.

Decided: licence Apache-2.0; npm package `jig-ui`; GitHub repo `jig`. The package
name is reversible only before first publish. The repo name is reversible at any
time but breaks inbound links once shared.
