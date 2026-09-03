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
| Gemini CLI | `npx jig-ui@latest install --agent gemini` |
| Any other agent | `npx jig-ui@latest install --agent generic` |

Add `--scope global` to install once for every project instead of just this
one. Every agent supports both scopes. Where a global install lands depends
on the agent:

| Agent | Project scope | Global scope |
| --- | --- | --- |
| Claude Code | `.claude/skills/jig/SKILL.md` | `~/.claude/skills/jig/SKILL.md` |
| Codex | `AGENTS.md` | `~/.codex/AGENTS.md` |
| Cursor | `.cursor/skills/jig/SKILL.md` | `~/.cursor/skills/jig/SKILL.md` |
| opencode | `.opencode/skills/jig/SKILL.md` | `~/.config/opencode/skills/jig/SKILL.md` |
| Gemini CLI | `.gemini/skills/jig/SKILL.md` | `~/.gemini/skills/jig/SKILL.md` |
| Generic | `.agents/skills/jig/SKILL.md` | `~/.agents/skills/jig/SKILL.md` |

Every agent except Codex reads `<harness>/skills/jig/SKILL.md` — the same
convention across the board, so adding support for a new harness is a config
change, not a new code path. Codex keeps `AGENTS.md`, since that really is a
different mechanism.

Install writes the skill file **and its reference material** (`rules/`,
`rules.index.json`, `LICENSE`, `NOTICE`) to one place only — beside the skill
file itself (`.claude/skills/jig/`, `.cursor/skills/jig/`,
`.gemini/skills/jig/`, `.opencode/skills/jig/`, `.agents/skills/jig/`). The
rules are read by your agent from the skill install, not vendored into your
repo, so a single-mode project carries four files of its own: `jig.config.json`,
`.jig/state.json`, and one brand plus one mode stylesheet.

Codex has no skill-directory convention — its instruction file is `AGENTS.md` —
so its reference bundle goes under `.codex/.jig/`: in your home directory for a
global install, in the project for a project one. Your project's `.jig/` stays
yours either way.

Installing at project scope when the same agent is already installed globally warns instead
of creating a second, contradicting skill — update the global install, or
pick a different `--agent` for the project.

Cursor's skill moved from `.cursor/rules/jig.mdc` to `.cursor/skills/jig/
SKILL.md`. If you installed Cursor support before this change, `jig init`
finds the old file, reports it, and offers to remove it — never without your
consent, and never if you've edited it.

Update later with `npx jig-ui@latest update` — files you have edited are left
alone.

Run `jig init` to set the *project* up — this is the only command that writes
into your repo:

```
npx jig-ui@latest init
```

It detects your CSS system (Tailwind v4, Tailwind v3, plain CSS), derives a
brand colour from what your project already has (custom properties first,
then a Tailwind config, then the most frequent literal colour) instead of
asking cold, validates that colour against the contrast and collision
requirements stated in Jig's default brand file, writes
`.jig/tokens/brand.<project>.css` (your identity) and a `.jig/tokens/<mode>.css`
copy for each mode `jig.config.json` declares (a build input — its `@import`
must resolve locally, so it is the one thing genuinely copied), wires the
`@import`s into your stylesheet when there is one unambiguous place to put
them, and runs a baseline `check` so you have a number to move. Add `--yes`
to accept every derived default non-interactively (the mode CI and agents run
in). Re-running `init` never overwrites a `jig.config.json` or brand file you
have edited — for a single-mode project it writes exactly 3 files:

```
.jig/
  tokens/
    brand.<project>.css   your identity, edit freely
    <mode>.css            a copy of Jig's mode file — refreshed by `jig update`
  state.json               (bookkeeping — version, modes in use, checksums)
jig.config.json             route → mode map
```

Upgrading from a pre-0.4.0 install that vendored rules into your project's
`.jig/`? `jig init` (and `jig check`, for one more minor version) detects the
leftover files, reports them, and — with your consent, and never for a file
you've edited — offers to remove just the install artifacts, keeping your
tokens and config untouched.

## Commands

Four commands. `install` and `init` are the setup; after that you mostly let
your agent read the rules and run `check` when you want the mechanical half
verified.

| Command | What it does |
| --- | --- |
| `install --agent <name> [--scope project\|global]` | Puts the skill and its rules where your agent will find them. Writes nothing else into your repo. |
| `init [--yes]` | Sets the *project* up: detects your CSS system, derives a brand colour from existing code, validates it against the contrast contract, writes `jig.config.json` and the token files, wires the imports, and runs a baseline check. |
| `check [--all] [--ci] [--json]` | Runs the rules a machine can decide. `--all` scans the repo rather than changed files; `--ci` restricts to the mechanical bucket and exits non-zero on any error; `--json` for tooling. |
| `update` | Refreshes an install to a newer version, skipping any file you have edited. Run it as `npx jig-ui@latest update` — the skill pins every other command to the version that wrote it, and this is the one that moves that pin. |

### What `check` does and does not cover

Of the rules, seven can be decided mechanically — hard-coded values past the
token layer, contrast floors, removed focus rings, gradient text, and so on.
`check` runs those. The rest are judgment, and are the agent's job: it reads
the rule files and applies them, then runs the self-check at the end of
`00-anti-patterns.md`. A clean `check` is not a clean review.

`check` reads CSS wherever it lives:

| Where | Example |
| --- | --- |
| Stylesheets | `.css`, `.scss`, `.less` |
| `<style>` blocks | Astro, Vue, Svelte, HTML, PHP, ERB, Twig, Handlebars, MDX |
| Style attributes | `style="color: #777"`, `style={{ color: '#777' }}` |
| CSS-in-JS | `styled.button\`…\``, `styled(Link)\`…\``, `css\`…\``, `createGlobalStyle`, `keyframes` |
| Tailwind arbitrary values | `className="bg-[#6D28D9] p-[13px]"` |
| Tailwind palette pairs | `className="bg-white text-gray-400"` — resolved against the default palette |

Host files are reduced to their style regions before the detectors run, with
character positions preserved, so a finding's line points at the real line in
your `.vue` or `.tsx` file. Application code outside a style region is never
read as CSS.

Two deliberate limits. A bare `p-4` is **not** a finding — it resolves through a
scale, which is what a scale is for, and the scale is your project's decision.
And a colour outside the framework's default palette is not resolved rather than
guessed at. Anything the suite still cannot read is named in the report, so a
narrow pass never reads as a broad one.

Both halves report against the same attestation line:

```text
JIG_CHECK: version=<version> mode=<mode> mechanical=<pass|fail|skipped>:<n> judgment=<ran|skipped>
```

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

`rules/*` and `rules.index.json` live beside your installed skill file, not
in the project — see above.

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
