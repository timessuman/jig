# Agent instructions — UI work

Before generating or reviewing any UI in this repository:

1. Load `00-anti-patterns.md` and `01-modes.md`.
2. Determine the mode from `jig.config.json`, or infer it using the procedure in `01-modes.md` and **state the inference in one line** before building.
3. **Building a screen rather than a single component?** Read `L-01 · Layout
   method` in `03-patterns.md` and run its five steps before writing any markup.
   It is a procedure, not a component, so step 4 never selects it and nothing
   else will. (`explain L-01` prints it too, but the file is the source.)
4. Load the relevant section of `03-patterns.md` for the component being built.
4b. Load `05-copy.md` whenever you write a label, button, heading, error or empty state.
5. Consume tokens by semantic name only (`--color-fg`, not `--color-neutral-900`). Never write a raw colour or pixel value at the call site.
6. Run the self-check `L-04` at the end of `00-anti-patterns.md` before finishing.
7. Cite any rule you deliberately break, with the reason, in one line.

**Which file, and when.** `00` and `01` are the always-loaded core and are sized
to stay cheap in context. `02` is for setup or when adding a token. `03` is the
largest file — load the section for the component being built, never the whole
thing, **except `L-01`, which is not a component's section and applies to every
screen**. `04` only when two rules conflict — and fetch the one tiebreaker (`R-06`–`R-12`) rather than the file. `05` whenever you write a string.

A `##`-level id is an addressable unit in its own right: `P-` a component spec,
`M-` a mode profile, `L-` a method. `explain` resolves all three, so cite and
fetch them by id rather than by hunting for a heading.

---

## Changing a rule

This section is for work **on** Jig, not with it.

- Values change in the token files, never at the call site.
- Rules change in `00`–`03`, never by exception in a project.
- A rule that needs an exception in two projects is wrong; fix the rule.
- Anything mode-dependent belongs in a mode profile, not in `00`.
- A new pattern earns a place in `03` after being built three times.
- A numeric default that diverges from its source must say why, in one line, in
  `RECONCILE.md`. A divergence that is not argued is drift.

## Testing that a rule works

The system is only worth its context cost if it changes output. Test it rather
than assuming.

1. Pick a task with known failure modes — a form with validation, or a data
   table with an empty state.
2. Run it twice: once with the system loaded, once without. **The no-guidance
   control is the point**; if the control does not exhibit the failure, there is
   nothing for the rule to fix.
3. Diff the output against the self-check at the end of `00`.

A rule that does not change the output is either already the model's default
(delete it) or too vague to act on (make it specific). Both are fixes to this
system, not to the prompt.

Re-run after any significant edit to `00` or `03`.

---

Installation and usage: `README.md`.
