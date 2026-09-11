# Changelog

## 0.8.0

Everything here was found by handing Jig to agents that had never seen it and
asking them to build something real — its own documentation site. None of it
was found by the test suite, which passed throughout.

Minor rather than patch: `explain` prints lines it did not print before, and
`init` can write a file it did not write before.

### Fixed

- **`jig explain` discarded most of the reasoning in the rules.** The parser
  kept the first `❌` and the first `✅` and threw away everything else. **41 of
  104 rules carry prose outside that pair — 103 lines.** `A-04` explains why
  shadow-only definition cannot hold 3:1; `C-22` loses sixteen lines; `C-49`
  leads with a three-row table distinguishing when a link needs colour, when it
  needs an underline, and when neither is required — and its pair alone says
  "keep the underline". All of it shipped in the tarball, installed into every
  skill directory, and was unreachable through the command built to read it.

- **`02-tokens.md` documented a Tailwind arrangement that fails.** It told every
  reader to write `@theme { @import "./jig/theme.css"; }` and claimed it yields
  `bg-surface`, `rounded-surface`, `p-card` and `text-body` as utilities.
  Tailwind 4 rejects it: *"@theme blocks must only contain custom properties or
  @keyframes."* The tokens cannot move into `@theme` regardless — it requires
  them top-level and unnested, while they live in `:root` and are redeclared
  under `[data-theme="dark"]` and a `prefers-color-scheme` query, which is what
  makes dark mode work. The flat import is what works, and is what `init`
  already wired without being told.

- **`02-tokens.md` named a token location the tool had stopped using.** It said
  tokens live at `.jig/tokens/`, that this was "the only location, in every
  scope and every project", and that "nothing relocates them" — while `init`
  printed `Token layer: src/styles/jig/` in the same run. `check-tokens` rule 4
  hardcoded the same path in a comment anticipating and forbidding this exact
  change, so the guard held the claim in place and would have failed the build
  on anyone correcting it. Shipped in 0.7.1.

- **A section headed "Notes for the author (not for the agent)" shipped to every
  agent.** The heading was a label, not a mechanism: the file is in the tarball
  and installs into every skill directory. A probe read it, quoted the
  `A-07`/`A-08` line back as "the author's own notes… license to go tighter than
  the shared default", and halved the radius scale on that authority. Moved to
  `docs/house-positions.md`.

- **The published package shipped no changelog**, despite the repo holding 32KB
  of one. Staging and `files` now change together, which the tarball guard
  already enforced.

- **`A-01` had no stated scope for "then ask".** Two agents given the same brief
  split on it — one shipped the unbranded default and deferred, the other
  proposed a hue and argued the proposal *was* the ask — both citing the same
  conflict-resolution clause. The rule now says a proposal is a question with a
  suggested answer, not a decision.

- **`B-11` capped line length and stated no floor**, so a column could be halved
  indefinitely and still pass. Measured on the documentation site: two
  side-by-side panels rendering prose at 41 characters, in a mode whose
  `--measure-prose` selects 68. The 40–80 band existed in `02-tokens.md` but not
  in the file an agent reads for a line-length decision.

### Added

- **Three detectors for the anti-slop rules, and a self-check that names them.**
  Section A is Jig's answer to "what is AI slop" — fourteen rules for the
  defaults a model reaches for when nothing was specified. **Three had
  detectors.** The other eleven were enforced by one self-check question —
  *"would this look different from a generic template?"* — which an agent that
  has just produced a generic template answers yes to, and whose `A-01 → A-10`
  range silently excluded `A-58`, `A-59`, `A-60` and `A-67`.

  Jig's own documentation site shipped `<span aria-hidden="true">❌</span> Don't`
  in the chrome of all 104 rule pages with `check --all` reporting nothing.

  `A-05` (emoji as iconography) and `A-10` (placeholder content) were never
  judgment calls — an emoji in a text node is a regex, and so is "lorem ipsum".
  `A-09` (marketing voice) is the first **mode-gated** detector: it fires in
  `product` and `operator`, stays silent in `editorial` where that register
  belongs, and stays silent when no mode is declared rather than guessing.

  The remaining eight stay judgment. Detecting "a container around every group"
  needs to know what an element is and how heavy it looks, and six noisy checks
  that fire on correct code is how a linter gets switched off. What reaches them
  is the self-check, rewritten to name each tell the way every other item does.

- **`check` reports what it examined.** `0 errors · 104 rules, 0 fired` was
  byte-identical whether forty components were examined and found clean or
  nothing was examined at all. It now reads `· 26 files, 4 with styles`, the
  `JIG_CHECK:` record carries `files=` and `styled=`, and a run where nothing
  carried a style region says **"Nothing inspected."** rather than "No
  findings." Both counts, because `.ts` and `.tsx` are style-bearing by
  extension and the file count includes parsers and configs that can never
  produce a finding.

  Worth knowing: `check` defaults to changed files, so on a clean tree it scans
  almost nothing. That was always true and always looked like a pass.

- **`init` offers a Tailwind v4 alias block.** The flat import gives you tokens,
  not utility classes — Tailwind only generates those for names declared in
  `@theme`. `init` can now generate that block, and **asks first**: it changes
  how every component in a project is written, both styles are correct, and
  silence is no. Under `--yes` it declines and says how to get it.

  Only the 18 Tailwind namespaces are aliased. `--size-*`, `--measure-*`,
  `--focus-ring-*`, `--border-width-*` and `--opacity-*` have none, and aliasing
  one emits a declaration that generates nothing. 189 declared names filter to
  87 — and the filter also excludes every primitive `02-tokens.md` says never to
  consume directly.

  The generated file explains why `--radius-surface: var(--radius-surface)`
  appears beside Jig's own declaration in the compiled CSS: Tailwind's lands in
  `@layer theme`, Jig's is unlayered, and unlayered beats layered regardless of
  source order. Without that note, someone finds it and "fixes" it.

- **The skill treats Tailwind setup as an ask.** Finding Tailwind in a project
  is not permission to change how every component in it is written. The agent
  reports what it found, shows both arrangements, and waits — and is told never
  to write `@import "tailwindcss"` into a project that does not already have it.

- **A guard that staged assets stay out of git.** Adding `CHANGELOG.md` to the
  prepack staging list committed a build artifact, because
  `packages/cli/.gitignore` is a hand-maintained list that nothing forced into
  step. On its first run the new guard caught a second, pre-existing hole:
  `references` had been staged and unignored since it was added, saved only by
  the directory not existing yet.

### Corrected

- **0.7.0's notes said the non-TTY refusal "names the three ways out".** It
  names three; two work. The guard runs before any config is read, so
  `jig.config.json` alone still exits 1 — it selects the mode once you are past
  the guard, it does not get you past it. The message is unchanged here and
  recorded in `docs/known-follow-ups.md`, because the right wording depends on
  whether the guard should consult the config first, which is a behaviour
  question rather than a copy one.

## 0.7.1

A rule file that contradicted the tool, and the guard that kept it that way.

Patch: the shipped rules change, but no command writes anything different.

### Fixed

- **`02-tokens.md` named a token location that 0.7.0 stopped using.** It said
  tokens live at `.jig/tokens/`, that this was "the only location, in every
  scope and every project", and that "nothing relocates them". Since 0.7.0 the
  layer follows the project: `init` puts it beside the stylesheet it wires and
  prints the path it chose. So a single `init` run told you `Token layer:
  src/styles/jig/` while the rule file an agent is explicitly told to load
  before writing token code insisted that directory could not exist.

  The file also disagreed with itself — four absolute examples, and one
  relative one added when the Tailwind section was written.

  It now describes the real behaviour, says pre-0.7.0 projects keep their
  layout, and points at the `theme.css` barrel so relocating the layer costs
  one line instead of every stylesheet.

- **`check-tokens` rule 4 was holding the claim in place.** It hardcoded the
  same path, in a comment that anticipated and forbade this exact change:
  "nothing — including a future `init` — relocates them". It was checking the
  documentation against itself rather than against the CLI, so it could not
  see the drift and would have failed the build on anyone correcting it.

  It now asserts what stays true as the layer moves: token imports shown in
  the rules must be relative. Mutation-tested in both directions.

### Corrected

- **0.7.0's notes said the non-TTY refusal "names the three ways out:
  `--yes`, a real terminal, or writing `jig.config.json` first."** The third
  is not a way out on its own. The guard runs before any config is read, so a
  config alone changes nothing — it selects the *mode* once you are past the
  guard. `jig.config.json` plus `--yes` works; `jig.config.json` alone exits 1
  with the same message that suggested it.

  The message itself is unchanged in this release and still reads as though
  the config were a third alternative. It is recorded in
  `docs/known-follow-ups.md` rather than reworded here, because the wording
  that is actually right depends on whether the guard should consult the
  config first — a behaviour question, not a copy question.

### How these were found

Not by the test suite, which passes 631 tests either way. By handing the rules
to agents that had never seen this repository and asking them to build
something real. Everyone who could have caught the token-location defect
already knew where the tokens were.

## 0.7.0

A silent no-op, fixed, plus the missing half of 0.6.0's token-layer move.

Minor rather than patch, and the call is arguable. The non-TTY fix is a
correction; the relocation offer is new behaviour that can move files, though
only interactively and only with consent. Taking the higher of the two is the
reading that does not understate the change, and anyone who might be prompted
to move their token layer should read these notes.

### Fixed

- **`jig init` without `--yes` exited 0 having written nothing when stdin was
  not a terminal.** It printed the first prompt, read EOF, and stopped. Every CI
  step, every piped invocation, and every agent shelling out without a TTY got a
  silent no-op — and exit 0 having done nothing is the worst outcome available,
  because the caller cannot tell it from success and then acts on a token layer
  that was never created. Confirmed identical in 0.5.0, so this predates the
  prompts added since. It now fails where the cause is still visible and names
  the three ways out: `--yes`, a real terminal, or writing `jig.config.json`
  first.

### Added

- **`init` offers to move a legacy `.jig/tokens/` layout** to the location your
  project's own structure suggests. 0.6.0 deliberately left an upgraded project
  where it was — a silent relocation could break an import you wrote that `init`
  knows nothing about — but that meant the improvement only ever reached new
  projects, and the way out was one line of output that is easy to miss.

  Interactively it asks; under `--yes` it declines and says how. Moving is all
  four halves or none: write at the new location, remove the old copies, strip
  the stale import before wiring the new one, and update `jig.config.json` so
  the next run does not go back for them. A file you have edited is never
  removed — it is named and left for you to clear.

  ```text
  BEFORE  @import "../../.jig/tokens/brand.acme.css";
          @import "../../.jig/tokens/mode.product.css";
  AFTER   @import "./jig/theme.css";
  ```

## 0.6.0

The token layer stops hiding in a dotfolder, and `check` starts reading it back.

Both came from the same question: who should write the tokens. The answer turned
out to depend on something that did not exist — **nothing validated the token
layer's own declarations.** `init` checked a brand colour once, at write time,
and no command ever looked again. A generated file edited afterwards, by a person
or an agent, went unexamined: `--color-text-weak` dropped to 22% opacity and
`check` reported "No findings". With that closed, where the files live and who
writes them become ordinary decisions rather than load-bearing ones.

**Upgrading:** run `npx jig-ui@latest update`, then `npx jig-ui@latest init`.
Existing installs keep their `.jig/tokens/` layout — nothing moves unless you
move it, because relocating files could break an import you wrote yourself.

### Added

- **`check` validates the token layer** (`check/token-audit.ts`). Text roles to
  4.5:1, interface strokes to 3:1, **in both themes**, plus `--text-prose` at
  18px and `--size-touch-target` at 48px. Alpha foregrounds are composited over
  each surface first — Jig's foregrounds are alpha by design, so a ratio before
  compositing means nothing. Only floors, never density: `--size-control` at 28px
  is a deliberate `operator` choice, and reporting it would teach you to ignore
  the ones that matter.
- **`H-47` enforces the half of itself it only stated.** Its correction always
  read "consume the semantic role, not the primitive"; the detector caught raw
  hex and raw px and nothing else. `color: var(--brand-l)` was silent — and it is
  the worse case, because it looks exactly like correct token usage while reading
  a bare number and bypassing every theme override.
- **`exempt` in `jig.config.json`.** Some surfaces render outside the cascade: an
  OG card in an SVG `foreignObject` carries no stylesheet, a PDF renderer never
  sees CSS. Those files were in permanent violation, which is an adoption blocker
  — a check that cannot pass is a check people switch off.

  Nothing is exempt by default and no filename is baked in; this list is the only
  source. Every run reports the **pattern** and what it excused, because an
  over-broad glob does not fail — `check` simply gets quieter, and quieter looks
  like progress:

  ```text
  5 file(s) exempt via jig.config.json and not scanned:
    src/*-card.css  (5 files — likely too broad, review it)
    src/nope.css  (matches nothing — check the path)
  ```

  Prefer an exact path. An exemption is a claim about one file's rendering
  context, and that is usually literally true of one file. `src/cv/pdf/**` is a
  fact about a tree; `**/*-card.tsx` is a naming coincidence that would also
  excuse every real card component in the project.
- **One import per surface, through a barrel.** `jig/theme.css` imports the brand
  file and one mode file; your stylesheet imports that single line and then never
  changes again. Switching mode rewrites Jig's file, not yours.

### Changed

- **The token layer follows your project's layout.** `.jig/tokens/` was right
  everywhere by being right nowhere — a tool dotdir holding product source,
  reached from a Rails stylesheet by `@import "../../../.jig/tokens/…"`. The
  default is now a `jig/` directory beside the stylesheet being wired, so the
  import is `./jig/theme.css` in every ecosystem. `jig.config.json`'s `brand`
  now decides placement, not just wiring — it previously honoured the path only
  when the file already existed, which is the one case where it does not matter.
- **The mode is chosen before `init` runs.** It is the most consequential thing
  `init` writes and the thing it is worst at choosing: `--yes` took `'/' → product`
  without reading the project, and that config then outranks every agent's later
  inference. The command file now tells the agent to ask what the product is, map
  each surface, write the config, and only then run. `init` also reports the
  surfaces it **used** rather than the ones it defaulted to — with a config
  present it had been announcing a default it was about to ignore.
- A barrel holds exactly one mode, never a merge. Importing all three into one
  document leaves only the last; verified in a browser, it yields `operator`
  throughout. `01-modes.md` already said why that is not a loss: density switches
  at the route boundary, never inside one view.

### Fixed

- `--text-prose`, `--size-touch-target` and every semantic colour are now held to
  their floors after `init` as well as during it.
- **`H-47`'s built-in token-layer skip was over-broad.** It matched
  `(brand|mode).*.css` with the directory optional, so a project's own
  `src/legacy/brand.colors.css` was silently exempt from the primitive check
  wherever it sat. Scoped to the token layer's directory now — Jig owns `jig/`
  outright, and a filename that merely looks like one of ours is a coincidence.
- The token audit follows the token layer instead of reading a fixed directory.
  It was written when `.jig/tokens/` was the only possible answer, so moving the
  layer made it find nothing and report nothing — caught in a pre-release smoke
  test, where a brand file edited to 22% opacity passed cleanly. A check that
  goes quiet when its subject moves is worse than one that was never written,
  because the silence reads as a pass.
- Tailwind v4 does not scan workspace packages — documented, with the `@source`
  directive it needs. Nothing errors when this bites: the class lands on the
  element, no rule exists to match it, and the style simply does not apply.

## 0.5.0

Four things shipped in 0.4.0 were broken in ways that reported success. `/jig
update` refreshed to the version already installed and said "Updated Jig →
0.4.0". Dark mode could not be reached by choosing it. `check` skipped nearly
every colour in a project that had not run `init`. And the reconciliation of
every numeric default against an external reference is finished — 0 rows open —
which is where most of the rest of this release came from.

**If you are on 0.4.0, run `npx jig-ui@latest update` from a terminal.** The
`/jig update` fix cannot deliver itself: your command file is the broken one, so
the slash command will keep reporting a successful no-op until the CLI replaces
it. Once, from the terminal, and the slash command works from then on.

### Fixed

- **`/jig update` could never upgrade anyone.** Every subcommand is invoked at
  the installed pin so the CLI and the vendored rules agree; `update` is the one
  exception, because its job is to move that pin. The skill file knew that and
  the slash command did not, so it ran `npx jig-ui@<installed> update` — a no-op
  that reports success, which is worse than an error.
- **Dark mode was unreachable by explicit choice.** `brand.default.css` had one
  dark block, inside `@media (prefers-color-scheme: dark)`. A selector inside a
  media query cannot match when the query is false, so `data-theme="dark"` on a
  light-mode system produced no dark tokens at all. A second, unmediated block
  now carries the same declarations, and a check keeps the two identical.
- **`check` did not resolve the project's own tokens.** The token map held only
  Jig's vendored `.jig/tokens/*.css`, so any `var(--your-token)` was
  unresolvable and skipped. On a project that had never run `jig init`,
  `contrast-floor` and `violet-band-hue` evaluated very nearly nothing. A name
  declared in two places with different values is still skipped — which value a
  browser uses depends on import order, and a wrong guess reports a finding
  against a value the page never renders.
- **`operator` prose text was 16px** against the 18px floor `B-75` states and
  `02-tokens.md` repeats. It is the mode most likely to be read for hours.
- **Rules cited tokens that do not exist** — the `--color-danger` family,
  `--color-surface`, `--leading-heading`, `--leading-display`,
  `--font-weight-body`, `--spacing-unit`. An agent following those wrote a
  `var()` resolving to nothing, with no error anywhere.
- **`C-19` named the same token twice**, once "for large text only".
  `--color-text-weak` clears 4.5:1 at any size, and there is no lighter grey.
- **The error message in `P-03` moved above the input**, where autofill menus
  and on-screen keyboards do not cover it.
- **CSS nesting and line endings.** `install` and `update` had three near-copies
  of one write helper and one had lost its line-ending handling, so `update`
  flattened a CRLF token file to LF while leaving the rule files beside it
  alone. All three now share `install/writer.ts`, and writes are atomic.

### Added

- **`P-13 · Ambient motion`** — a third category of motion the system lacked.
  Interaction and transition motion are milliseconds; ambient motion is slow,
  looping and decorative, and must never be noticed. `G-44` forbade all of it by
  stating a 300ms ceiling it had never scoped, so an agent asked for a slow
  decorative loop would have refused, citing a rule about something else.
- **`--duration-ambient-fast/base/slow`** (3s / 4.7s / 7.1s), `editorial` only.
  The values are mutually prime in tenths of a second so layered loops do not
  re-align into one visible pulse.
- **Fluid headings.** `--text-h1` and `--text-h2` are `clamp()` in `editorial`
  and `product`, reaching their minimum at a 360px viewport and their maximum at
  1024px. Every term is `rem`-based: a `px` or bare-`vw` bound ignores a
  reader's font-size preference, which is a WCAG 1.4.4 failure.
- **`explain` finds rules you cannot name.** A word searches every title and
  body; one match prints in full. `--list` prints every id, or one section's.
- **Easing direction** — `--ease-out` on entry, `--ease-in-out` on exit, never
  linear for anything that moves. Both tokens shipped with no rule for choosing.

### Changed

- **`--text-h1` resolves to 32px on a phone**, not 48px. This is the change most
  likely to be visible in an existing project, and it is the point: at a fixed
  48px, a 45-character headline set as four lines and 211px of headline on a
  360px screen.
- **Line heights are documented per mode.** They always were per mode; the docs
  quoted one mode's values as though they were everyone's, and were wrong for
  two modes out of three.
- **The README covers installing and using Jig, and nothing else.** How to
  change a rule and how to test that a rule earns its context cost moved to
  `AGENTS.md`, where an agent working on this repository will read them.

### Reconciliation

`RECONCILE.md` is at **0 open rows**. Every numeric default is either adopted
from the reference or deliberately kept with its argument stated in one line.
The motion rows are the exception worth knowing: that reference has no motion
chapter, so those values were settled against separate sources, and where no
source gave a number they are kept as ours on stated reasoning rather than
adopted.

`check-tokens` grew from 5 rules to 12, each mutation-tested. Two of the new
ones exist because a guard had been passing vacuously: rule 6's regex was
line-anchored and so covered 103 of 133 tokens while claiming to cover all of
them, and nothing at all checked that a token cited in the rules exists.

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

- **A project-scope Codex install wrote Jig's rules into your project's
  `.jig/`.** Codex has no skill-directory convention, so its bundle went to a
  bare `.jig` — the one directory this release reserves for the project's own
  material. Install plus `init` left 13 files there, Jig's rules and manifest
  interleaved with your tokens and state, and the harness that most needed the
  0.4.0 separation was the only one that did not get it.

  Two concrete harms beyond the untidiness: `init`'s legacy scanner looks in
  `.jig/` for exactly those artifacts and offers to remove them, so it could
  offer to delete a live install; and one directory holding two manifests is
  what let a stale `.jig/manifest.json` hijack `update` in the first place.

  Codex now uses `.codex/.jig/` at both scopes, mirroring the path its global
  install already used. Verified against the real Codex CLI: it reads
  `AGENTS.md`, resolves every rule path under the new location, and picks up the
  declared mode. Upgrading leaves the old bundle in place — nothing is deleted —
  and `update` now names it rather than reporting a bare "Jig is not installed"
  to someone looking straight at the files.

- **`update` could never move an install forward.** Pinning the CLI fixed version
  skew, but applied to every command it trapped the install: `npx jig-ui@0.4.0
  update` refreshes to 0.4.0, reports success, and changes nothing. `update` is
  the one command whose job is moving the pin, so it is the one that does not
  carry it — the skill renders `npx jig-ui@latest update`.

- **`init --yes` chose a mode silently.** It takes `'/' → product` without
  inferring anything, and `01-modes.md` rule 1 makes the config authoritative
  over an agent's own inference — so the default is not a neutral placeholder,
  it binds every agent that reads the project afterwards. Two baseline runs on
  an `ops-console` project read every signal as `operator`, found `product`, and
  correctly deferred to it; one noted the density difference is expensive to
  reverse. The brand colour already stated its default and why. The mode now
  does too, and says where to change it.

- **A source build could stamp a pin to a version that was never published**,
  silently, until an agent tried to run it. `install` and `update` now say so
  when the running CLI is not an npm-installed package.

- **Concurrent runs lost each other's manifest entries.** Two runs against one
  install — two agents, or a script running `jig init` across a monorepo against
  a shared global install — both read the manifest and both wrote it, and the
  last writer's copy dropped the other's records of "Jig owns this file".
  Losing one makes a later `update` treat that file as the user's and stop
  refreshing it: the safe direction, but silent.

  Fixed without a lock. The `files` map is additive and per-file — a run only
  records entries for files it actually wrote — so merging against whatever is
  on disk at write time is correct, and needs none of the stale-lock recovery a
  mutex would after a process is killed mid-run. Writes are atomic
  (temp + rename), and verified-and-retried to close the window between the read
  and the rename. Ten parallel processes writing fifty entries now keep all
  fifty; without the merge, one survives.

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

- **`/jig` slash commands.** `install` writes a command file for every harness
  that has a slash-command mechanism, so `/jig init`, `/jig check --all` and
  `/jig update` work without leaving the session. One file named `jig`
  dispatching on its arguments, which is what gives `/jig init` with a space
  rather than a separate `/jig-init` per subcommand.

  The command is not a thin wrapper: `/jig check` runs the CLI for the seven
  mechanical rules, then applies the 97 judgment rules to the same files and
  merges both halves into one report keyed by rule id — the half a CLI cannot
  do, which is the reason the command exists at all.

  Claude Code, Cursor, opencode and Gemini CLI (which gets its own TOML shape).
  Not Codex: its custom prompts are not expanded by `codex exec` — probed
  directly — so a file there could sit and never fire. Only subcommands the CLI
  actually registers are offered, since a slash command that errors out is worse
  than one that does not exist.

- **`check` reads CSS wherever it lives.** It read `.css`/`.scss`/`.less` only,
  which for most projects meant it examined almost nothing — and said nothing
  about that. A Tailwind v4 fixture with `bg-[#6D28D9] p-[13px] rounded-[12px]
  text-[22px] h-[32px]` reported "No findings · 0 errors · mechanical=pass:0". A
  clean bill of health for a project where every value bypassed the token layer.

  Now covered: `<style>` blocks (HTML, Astro, Vue, Svelte, PHP, ERB, Twig,
  Handlebars, MDX, ASP and ASP.NET, Razor, JSP, Phoenix, EJS, Nunjucks, Liquid,
  Jinja, Velocity, FreeMarker), the indentation-delimited templates (Pug's
  `style.`, Haml's `:css`, Slim's `css:`, each with its own attribute syntax),
  `style="…"` and `style={{ }}`, CSS-in-JS tagged templates
  (`styled.button`, `styled(Link)`, `css`, `createGlobalStyle`, `keyframes`),
  Tailwind arbitrary values, and Tailwind default-palette contrast pairs.
  `@theme` counts as the token layer, so a v4 project that has adopted Jig is
  recognised as having done so.

  The mechanism is extraction rather than a detector per language: everything
  that is not CSS is blanked, preserving character positions, and the existing
  detectors run unchanged — so a finding in a `.vue` file still points at the
  right line, and all seven rules gained host-language support at once.

  Two deliberate limits. A bare `p-4` is not a finding: it resolves through a
  scale, and flagging it would mean flagging correct Tailwind. A colour outside
  the default palette is not resolved rather than guessed at.

- **Reference files ship beside the skill.** `references/**` in the package
  installs into the bundle with its subdirectory shape preserved, refreshed by
  `update` under the same rule as the rules: replace when untouched, skip when
  you have edited it. Adding one is a file drop, no code change.

  **No reference ships in 0.4.0.** Four were planned — a procedure for `init`,
  for `check`, for building a component, and one for resolving apparent rule
  conflicts. Each was tested first by running an agent on the task with no
  guidance, and in every case the agent already did the right thing: it inferred
  the mode with signals stated, kept a 32px control inside a 48px target rather
  than reading the two as contradictory, surfaced the brand question instead of
  guessing, and handled loading, error and never-checked states unprompted.
  `04-principles.md`'s tiebreakers were doing the work the references were meant
  to do. Writing them anyway would have added words the rules already carry.

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

