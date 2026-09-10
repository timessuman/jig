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
_Resolved. This entry recorded six findings from the whole-branch review of
`check` as open, on the grounds that their specifics were lost in a handoff. The
specifics were not lost: commit `34d298a`, the end of the very range the entry
cites, is titled "fix: address the whole-branch review of check" and its message
enumerates all six. Each was verified closed in the current source rather than
taken on the title's word — `check` scans the project rather than the install
root; `maskComments` walks characters and skips strings; a repository with no
commits falls back instead of crashing; the inverted media-query mask is gone;
`contrast-floor` relaxes to 3:1 for large text; and the detectors no longer
require a trailing semicolon._

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
