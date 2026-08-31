# Squint

## UI System

A design system written to be consumed by coding agents, not read by designers.

Framework-agnostic. Tokens are CSS custom properties; rules are stated in CSS properties and behaviour, never in one framework's class names.

## Files

| File | Contents | Load |
| --- | --- | --- |
| `00-anti-patterns.md` | 48 universal rules with corrections | **Always** |
| `01-modes.md` | `editorial` / `product` / `operator` profiles | **Always** |
| `02-tokens.md` | Token contract, naming, consumption | On setup, or when adding a token |
| `03-patterns.md` | Component anatomy and behaviour | When building a covered pattern |
| `04-principles.md` | Five frames + seven tiebreakers | Novel decisions, or rule conflicts |
| `05-copy.md` | Interface text rules | Writing any user-facing string |
| `tokens/brand.*.css` | Identity. One per project. | Imported by the app |
| `tokens/mode.*.css` | Density, scale, rhythm, motion | One per surface |

`00` and `01` are the always-loaded core and are sized to stay cheap in context. `03` is the largest file and should be loaded per-pattern rather than wholesale.

## Per-project declaration

Drop this in the project root so mode selection does not require asking on every task.

```jsonc
// ui.config.json
{
  "brand": "tokens/brand.acme.css",
  "surfaces": [
    { "match": "/",         "mode": "editorial" },
    { "match": "/app/**",   "mode": "product"   },
    { "match": "/admin/**", "mode": "operator"  }
  ]
}
```

Without this file, follow the selection procedure in `01-modes.md`: infer, state the inference in one line, and ask when signals conflict.

## Wiring into an agent

The mechanism differs by tool; the instruction does not.

- **Claude Code / Claude Cowork** — a skill directory, or referenced from `CLAUDE.md`
- **Cursor** — `.cursor/rules/`
- **Generic** — `AGENTS.md` at the repo root

The instruction to give it:

> Before generating or reviewing UI, load `00-anti-patterns.md` and `01-modes.md`. Load `05-copy.md` whenever you write user-facing text. Determine the mode from `ui.config.json` or by inference, and state it. Load the relevant section of `03-patterns.md` for the component you are building. Consume tokens by semantic name only. Run the self-check in `00` before finishing, and cite any rule you deliberately break.

## Consuming tokens

```css
@import "tokens/brand.acme.css";   /* one per project */
@import "tokens/mode.product.css"; /* one per surface  */
```

Then `var(--color-text-strong)`, `var(--spacing-card)`, `var(--text-body)` in any framework. For Tailwind v4, wrap both imports in `@theme` to generate utilities. See `02-tokens.md`.

## Testing that the rules work

The system is only worth its context cost if it changes output. Test it rather than assuming.

1. Pick a task with known failure modes — a form with validation, or a data table with an empty state.
2. Run it twice: once with the system loaded, once without.
3. Diff the output against the self-check in `00`.

A rule that does not change the output is either already the model's default (delete it) or too vague to act on (make it specific). Both are fixes to this system, not to the prompt.

Re-run after any significant edit to `00` or `03`.

## Changing a rule

- Values change in the token files, never at the call site.
- Rules change in `00`–`03`, never by exception in a project.
- A rule that needs an exception in two projects is wrong; fix the rule.
- Anything mode-dependent belongs in a mode profile, not in `00`.
- A new pattern earns a place in `03` after being built three times.

## Sources

Written from general UI and accessibility practice, plus the constraints specific to agent-generated output — which is where most of the structure comes from: the anti-patterns-first ordering, the mode split, the brand × mode token architecture, and the decidability test applied to every rule.

**Not yet reconciled against *Practical UI*.** The numeric defaults throughout are placeholders chosen for internal consistency, not values derived from any source. Adham Dannaway's book (2nd ed. 2024) is the intended source for most of them. See `RECONCILE.md` for the open list; where the book states a position, overwrite the default here.

principles.design informed the rules-versus-principles split, and the standard `04-principles.md` is held to.

Nothing here reproduces either source. Read the book — it teaches the reasoning that this system only records the output of.
