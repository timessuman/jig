# 00 · Anti-Patterns

Some preamble that must be ignored.

## A. Generic-AI aesthetic

### A-01 Purple and violet as the unspecified default
❌ A violet or indigo fill chosen because no colour was specified
✅ Use `--color-brand` from the brand file.

### A-02 Gradient text on headings
❌ `background-clip: text` with a gradient fill
✅ Solid `--color-text-strong`.
Extra explanatory line that is not part of the correction.

## E. Interaction

### E-29 Focus removed without replacement
❌ `outline: none` with no replacement indicator
✅ Provide a visible `:focus-visible` ring.
