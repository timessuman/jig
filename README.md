# Jig

A design system written to be consumed by coding agents, not read by designers.

Installed as `npx jig-ui` — the bare name was taken on npm.

Framework-agnostic. Tokens are CSS custom properties; rules are stated in CSS
properties and behaviour, never in one framework's class names.

## Install

Paste the line for your agent and let it run the command.

| Agent | Command |
| --- | --- |
| Claude Code | `npx jig-ui@latest install --agent claude` |
| Codex | `npx jig-ui@latest install --agent codex` |
| Cursor | `npx jig-ui@latest install --agent cursor` |
| opencode | `npx jig-ui@latest install --agent opencode` |
| Any other agent | `npx jig-ui@latest install --agent generic` |

Add `--scope global` to install once for every project instead of just this
one. Where a global install lands depends on the agent:

| Agent | Project scope | Global scope |
| --- | --- | --- |
| Claude Code | `.claude/skills/jig/SKILL.md` | `~/.claude/skills/jig/SKILL.md` |
| Codex | `AGENTS.md` | `~/.codex/AGENTS.md` |
| Cursor | `.cursor/rules/jig.mdc` | not supported |
| opencode | `.opencode/skills/jig/SKILL.md` | `~/.config/opencode/skills/jig/SKILL.md` |
| Generic | `AGENTS.md` | not supported |

In both scopes, the rules themselves are vendored to `<root>/.jig/` — the
project root for a project-scoped install, or your home directory for a
global one.

Update later with `npx jig-ui@latest update` — files you have edited are left
alone.

Install writes the rules and the design tokens into `.jig/`. Import the tokens
your surface needs — one brand file, one mode file:

```css
@import ".jig/tokens/brand.default.css";
@import ".jig/tokens/mode.product.css";
```

Copy `brand.default.css` to `brand.<yourproject>.css` and edit that; `jig update`
will not overwrite a file you have changed.

Or let `jig init` do the above for you:

```
npx jig-ui@latest init
```

It detects your CSS system (Tailwind v4, Tailwind v3, plain CSS), derives a
brand colour from what your project already has (custom properties first,
then a Tailwind config, then the most frequent literal colour) instead of
asking cold, validates that colour against the contrast and collision
requirements stated in `brand.default.css` itself, writes
`.jig/tokens/brand.<project>.css` and `jig.config.json`, wires the `@import`
into your stylesheet when there is one unambiguous place to put it, and runs
a baseline `check` so you have a number to move. Add `--yes` to accept every
derived default non-interactively (the mode CI and agents run in). Re-running
`init` never overwrites a `jig.config.json` or brand file you have edited.

## Files

| File | Contents | Load |
| --- | --- | --- |
| `rules/00-anti-patterns.md` | 87 universal rules with corrections | **Always** |
| `rules/01-modes.md` | `editorial` / `product` / `operator` profiles | **Always** |
| `rules/02-tokens.md` | Token contract, naming, consumption | On setup, or when adding a token |
| `rules/03-patterns.md` | Component anatomy and behaviour | When building a covered pattern |
| `rules/04-principles.md` | Five frames + seven tiebreakers | Novel decisions, or rule conflicts |
| `rules/05-copy.md` | Interface text rules | Writing any user-facing string |
| `.jig/tokens/brand.*.css` | Identity. One per project. | Imported by the app |
| `.jig/tokens/mode.*.css` | Density, scale, rhythm, motion | One per surface |

`00` and `01` are the always-loaded core and are sized to stay cheap in context. `03` is the largest file and should be loaded per-pattern rather than wholesale.

## Per-project declaration

Drop this in the project root so mode selection does not require asking on every task.

```jsonc
// jig.config.json
{
  "brand": ".jig/tokens/brand.acme.css",
  "surfaces": [
    { "match": "/",         "mode": "editorial" },
    { "match": "/app/**",   "mode": "product"   },
    { "match": "/admin/**", "mode": "operator"  }
  ]
}
```

Without this file, follow the selection procedure in `rules/01-modes.md`: infer, state the inference in one line, and ask when signals conflict.

## Consuming tokens

```css
@import ".jig/tokens/brand.acme.css";   /* one per project */
@import ".jig/tokens/mode.product.css"; /* one per surface  */
```

Then `var(--color-text-strong)`, `var(--spacing-card)`, `var(--text-body)` in any framework. For Tailwind v4, wrap both imports in `@theme` to generate utilities. See `rules/02-tokens.md`.

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

**The numeric defaults are being reconciled.** Type scale, spacing steps, control sizes
and motion durations started as internally consistent guesses and are being checked, row by
row, against an external reference on interface design. `RECONCILE.md` tracks the status of
each: adopted, deliberately kept different, or still open. The accessibility floors are
outside that process — contrast ratios and target sizes come from WCAG 2.1 AA and are not
adjustable.

principles.design informed the rules-versus-principles split, and the standard
`rules/04-principles.md` is held to.
