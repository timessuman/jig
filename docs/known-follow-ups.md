# Known follow-ups — carried out of the foundation branch

Recorded during subagent-driven execution of `docs/superpowers/plans/2026-08-31-jig-foundation-install.md`.
Each was reviewed, judged non-blocking for v0.1.0, and deliberately deferred. The final
whole-branch review triaged them; nothing here blocks merge.

## Fix before the next release

_Resolved: rule `C-49` now carries its `✅`, and `I-80` (found while verifying C-49) now carries its `❌`. All 104 rules have both markers._

- **Installing a second agent orphans the first agent's skill file.** _Resolved,
  and it had been for some time — the skill-first rearchitecture removed the
  premise. The entry assumed one manifest per project, which could name only one
  agent; each harness now keeps its own reference directory with its own
  manifest beside it, so there is nothing shared to overwrite. Verified end to
  end against a real project, then locked down in `install.test.ts`: each
  harness owns its own files, installing the second changes neither the first's
  bytes nor its manifest, and no installed file is left unowned by any manifest.
  The last is mutation-tested — with a planted orphan the suite fails._

## Shared-logic drift — resolved

_`install/writer.ts` now holds the one writer and the one bundle enumerator, and
all three call sites go through it._

The entry was right that this had already cost something, and understated it.
The three copies were not identical: `updateInitFiles` had lost
`matchLineEndings`, so a token file checked out under `core.autocrlf` came back
LF-only from `jig update` while the rule files beside it kept their CRLF. Nobody
chose that. Two things improved on the way in: writes are atomic (a truncated
file reads as user-edited, so `update` would skip it silently forever), and
`relKey` moved beside the writes it describes, re-exported so no call site
moved.

## Deferred findings, verbatim from the run ledger

_Triaged 2026-09-10. These are the implementer/reviewer notes as written at the
time; most are test-quality observations about code that has since been
rewritten, and they are kept verbatim rather than edited because their value is
as a record of what was noticed and waved through. Three were checked because
they had real consequences:_

- _**"rules-real.test.ts resolves the real file via process.cwd()"** — was still
  true, and worse than the note suggests. Run from the repo root it failed with
  ENOENT against `$HOME/rules/`; it only passed because `npm test` happens to
  run with cwd = `packages/cli`. The same bug was in `init-migrate.test.ts`
  (seven sites) and `init-command.test.ts`. All now derive from the package
  location, and the suite passes from either directory._
- _**"skillFilesFor has NO caller — install MUST route through it or the
  path-escape guard is dead code"** — resolved. Both `install.ts` and
  `update.ts` call it._
- _**"SKILL_DESCRIPTION is interpolated unquoted into YAML frontmatter"** —
  resolved. Both descriptions go through `quoteYamlString`._


- Task 1: minor (deferred): packages/cli/.gitignore added on implementer initiative — reviewer verified pattern semantics correct (nested .gitignore anchors to its own subtree; repo-root rules/tokens/LICENSE/NOTICE remain tracked). No action needed.
- Task 1: minor (deferred): npm audit reports 5 transitive dev-only vulns via vitest/esbuild/vite. Not in shipped package.
- Task 2: minor (deferred): multi-marker guard (first ❌/✅ wins) verified by trace but has no regression test — no real rule has two markers.
- Task 2: minor (deferred): rules-real.test.ts resolves the real file via process.cwd() while rules-parse.test.ts uses import.meta.url. Works under `npm test` (cwd=packages/cli) but is fragile under other invocations.
- Task 2: FINDING for Plan B: rule C-49 (Link treatment) has a ❌ but NO ✅ correction — the only such rule of 87. Reviewer verified: 87 headings, 87 ❌ lines, 86 ✅ lines. A rule with no correction cannot carry a `fix` codemod, and 00-anti-patterns.md's own contract says every rule has a correction. Either C-49 needs a ✅ written, or the fix layer must tolerate its absence.
- Task 3: minor (deferred): validateIndex silently coerces a non-string `detector`/`fix` to undefined rather than rejecting. Brief-level design choice, copied verbatim; worth tightening in Plan B when detectors become load-bearing.
- Task 4: minor (deferred): isModified uses `if (!recorded)` truthiness rather than an explicit undefined check. Harmless while all checksums are non-empty strings.
- Task 4: NOTE FOR TASK 8: reviewer flagged that manifest.files KEYS must be built with forward slashes explicitly, NOT path.join — a manifest written on Windows with `.jig\a.md` keys will not match a POSIX checkout, and manifests are committed to shared repos. manifest.ts itself is clean (it only consumes keys); the risk lands in the install writer.
- Task 4: minor (deferred): checksum normalizes CRLF only; lone CR (classic Mac) and mixed endings remain unnormalized. Not a realistic case for files git writes.
- Task 5: minor (deferred) -> CARRY TO TASK 7: SKILL_DESCRIPTION is interpolated unquoted into YAML frontmatter (`description: ${...}`). Safe today (no colon/dash/#/newline) but unguarded — a future description with a colon silently breaks frontmatter. Consider quoting, or a test that parses the emitted frontmatter.
- Task 5: minor (deferred) -> CARRY TO TASK 7: nothing at runtime rejects an absolute or `..`-containing relPath. Task 7's brief already tests this per-adapter; a shared guard would be stronger than four authors remembering.
- Task 5: minor (deferred) -> CARRY TO TASK 7: the scope->base-directory contract is undocumented. relPath is scope-invariant; resolving 'global' to ~ is the install command's job, not the adapter's. No adapter reads ctx.scope. Should be stated in a comment so Task 7's four authors don't each re-infer it.
- Task 5: minor (deferred): the frontmatter test asserts the opening `---` and the presence of name/description lines, but never that the block CLOSES. An adapter omitting the closing `---` would pass. Originates in my brief, not the implementer.
- Task 6: minor (deferred): render's regex matches [a-z_]+ only, so {{Var}}, {{var-name}} or {{ var }} would pass through as literal text into an agent instruction file instead of throwing. Mitigated today by the parity check and a single in-repo template; worth a comment for future template authors.
- Task 6: minor (deferred): renderCommandTable emits a header-only table for empty metadata. Not specified, not currently reachable.
- Task 7: NOTE FOR TASK 8: `skillFilesFor(adapter, ctx)` was added to registry.ts as the guarded wrapper that runs assertSafeRelPath over every produced file. It currently has NO caller. Task 8's install command MUST route through skillFilesFor, not adapter.skillFiles directly, or the path-escape guard is dead code.
- Task 7: minor (deferred): the frontmatter-quoting test only asserts the description is wrapped in quotes, using a constant with no " or \ in it. A quoteYamlString that wrapped without escaping would pass identically — the escaping logic itself is untested.
- Task 7: minor (deferred): render.ts switched from `value === undefined` to `name in vars`; a caller passing an explicit undefined for a known key would now render "undefined" instead of throwing. Unreachable from any real call site.
- Task 7: minor (deferred): assertSafeRelPath does not catch UNC paths (\\server\share\x). Brief only required leading-/ and drive-prefix detection.
- Task 8: minor (deferred): no test asserts a vendored file (with its attribution header) still round-trips through parseRules.
- Task 8: minor (deferred): the no-backslash manifest-key test cannot catch a regression to path.join on POSIX CI — it would only fail on a real Windows run.
- Task 8: accepted residual risk: prepare-then-commit guards bad READS, not mid-write disk failures. No rollback. Documented in-code and deliberate.
- Task 9: minor (deferred): stale manifest entries and orphan files are never reconciled when a rule file is removed upstream between versions.
- Task 9: minor (deferred): update.test.ts assertions use path.join, so they cannot detect a regression from relKey back to join on POSIX CI.
- Task 9: minor (deferred): CLI passes placeholder agent/scope into InstallOptions for update; reviewer confirmed they never reach disk or behaviour.
- Task 9: minor (deferred): new test 3 ("updates the manifest checksum for the skill file") passes against the PRE-fix code too — non-discriminating. Re-reviewer verified this empirically in a disposable worktree. Substantive behaviour is covered by tests 1/2/4; test 3 is redundant rather than wrong.
- Task 10: minor (deferred): no automated test locks the README's global-scope path table against the adapter sources; a future adapter path change could silently desync it.
- Task 10: minor (deferred): the "skill body instructs no unimplemented command" test uses an explicit IMPLEMENTED_COMMANDS list rather than deriving from commander, because src/index.ts calls program.parse() at import time so importing it to introspect would execute the CLI. Needs hand-updating when Plan B's commands land; comment says so.

## From the token/doc drift review

_All resolved. Verified item by item on 2026-09-10 rather than taken on the list's
word, and the audit that closed them found four more the list had not recorded._

- `01-modes.md`'s "Resolved values" pointer — **fixed**: `02-tokens.md` now holds
  "Sizes and motion, by mode".
- Operator `--text-prose` at 16px — **fixed** (`T20`), raised to 18px.
- `RECONCILE.md` `T2` and `T3` marked ✅ against values that no longer exist —
  **fixed**, both restated as superseded. A third, `T7` ("line height = size + 8"),
  was not on this list and had the same defect: it held for three of seven steps.
- Cited-but-undefined tokens — **fixed**. `--color-surface`, `--color-danger` and
  its variants, `--leading-heading`, `--leading-display`, `--font-weight-body` and
  `--spacing-unit` are all gone from the rules. **`check-tokens` rule 9 now fails
  the build on any recurrence**, with an allowlist for `--color-neutral-900` and
  `--button-bg`, which rules name deliberately as things not to consume.
- `--text-lead` / `--leading-lead` documented nowhere — **fixed**: `--text-lead` is
  a seventh column in the type table (checked by rule 1) and `--leading-lead` a row
  in the leading table (checked by rule 7).
- `01-modes.md` citing `#fafaf7` — **fixed**, now names `--color-bg-base` and its
  actual value.
- "Change them in this file" — **fixed**, now points at `tokens/mode.*.css`.
- `02-tokens.md` claiming brand files supply a dark block under both
  `prefers-color-scheme` and `[data-theme="dark"]` — **this was not doc drift. The
  doc was right and the CSS was wrong.** `brand.default.css` had only the media
  query, so a user who chose dark on a light-mode system got no dark tokens at all
  and the preview's own dark toggle did nothing. Fixed by adding the second block,
  with rule 10 asserting the two stay identical; CSS cannot share one declaration
  body across a media-query boundary, so the duplication is forced and the guard is
  the answer to it.

## Drift guard

`scripts/check-tokens.mjs` runs as part of the root `npm test`. **Ten rules.** This
section used to open by saying "three rules" and then list five, which is the same
class of error the rules themselves catch.

1. Every size in `02-tokens.md`'s type table matches the named token, per mode. A
   `32–48` cell means a fluid `clamp()`: the bounds must match, every term must be
   `rem`-based (a `px` bound ignores the reader's font-size setting — WCAG 1.4.4),
   and the curve must pass through the endpoints the doc claims.
2. No unanchored literal in a prose table.
3. No chosen colour literal repeated inside a token file.
4. Every token `@import` in the rules uses the canonical path.
5. Semantic colours meet their contrast floors — text 4.5:1, stroke-strong 3:1.
6. Every token is rendered by the preview harness. **The regex was line-anchored
   until 2026-09-10 and so saw only the first token on each line — 30 of 133 were
   invisible to it, and 17 of those were genuinely unrendered.** A coverage rule
   that silently covers 77% of what it claims is worse than none, because it is
   trusted.
7. The sizes, motion, easing and leading tables match the mode files. A `—` cell
   asserts the token is genuinely absent from that mode.
8. Leading holds its shape within a mode: never looser on larger type, body and
   caption floor at 1.5, prose stays inside 1.5–2. This is the half rule 7 cannot
   reach — a value wrong in the doc *and* the CSS agrees with itself.
9. Every token the rules cite exists in a token file, with an allowlist for the two
   named as counter-examples.
10. The two dark blocks in each brand file declare the same tokens with the same
    values.

Every rule is mutation-tested: each was verified to fail when the thing it guards is
broken, then restored. For rules 1, 8 and 10 the mutation includes the case the
neighbouring rule cannot see, since that is the only evidence the rule earns its
place.

What it does NOT guard: that a rule's *prose* is true. Rule 9 checks that a cited
token exists, not that the sentence around it is correct.

## From the check review

_Both resolved. Verified in the current source rather than taken on the list's
word, which is how the stale I2 entry was caught._

- **I2 — CSS nesting.** Already fixed and tested when this entry was written;
  nobody had closed it. `leafBlocks` runs every block through `blankNested`
  rather than discarding any block containing braces, so a nested rule's parent
  declarations are scanned, its child is not scanned twice, and line numbers
  survive the blanking. `check-css.test.ts` covers all four properties plus the
  pure-wrapper case.
- **I5 — consumer-declared custom properties.** Real, and now fixed.
  `loadTokenMap` reads the project's own unconditional `:root` declarations
  alongside Jig's vendored ones, from every stylesheet in the project (including
  style regions inside host languages, so a `createGlobalStyle` counts). Until
  this, a project that had never run `jig init` had every `var(--x)` treated as
  unresolvable, so `contrast-floor` and `violet-band-hue` reported nothing on
  very nearly all of its colours.

  Two decisions inside it. **A name declared in two places with different values
  is dropped, not resolved either way** — which value a browser uses depends on
  import order, and a wrong guess does not cost a missed finding but a *reported*
  one against a value the page never renders. And scope stays shallow: no
  `@import` following, no theme or breakpoint overrides.

  That second decision needed a fix underneath it. The old comment claimed
  media-query overrides were excluded because Jig's dark block uses
  `:root:not(...)` — true of Jig's own files and of nothing else, so a consumer's
  plain `:root` inside `@media (prefers-color-scheme: dark)` was read as an
  ordinary `:root` and its dark values overwrote the light ones. `CssBlock` now
  carries `atRuleDepth`, counting enclosing at-rules rather than braces: the
  style-region mask rewrites a tagged template's backticks as braces, so a rule
  inside `createGlobalStyle` is one brace deep while being conditional on
  nothing.

## Open questions raised by the source — all three closed

_Recorded as `F11`, `F12` and `F13` in `RECONCILE.md`._

- **Shadow colour** — kept black (`F11`). The reference suggests tinting shadows
  with the foreground colour; in this system that instruction resolves to the
  value it already has, because foregrounds here are achromatic opacities by
  construction rather than hues. The counter-argument is recorded rather than
  dismissed: a pure-black shadow on a warm off-white reads very slightly cold.
- **Disabled opacity** — kept 0.38 (`F12`), and the reference's own table is why.
  The divergence sat recorded for two releases without anyone computing it. At
  16px on white, 0.20 gives **Lc 27.3** — below the **Lc 30** the reference's own
  APCA table sets as the absolute minimum for disabled button text — while 0.38
  gives **Lc 52.1**. Lc 30 is not reached until 0.218. The reference holds two
  positions that contradict each other, and only one of them has a number in it.
  `check-tokens` rule 11 now rejects 0.20 by name.
- **APCA** — `00-anti-patterns.md` now references it (`F13`). It is the file an
  agent reads while writing colour, and every ratio in it read as the whole
  picture. It now says its ratios are WCAG 2.1 by policy, points at the
  threshold table, and names the two places the systems diverge — including that
  WCAG 2.1 exempts disabled controls entirely, so APCA is the only standard
  constraining that value at all.

  **No APCA detector was added, deliberately.** `check` fails builds on WCAG 2.1
  AA because that is what is legally referenced; a mechanical rule failing a
  build against a *draft* standard would assert more than the draft does. The
  algorithm ships as `scripts/apca.mjs` and holds the token set's own values to
  it, which is where the two systems' disagreement actually mattered.

## From the init review

- **I7 — RESOLVED.** `oklch()` is now parsed (`check/color.ts`, via oklab and linear
  sRGB, out-of-gamut clamped per channel). `init` derives from oklch custom
  properties and `C-19` computes contrast against them. Original note kept for
  context:

  **`oklch()` was unparsed, so Tailwind v4 / shadcn projects derived nothing.**
  `check/color.ts`'s colour parser has no `oklch()` branch, so any project whose
  tokens are declared in `oklch()` (the Tailwind v4 / shadcn default) yields zero
  candidates at every derivation priority and falls through to `DEFAULT_PROPOSAL`.
  This degrades cleanly — no crash, no wrong colour, just the unbranded default —
  but it means `init` derives nothing for what is likely the most common stack in
  new projects going forward. Highest-value follow-up from this review: add an
  `oklch()` branch to `extractColorComponents`.

## From building the documentation site

_Found by handing the rules to fresh agents that had never seen this repo, and by
planning a real build against the published package. Each was verified in the
source rather than taken from the report that raised it._

- **A section marked "not for the agent" is shipped to every agent, and one acted
  on it.** _Resolved: the section moved to `docs/house-positions.md`, which is
  where notes addressed to the author belong. Verified against a real `npm pack`
  that the shipped `00-anti-patterns.md` no longer contains it._ `00-anti-patterns.md:528` opens `## Notes for the author (not for the
  agent)`. It is in the published tarball and installs to
  `~/.claude/skills/jig/rules/`. A cold probe read it, quoted "bordered,
  low-radius, low-shadow surfaces" back as "the author's own notes... license to
  go tighter than the shared default", and halved the radius scale on that
  authority. The label is not a mechanism. The section also addresses a stranger
  in the second person — "your site's `#fafaf7`", "your taste", "your writing on
  JS-dependent form fields" — and its `#fafaf7` is the same stale hex that was
  fixed in `01-modes.md` and missed here. Either strip the section at pack time
  or move it out of `rules/`.

- **`A-01`'s "then ask" has no stated scope, and two agents split on it.** Given
  the same brief and the same rules, one shipped the near-black default and
  deferred the hue; the other proposed a colour and argued the proposal *was* the
  ask. Both cited the skill's "if a rule conflicts with an explicit instruction in
  the task, the task wins" clause to reach opposite conclusions. Tiebreaker 5
  ("ship the plainer thing **and surface the question**") points the same way as
  `A-01`, and was cited by the agent that did neither. The gap is real: neither
  rule says what to do when the task explicitly asks for the decision the rule
  says to defer.

- **`jig explain` discards the prose after the correction.** `rules/parse.ts:37-41`
  keeps only the first `❌` and the first `✅` line. **40 of 104 rules carry real
  prose after their correction — 96 lines — that `jig explain` never shows.**
  `C-22` loses 16 lines, `E-94` 8, `D-69` 7. The text ships in the package and is
  unreachable through the command built to read it.

- **The published package contains no changelog.** _Resolved: `CHANGELOG.md` is
  now staged at prepack and listed in `files`. It was two lines, not one — the
  staging script and the `files` array have to change together, which the tarball
  guard already enforced. Verified in a real `npm pack`: 20 files, changelog
  present._

## From scaffolding the documentation site

_Both found by a cold agent running `jig init` on a real Astro project, and both
reproduced here before being written down._

- **`02-tokens.md` states the token location, and the statement is false.**
  Line 22 of the shipped file reads: *"**Tokens live at `.jig/tokens/`.** That is
  the only location, in every scope and every project — `jig install` puts them
  there, `jig update` refreshes them there, and nothing relocates them."* Since
  0.7.0 that is wrong: `defaultTokenDir()` places the token layer beside the
  wired stylesheet, and `init` itself prints `Token layer: src/styles/jig/ —
  beside the stylesheet being wired.` So the CLI and the rule file disagree, out
  loud, in the same run. `README.md` documents the new behaviour correctly; the
  rule file — the one an agent is explicitly told to load before writing any
  token code — was never updated. This ships in the tarball and installs into
  every skill directory.

- **The non-TTY refusal names three ways out and only two of them work.**
  `init.ts:496` refuses when `!opts.yes && !opts.prompt && !process.stdin.isTTY`,
  and the message ends: *"(To choose the mode without a terminal, write
  jig.config.json first — init honours it.)"* The guard runs before any config is
  read, so a config alone changes nothing. Verified both ways in a scratch
  project: config + no `--yes` → exit 1 with that same message; config + `--yes`
  → succeeds and reports `'/' → operator — from jig.config.json`.

  The sentence is true about mode *selection* and false in the context it appears
  in — a paragraph about not having a terminal — so it reads as a third
  alternative when it is a modifier on the first. **This was mis-verified at
  release**: step 6 recorded "third way out works, no terminal needed" on the
  strength of a run that had `--yes` set. A cold agent followed the message
  literally, got the identical error, and resorted to allocating a pseudo-terminal
  with Python's `pty` module to get past it.
