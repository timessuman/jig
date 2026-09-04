# Jig

A design system written to be consumed by coding agents, not read by designers.

Framework-agnostic. Tokens are CSS custom properties; rules are stated in CSS
properties and behaviour, never in one framework's class names.

Installed as `npx jig-ui` — the bare name was taken on npm.

## Two ways to use it

Jig is **a skill your coding agent reads**, and **a CLI you can run yourself**.
They are two halves of the same thing, and the split is not arbitrary:

- Of the 104 rules, **7 can be decided by a machine** — a hard-coded colour, a
  contrast ratio below the floor, a removed focus ring. The CLI decides those.
- The other **97 are judgment** — whether an empty state says anything useful,
  whether a label reads as an instruction, whether motion earns its place. No
  regex settles those. An agent reads the rules and applies them.

Running only the CLI gets you the 7. Running only the agent gets you the 97 with
no verification. **A clean `jig check` is not a clean review**, and the skill
says so to every agent that reads it.

## Quick start

```bash
npx jig-ui@latest install --agent claude   # put the skill where your agent finds it
npx jig-ui@latest init                     # set this project up
npx jig-ui@latest check --all              # see where you stand
```

Then ask your agent to build something. It reads the rules from the install and
cites them.

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

Add `--scope global` to install once for every project instead of just this one.
Every agent supports both scopes.

| Agent | Project scope | Global scope |
| --- | --- | --- |
| Claude Code | `.claude/skills/jig/SKILL.md` | `~/.claude/skills/jig/SKILL.md` |
| Codex | `.agents/skills/jig/SKILL.md` | `~/.agents/skills/jig/SKILL.md` |
| Cursor | `.cursor/skills/jig/SKILL.md` | `~/.cursor/skills/jig/SKILL.md` |
| opencode | `.opencode/skills/jig/SKILL.md` | `~/.config/opencode/skills/jig/SKILL.md` |
| Gemini CLI | `.gemini/skills/jig/SKILL.md` | `~/.gemini/skills/jig/SKILL.md` |
| Generic | `.agents/skills/jig/SKILL.md` | `~/.agents/skills/jig/SKILL.md` |

Every agent reads a `skills/jig/SKILL.md`, so adding a new harness is a config
change rather than a new code path. Codex uses the cross-agent `.agents/`
directory and additionally gets a short pointer block in `AGENTS.md` — that file
is read into every session, so it names the skill rather than restating it.

Install writes the skill file **and its rules** to one place only — beside the
skill file itself. Nothing of Jig's is vendored into your repo; your agent reads
the rules from the install. Installing at project scope when the same agent is
already installed globally warns rather than creating a second, contradicting
skill.

## Set the project up

```bash
npx jig-ui@latest init
```

`init` is the only command that writes into your repo. It detects your CSS
system (Tailwind v4, Tailwind v3, plain CSS), derives a brand colour from what
your project already has — custom properties first, then a Tailwind config, then
the most frequent literal colour — rather than interviewing you cold, validates
that colour against the contrast and collision requirements in Jig's own brand
file, writes the token files, wires the `@import`s into your stylesheet when
there is one unambiguous place for them, and runs a baseline `check` so you have
a number to move.

A single-mode project ends up with four files, all of them yours:

```
jig.config.json             route → mode map
.jig/
  state.json                bookkeeping — version, modes in use, checksums
  tokens/
    brand.<project>.css     your identity, edit freely
    <mode>.css              a copy of Jig's mode file, refreshed by `update`
```

The mode file is the one thing genuinely copied: a stylesheet `@import` is an
edge in a build graph and has to resolve locally, on every machine that builds.

**Commit `.jig/`.** It holds the token files your stylesheet imports, so a
gitignored `.jig/` means the design system does not exist for anyone who did not
run `init` themselves — their build breaks on a missing import, and CI's `jig
check` sees no token layer at all. `init` warns if it finds `.jig/` ignored.

Add `--yes` to accept every derived default non-interactively — the mode CI and
agents run in. It states the mode it chose and where to change it, because
`jig.config.json` outranks an agent's own inference. Re-running `init` never
overwrites a config or brand file you have edited.

## Commands

| Command | What it does |
| --- | --- |
| `install --agent <name> [--scope project\|global]` | Puts the skill and its rules where your agent will find them. Writes nothing else into your repo. |
| `init [--yes]` | Sets the project up: CSS system, brand colour, token files, `jig.config.json`, wired imports, baseline check. The only command that writes into your repo. |
| `check [--all] [--ci] [--json]` | Runs the rules a machine can decide. Reports findings by rule id. |
| `update` | Refreshes an install to a newer version, leaving alone any file you have edited. |
| `explain <rule-id>` | Prints a rule in full — what it forbids, what to do instead, the version it arrived in, and who checks it. Also resolves the `P-` pattern and `M-` mode specs, which no rule index contains. |

Flags worth knowing:

| Flag | Effect |
| --- | --- |
| `check --all` | Scan the whole repo instead of just changed files. Use on a first run. |
| `check --ci` | Mechanical bucket only — deterministic, and exits non-zero on any error. |
| `check --json` | Machine-readable findings, for tooling or for reading every finding when the terminal output elides repeats. |
| `init --yes` | Non-interactive; accept every derived default. |
| `install --scope global` | Install once for every project. |

**Run `update` unpinned:** `npx jig-ui@latest update`. The skill pins every other
command to the version that wrote it, so the CLI and the rules always agree;
`update` is the one command whose job is to move that pin, so pinning it would
mean it could never move.

## Using it with a coding agent

`install` puts a skill file where your agent looks, and the rules beside it. From
then on the agent loads the anti-patterns and the mode profile before building
any UI, takes the mode from `jig.config.json`, loads the pattern section for
whatever it is building, consumes tokens by name, and cites any rule it
deliberately breaks.

### Slash commands

`install` also writes a `/jig` command, so the CLI is reachable without leaving
your session:

```
/jig init          /jig check --all          /jig update
```

It runs the CLI and then does the part the CLI cannot — for `/jig check` that
means applying the 97 judgment rules to the same files and merging both halves
into one report keyed by rule id.

| Harness | Command file |
| --- | --- |
| Claude Code | `.claude/commands/jig.md` |
| Cursor | `.cursor/commands/jig.md` |
| opencode | `.opencode/command/jig.md` |
| Gemini CLI | `.gemini/commands/jig.toml` |
| Codex | — run the CLI directly; see below |
| Generic | — no harness to register with |

Codex's custom prompts are not written: `codex exec` does not expand them, so a
command file could sit there and never fire. Codex users run
`npx jig-ui@latest check` directly — the skill in `AGENTS.md` is unaffected.

**You still prompt normally.** Ask for a settings page, a data table, an empty
state — whatever you were going to ask for. What you no longer have to say is
*how*: "use the design tokens", "handle the loading state", "don't invent a
colour". That part is the skill's job, and what you get back names its own
decisions — *"P-02 forbids a column of primaries where an action repeats down a
list"* rather than "I made the button secondary."

Whether the agent picks the skill up on its own depends on the harness. Most
surface a skill by matching your request against its description, so a request
that plainly involves UI usually loads it. If it does not, say so once —
"follow the jig skill" — and it will.

Every finished piece of UI work ends with an attestation line:

```text
JIG_CHECK: version=<version> mode=<mode> mechanical=<pass|fail|skipped>:<n> judgment=<ran|skipped>
```

`jig check` emits the same line for the half it can do, with `judgment=not-run`.
If an agent reports `judgment=ran`, it ran the self-check at the end of
`rules/00-anti-patterns.md`; if it says `skipped`, it must say why.

## Using it from the command line

No agent required. `check` is a linter with a design system behind it.

```bash
npx jig-ui@latest check --all      # everything
npx jig-ui@latest check            # just what changed
npx jig-ui@latest check --ci       # for CI: deterministic, non-zero on error
npx jig-ui@latest check --json     # for tooling
```

In CI:

```yaml
- run: npx jig-ui@latest check --ci
```

`--ci` restricts to the mechanical bucket, so the result depends only on your
code — nothing model-dependent, no network. As a pre-commit hook, plain `check`
looks at changed files only.

What you will not get from the CLI alone is the other 97 rules. `check` says so
rather than letting a narrow pass read as a broad one.

## What `check` covers

It reads CSS wherever it lives:

| Where | Example |
| --- | --- |
| Stylesheets | `.css`, `.scss`, `.less` |
| `<style>` blocks | HTML, Astro, Vue, Svelte, PHP, ERB, Twig, Handlebars, MDX, ASP/ASP.NET, Razor, JSP, Phoenix, EJS, Nunjucks, Liquid, Jinja, Velocity, FreeMarker |
| Style attributes | `style="color: #777"`, `style={{ color: '#777' }}` |
| CSS-in-JS | `styled.button\`…\``, `styled(Link)\`…\``, `css\`…\``, `createGlobalStyle`, `keyframes` |
| Tailwind arbitrary values | `className="bg-[#6D28D9] p-[13px]"` |
| Tailwind palette pairs | `className="bg-white text-gray-400"` |

Host files are reduced to their style regions before the detectors run, with
character positions preserved, so a finding's line points at the real line in
your `.vue` or `.tsx` file. Application code outside a style region is never read
as CSS.

The seven mechanical rules: hard-coded values past the token layer (`H-47`),
contrast below the floor (`C-19`), removed focus rings (`E-29`), gradient text
(`A-02`), backdrop blur (`A-04`), pure black and white (`C-18`), and the
violet-band hue check (`A-01`, which asks rather than fails).

Two deliberate limits. A bare `p-4` is **not** a finding — it resolves through a
scale, which is what a scale is for, and the scale is your project's decision.
And a colour outside the framework's default palette is not resolved rather than
guessed at.

The indentation-based templates — Pug, Haml, Slim — are not read: they write
`div(style="…")` rather than markup, so they need a real extractor. `check`
names them as unscanned rather than implying coverage it does not have.

## Upgrading

```bash
npx jig-ui@latest update
```

Files you have edited are left alone. Upgrading from a pre-0.4.0 install that
vendored rules into your project's `.jig/`? `init` and `check` detect the
leftover files, report them, and — with your consent, and never for a file you
have edited — offer to remove just the install artifacts, keeping your tokens
and config untouched.

Cursor's skill moved from `.cursor/rules/jig.mdc` to
`.cursor/skills/jig/SKILL.md`; `init` finds the old file and offers the same
treatment.

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
