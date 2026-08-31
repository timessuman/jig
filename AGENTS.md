# Agent instructions — UI work

Before generating or reviewing any UI in this repository:

1. Load `00-anti-patterns.md` and `01-modes.md`.
2. Determine the mode from `jig.config.json`, or infer it using the procedure in `01-modes.md` and **state the inference in one line** before building.
3. Load the relevant section of `03-patterns.md` for the component being built.
3b. Load `05-copy.md` whenever you write a label, button, heading, error or empty state.
4. Consume tokens by semantic name only (`--color-fg`, not `--color-neutral-900`). Never write a raw colour or pixel value at the call site.
5. Run the self-check at the end of `00-anti-patterns.md` before finishing.
6. Cite any rule you deliberately break, with the reason, in one line.

Load `04-principles.md` only when two rules conflict.

Full documentation: `README.md`.
