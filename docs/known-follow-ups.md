# Known follow-ups — carried out of the foundation branch

Recorded during subagent-driven execution of `docs/superpowers/plans/2026-08-31-jig-foundation-install.md`.
Each was reviewed, judged non-blocking for v0.1.0, and deliberately deferred. The final
whole-branch review triaged them; nothing here blocks merge.

## Fix before the next release

_Resolved: rule `C-49` now carries its `✅`, and `I-80` (found while verifying C-49) now carries its `❌`. All 104 rules have both markers._

- **Installing a second agent orphans the first agent's skill file.** `install --agent claude`
  then `install --agent cursor` leaves `.claude/skills/jig/SKILL.md` on disk, absent from the
  manifest, frozen forever. The live trigger is a shared repo where teammates use different
  agents — which a single-`agent` manifest cannot express at all.

## Shared-logic drift (do before a sixth adapter or a third command)

`install.ts` and `update.ts` independently implement install-root resolution, the write+checksum
helper, rule-file enumeration, and the adapter render context. `update` already imports
`buildSkillBody` and `relKey` from `install`, so the seam was recognised but not finished. This
duplication is what let the C3 root-resolution bug diverge from `install`'s guarded version, and
what made the C2 fix need applying in two places.

## Deferred findings, verbatim from the run ledger

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

- `01-modes.md`'s "Resolved values: `02-tokens.md`" pointer is only partly true: `02-tokens.md` holds the type scale and spacing ladder but NOT control heights, motion durations, row heights, per-mode measure, or which spacing option `--spacing-section` selects. Either add a "Sizes and motion, by mode" table to `02-tokens.md`, or point at `tokens/mode.*.css`.
- Operator `--text-prose` is 16px, but B-75 forbids 16px for sustained reading and `02-tokens.md` says prose "never drops below 18px". Needs an operator carve-out in B-75 or a token change.
- `RECONCILE.md` T2 ("one scale, ratio 1.200, all modes") and T3 ("line height 1.65 body → 1.05 display") are both marked ✅ but describe values that no longer exist — T2 is reversed by T9, and no mode has 1.65 or 1.05.
- Other cited-but-undefined tokens, same class as `--color-brand`: `--spacing-unit`, `--color-surface`, `--font-weight-body`, `--leading-heading`, `--leading-display`, `--color-danger` and its variants (the system colour is `error`, not `danger`).
- `--text-lead` / `--leading-lead` exist in all three mode files and are documented nowhere.
- `01-modes.md` cites `#fafaf7` but `--color-bg-base` is `oklch(0.980 0.004 95)` ≈ `#f9f8f5`.
- `01-modes.md` says "Change them in this file, never at the call site" — the numbers now live in `tokens/mode.*.css`.
- `02-tokens.md` says brand files supply a dark block under both `prefers-color-scheme` and `[data-theme="dark"]`; `brand.default.css` has only the media query.

## Drift guard

`scripts/check-tokens.mjs` runs as part of the root `npm test`. Three rules:

1. Every size in `rules/02-tokens.md`'s type table matches the specific token in
   `tokens/mode.*.css`. Checks the named token, not merely that the number appears
   somewhere in the file — a substring check passes when `--text-h3` drifts 24→26,
   because `--spacing-m` is also 24px.
2. No unanchored literal in a prose table. A number beside a token name is fine;
   a bare number in a table is a call site. Explanatory prose outside tables keeps
   literals where the number is the point.
3. No chosen colour literal repeated inside a token file. Achromatic anchors
   (pure black and white at varying alphas) are exempt — those are constants,
   not values that can desynchronise.

All three are mutation-tested: each was verified to fail when the thing it guards
is broken, then restored.

What it does NOT guard: values that live only in the mode CSS with no prose home
(control heights, motion durations, row heights, per-mode measure). See the
"Resolved values" pointer item above.

4. Every token `@import` in the rules uses the canonical `.jig/tokens/` path.
   The rule markdown is both the source of truth and the artefact vendored into a
   consumer's repo, so a path correct in one context and wrong in the other is a
   dual truth that drifts. There is one location; `init` must wire to it rather
   than relocate.

5. Semantic colours meet their contrast floors — text 4.5:1, stroke-strong 3:1,
   against both light backgrounds. The source states this directly for system
   colours. `--color-text-warning` shipped at 3.64:1 in 0.1.0 and 0.2.0.

## From the check review

Findings from the whole-branch review of `check` that were triaged as non-blocking
and deliberately deferred past this fix pass (C1/C2/C3/I1/I3/I4/I6/M1/M7/M8 were
fixed in the same pass this section was added in).

- **I2 — CSS nesting silently loses the parent block's declarations.** `splitRuleBlocks`
  (`packages/cli/src/check/css.ts`) treats any block containing a nested `{` as a
  wrapper and excludes it from `leafBlocks` — correct for `@media`/`@supports`/
  `@keyframes`, where the outer block carries no declarations of its own, but wrong
  for native CSS nesting (`.card { color: red; &:hover { color: blue; } }`), where the
  outer block's OWN declarations (`color: red` here) are real and currently invisible
  to every detector that reads `leafBlocks`. Fixing this is its own piece of work: the
  block splitter needs to distinguish "this block is purely a wrapper" from "this block
  has both its own declarations and a nested rule," which changes what a "leaf" means
  and likely changes `bodyStartLine`/line-number accounting for the split declarations.
- **I5 — consumer-declared custom properties are invisible to token-aware detectors.**
  `tokens` (passed through `DetectorContext`) is only ever the vendored Jig token map
  loaded from `.jig/tokens/*.css` (`packages/cli/src/check/tokens.ts`) — a `var(--x)`
  the consumer declares themselves (in their own `:root`, a component-scoped custom
  property, a CSS-in-JS theme object, ...) is never in that map. `resolveOpaqueColor`/
  `extractColorComponents` then treat such a reference as unresolved and skip it, which
  is the safe default (no guessing) but means `contrast-floor` and `violet-band-hue`
  silently do not evaluate an entire class of real values. There is no `:root` scan of
  the consumer's own CSS to build a fuller map; adding one is a scope decision (how far
  to walk imports/scoping) rather than a small fix.
- **M2, M3, M4, M5, M6, M9** — flagged in the whole-branch review of `check` but their
  specifics were not included in the handoff that produced this fix pass. Recorded here
  as open items so they aren't lost; recovering the concrete finding for each requires
  the original review output (`packages/cli/src/check/**`, review commit range
  `6ee3ae6..34d298a` per `.superpowers/sdd/2026-08-31-jig-foundation-install/
  review-6ee3ae6..34d298a.diff`, is the diff they were reviewed against).

## Open questions raised by the source, not yet acted on

- **Shadow colour.** The source suggests using the "text strong" palette variation
  rather than black for shadows, so they sit with the rest of the interface. Ours
  use `rgb(0 0 0 / N%)`. In practice `--color-text-strong` is `rgb(0 0 0 / 90%)`,
  so the difference is small — but it is a stated divergence.
- **Disabled opacity.** The source suggests 20% for disabled states; ours is 38%.
  Note the source's own APCA table sets 30 as the absolute minimum for disabled
  button text, which 20% opacity would not reach. The two positions in the source
  are in tension; 38% is closer to satisfying its APCA guidance.
- **APCA.** The source says to check both WCAG 2 and APCA, and gives the full
  threshold table. `02-tokens.md` references APCA; `00-anti-patterns.md` does not.
  A second check rule computing APCA alongside WCAG would close this.

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
- **M1 — symlinked stylesheets are invisible.** `wholeRepoFiles`'s walk
  (`check/files.ts`) uses `readdirSync(..., { withFileTypes: true })` and only
  recurses/collects on `isDirectory()`/`isFile()`; a symlinked `.css` file or
  directory is neither, so it's silently skipped — a monorepo with a shared
  `styles/` symlinked into an app package derives and checks nothing from it.
- **M2 — CRLF gets mixed endings.** `checksum()` (`install/manifest.ts`) normalizes
  `\r\n` → `\n` before hashing, but the actual file writes throughout `init`/
  `install`/`update` do not — a file written on Windows (or checked out with
  `core.autocrlf`) can end up with LF-written new content appended after a CRLF
  header/body, or vice versa on a subsequent refresh, producing a file with mixed
  line endings even though its checksum "matches".
- **M5 — dark mode is never validated.** `validate.ts` checks the proposed brand
  colour's contrast only against light-mode `--color-bg-raised`/`--color-fill`
  (`BG_RAISED`, `BG_BASE_APPROX`). `brand.default.css` also defines a dark-mode
  block (different `--brand-l` under `prefers-color-scheme: dark`), which is never
  checked against dark backgrounds — a colour that passes in light mode could
  still fail the dark-mode contract `init` never looks at.
- **M6 — print-only snippet paths are project-root-relative but pasted into `src/`.**
  When `findWireTarget` returns `null` (ambiguous stylesheets), the printed
  `@import` snippet uses `relativeImportPath(opts.projectRoot, ...)` — correct if
  pasted at the project root, but the log tells the user to paste it into "your
  global stylesheet", which in practice usually lives under `src/` or similar.
  Pasted there verbatim, the path is wrong by exactly the depth of that directory.
- **M7 — concurrent runs are unlocked.** Nothing in `init`, `install`, or `update`
  takes a lock file or otherwise serializes writes to `.jig/` — two concurrent
  invocations (e.g. two agents, or a script that runs `jig init` in parallel across
  a monorepo's packages against a shared global install) can interleave reads and
  writes of `manifest.json`/`init-manifest.json`, corrupting the recorded checksums
  or dropping one run's file entirely.
- **M9 — nothing states `.jig/` must be committed.** Neither the README nor `init`
  itself warns when `.jig/` is gitignored. Since `init` vendors the tokens/rules a
  teammate's build and a CI `jig check` both depend on, a gitignored `.jig/` means
  the whole system silently doesn't exist for anyone who didn't run `init`
  themselves — worth a README line, and an `init`-time warning (e.g. via
  `git check-ignore`, the same mechanism I5 now uses) when `.jig/` resolves as
  ignored.
- **M10 — the pattern and mode specs have no index.** `rules.index.json` covers
  the `### X-NN` rules — the ones with a ❌/✅ pair, which is what a bucket, a
  severity and a detector describe. The `## P-NN` pattern specs and `## M-NN`
  mode specs are outside it by design; adding them makes `loadRules` throw,
  correctly, because it checks both directions and `parseRules` does not emit
  them.
  **Partly addressed:** `explain` resolves them, via `rules/specs.ts`, so a
  citation of `P-06` is no longer a dead end — it prints the spec and says it is
  a specification rather than a rule. What remains is `check`'s summary line,
  which counts 104 indexed rules and so understates what an agent can cite, and
  the absence of any validator that would accept `P-06` as a legitimate
  citation. A separate spec index, or a citation validator aware of both kinds,
  is still the fix.
- **M11 — the token contract has no width namespace.** `--color-focus` exists;
  nothing names a border width, an outline width or a focus-ring offset. Every
  rule that requires a visible border or focus ring (`E-28`, `E-29`, `P-02`'s
  3:1 shape floor) therefore ends at a call site writing `2px` by hand, which
  `H-47` forbids. A GREEN run of the invented-tokens fix hit this and reported it
  rather than inventing a value — "the token contract has no border/outline-width
  namespace, so these two widths have no semantic name to consume" — which is the
  instruction working, and also the clearest evidence the gap is real. A second
  agent, building a different component on a different fixture, hit it
  independently and reported it in the same terms: "stroke widths (`1px` borders,
  `2px` focus outline) are literals — the token contract in `02-tokens.md` defines
  no border-width namespace, so there is no token to reference." Two independent
  hits on the same missing namespace. Adding `--border-width-*` and focus-ring
  geometry is a token-architecture decision, not a mid-release patch.
