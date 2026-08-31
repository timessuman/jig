# Known follow-ups — carried out of the foundation branch

Recorded during subagent-driven execution of `docs/superpowers/plans/2026-08-31-jig-foundation-install.md`.
Each was reviewed, judged non-blocking for v0.1.0, and deliberately deferred. The final
whole-branch review triaged them; nothing here blocks merge.

## Fix before the next release

- **Rule `C-49` has a ❌ but no ✅ correction.** The only rule of 104 lacking one (87 headings,
  87 ❌ lines, 86 ✅ lines). `00-anti-patterns.md` states every rule carries a correction, so the
  file contradicts itself in an artifact agents read as authoritative. Writing it is a design
  decision, not a code fix. It also blocks that rule from ever carrying a `fix` codemod.
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
