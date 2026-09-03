# Changelog

## 0.4.0

Jig stops copying itself into your project. It is a skill an agent reads, and
0.3.0 wrote 220KB across 17 files into every consuming repo to deliver it —
roughly 200KB of that Jig's own property, read by an agent that already had it
from the skill install. A single-mode project now gets **three** files, all of
them its own.

### Changed

- **`install` writes one place: the harness's skill directory.** `SKILL.md`, the
  rules, `rules.index.json` and attribution live beside each other at
  `<harness>/skills/jig/`, project or global. Nothing lands in `.jig/` any more.

  The rules are not a build input — nothing compiles them, and the agent reading
  them already has them. The genuine exception is CSS: a stylesheet `@import` is
  an edge in a build graph and must resolve inside the project, on every machine
  that builds it. That is the one category `init` still copies.

- **`.jig/` holds only what belongs to the project** — the brand file, the mode
  files for the modes actually declared (not all three), and `state.json`.

- **A project install refuses when a global one exists.** Two `jig` skills
  registered with the same harness, whose rule paths point at different places,
  is exactly the incoherence this layout exists to prevent.

- **Every harness comes from one table.** Five adapters — Claude Code, Cursor,
  opencode, Gemini CLI, and a generic `.agents/skills` — share the
  `<harness>/skills/<name>/` convention, so adding one is a row rather than a
  file. Codex keeps a bespoke implementation because `AGENTS.md` genuinely is a
  different mechanism.

### Fixed

- **The skill told agents `check` was planned.** It shipped in 0.3.0. A baseline
  run reported "the CLI is ahead of the doc" and worked by hand rather than
  running it. The guard that should have caught this compared the metadata
  against a hand-maintained list, so when `check` landed and neither was
  updated, the two agreed and the test stayed green. The list is now read out of
  the CLI source, and agreement is asserted in both directions.

- **The skill sent agents to an unpinned CLI.** `npx jig-ui` resolves to whatever
  is latest on npm, which need not be the version that wrote the bundle. Two
  baselines hit this and fell back to working by hand. The skill now names the
  version that built it, and `jig update` moves both together.

- **`JIG_CHECK:` named two different records.** The CLI emitted `version=
  mechanical= judgment=`; the skill told the agent to emit `version= mode=
  self_check=` — disjoint fields under one label. There is now one field set,
  `version mode mechanical judgment`, asserted against both sources. An emitter
  that cannot determine a field says so in the value rather than dropping it.

- **Every vendored file cited a licence path that no longer exists.** The header
  hardcoded `.jig/LICENSE`, true only while install vendored into `.jig/`. In
  the new layout the one line whose job is directing a reader to the licence
  directed them nowhere. It is now computed from the file's depth in the bundle.

- **`update` refreshed only one harness.** A project can hold several installs,
  each with its own manifest; the rest stayed pinned at their install version
  with nothing said about them. It now refreshes every one and reports each.

- **`update` wrote files before checking the path.** `assertSafeRelPath` covered
  adapter-rendered files but not `referenceDir`, which the harness table derives
  just as directly. The shipped table is asserted at module load, so a bad entry
  fails at import rather than at whichever command writes first.

- **An asset could be staged at prepack and left out of the tarball** — correct
  code reading an asset that never shipped. Both lists must now agree, verified
  against the real `npm pack` output.

- **A legacy `.jig/manifest.json` hijacked `update`** and resurrected the whole
  vendored layout.

- **Agents invented token values when `init` had not been run.** A baseline run
  with the skill installed but the project not initialised authored its own
  `:root` block — "control height (32), row height (48), duration (120ms) and
  the near-black brand default are my resolved values, not the system's" — and
  wrote it into the project's stylesheet. Step 5 said "consume tokens by
  semantic name only", and it complied to the letter by inventing the
  definitions behind the names.

  `SKILL.md` now opens with the precondition: no `jig.config.json` means no
  token layer, so run `init` and stop, and do not author a `:root` block of your
  own. Step 5 gained the counter — a token with no value is a finding to report,
  not a number to supply. Re-run on the same fixture, the agent invented
  nothing, and reported a real gap in the token contract instead.

### Added

- **Reference files ship beside the skill.** `references/**` in the package
  installs into the bundle with its subdirectory shape preserved, refreshed by
  `update` under the same rule as the rules: replace when untouched, skip when
  you have edited it. Adding one is a file drop, no code change.

### Migration

`install` no longer writes rule files into `.jig/`, so a pre-0.4.0 project has
rules in two places. The old copies are yours to remove; nothing deletes them
for you, because you may have edited one and that edit is yours to keep. Run
`jig install --agent <name>` to place the new bundle, then delete `.jig/rules/`
and `.jig/rules.index.json` once you have checked them for your own changes.

## 0.3.0

Two new commands. `install` and `update` put the system in place; these two make
it do something.

### Added

- **`jig check`** — verifies a consumer's code against the rules. Seven
  detectors, exactly the ones `rules.index.json` already named: `gradient-text`
  (A-02), `backdrop-blur` (A-04), `pure-black-white` (C-18), `contrast-floor`
  (C-19), `focus-removed` (E-29), `hardcoded-value` (H-47), and
  `violet-band-hue` (A-01, hybrid — it asks rather than fails). With `--all`,
  `--ci` (mechanical bucket only, no model, deterministic) and `--json`.

  H-47 runs only on files that reference a Jig token or import a vendored token
  file. "Hard-coded *past* the token layer" means nothing for a file that never
  adopted it, and without that scope it produced 13 of 13 findings on a 20-line
  stylesheet. A project where nothing participates is told how to start.

- **`jig init`** — sets a project up to use the system. Detects the CSS system,
  derives a brand colour from existing code rather than interviewing cold,
  validates it against the contract `brand.default.css` already states, writes
  the brand file and `jig.config.json`, wires the imports, and runs `check` for
  a baseline.

  This is also what makes global installs coherent. The brand file and config
  always live in the project, and for a global install the one selected mode
  file is copied into the project's `.jig/tokens/` so the import is
  project-relative. A `$HOME`-relative CSS import resolves only on the machine
  that generated it; a stylesheet is committed and must build everywhere.

- `oklch()` is parsed. Tailwind v4 and shadcn emit it by default, so skipping it
  meant `init` derived nothing on a large share of new projects and `C-19`
  computed no contrast against Jig's own `--color-bg-base`.

### Fixed

- **CSS nesting hid the parent's declarations.** A block containing braces was
  discarded whole, so in `.card { color: red; .h { … } }` the `color: red`
  belonged to no block and was invisible to every detector. On a Sass codebase
  that was most declarations, reported as a clean result.

- Comments produced findings, and a commented-out `:focus-visible` silenced
  E-29 for a whole file — a dead detector reporting success.

- `var(--x, fallback)` was resolved to the fallback and reported as fact.

- The large-text contrast exemption was inert because only `px` font-sizes were
  recognised, so `2rem` at 3.54:1 was flagged as failing a 4.5:1 floor that did
  not apply to it.


## 0.2.1

### Fixed

- **`--color-text-warning` and `--color-text-success` failed their contrast
  floors.** Warning was 3.64:1 and success 4.48:1 against the surfaces they can
  land on, where text requires 4.5:1 and strokes 3:1. The source is explicit:
  system colours used for text need 4.5:1; used for interface elements and
  icons, 3:1. `RECONCILE.md` also lists the contrast floors as the one category
  not up for reconciliation, and `C-19` is a rule about this exact failure — so
  the system was breaking its own hardest rule, in a shipped default that every
  consumer inherits unless they override it.

  Warning lightness 36% → 29%, success 26% → 23%. Hue and saturation unchanged,
  so both are the same colour, darker. All four semantic colours now clear both
  floors against `bg-base`, `bg-raised`, and `fill` on either.

- The system colours now state what a replacement must satisfy. The brand colour
  already carried that contract; these did not, so a user bringing their own
  error or warning colour — the intended workflow — had no floor to hit.

### Added

- `scripts/check-tokens.mjs` gains two rules, both mutation-tested. Rule 5
  computes contrast from the token values and fails the build; this is the only
  defect class here that arithmetic can catch, and it shipped twice because
  nobody was doing the arithmetic. Rule 6 fails the build when a token is
  defined but never rendered by the preview.

- `packages/preview` — a rendering harness. Every prior check verified the
  system by arithmetic or grep; nothing had looked at it. Plain HTML and CSS,
  no build, not published. It found two gaps on its first run: there is no
  border-width token and no focus-ring geometry tokens.

## 0.2.0

The first release that actually works end to end. `0.1.0` shipped rules that
cited tokens it never installed, and a token name that did not exist.

### Fixed

- **`--color-brand` was cited nine times and defined nowhere**, including
  `03-patterns.md`'s primary-button spec. An agent following that rule wrote
  `background: var(--color-brand)` and got an unset custom property.
- **The design tokens were never installed.** The rules cite tokens 22 times
  and `02-tokens.md` instructs the reader to import them, but `install` only
  wrote the rule markdown. The CSS was in the published tarball the whole time
  and never copied out.
- **Rule `C-49` had no correction and `I-80` had no anti-pattern**, in a file
  whose own contract states every rule pairs both. The totals hid it — the two
  defects cancelled at 103/103.
- **Ten values in the mode profile tables contradicted the tokens**, including
  editorial body size, section rhythm, card padding, and a heading step that
  did not exist.
- **`A-07`'s correction had silently inverted from true to false.** A mechanical
  rename of `--radius-base` to `--radius-sm` turned a correct statement about
  radius derivation into an incorrect one, with nothing to catch it.
- **`A-07`'s prohibition used a `16px+` threshold** that flagged `--radius-md`,
  the value the rule exists to sanction.
- **`C-68` depended on a radius token it never named.** "A badge is more rounded
  than a button" now cites `--radius-full`.

### Changed

- Tokens vendor to **`.jig/tokens/`** on install, in every scope. That is the
  only location; `update` refreshes them there and nothing relocates them.
- Editing a vendored token file is expected: `install` and `update` both leave
  files you have changed alone and report them skipped.
- The mode profile tables cite token names instead of literals; the comparison
  table is ordinal. A number in prose is a call site.
- The semantic colours are defined once each as `--<name>-h/s/l`. Every variation
  previously repeated the same literal four to five times, so changing a colour
  meant editing every copy or the variations desynchronised.

### Added

- `scripts/check-tokens.mjs`, run by `npm test`. Four rules, each mutation-tested
  against the drift it guards: the type table must match its tokens by name, no
  unanchored literal in a prose table, no chosen colour literal repeated in a
  token file, and every token import must use the canonical path.

