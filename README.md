# Jig

A design system written to be consumed by coding agents, not read by designers.

Framework-agnostic. Tokens are CSS custom properties; rules are stated in CSS
properties and behaviour, never in one framework's class names.

Installed as `npx jig-ui` — the bare name was taken on npm.

## Two ways to use it

Jig is **a skill your coding agent reads**, and **a CLI you can run yourself**.
They are two halves of the same thing, and the split is not arbitrary:

- Of the 130 rules, **26 can be decided by a machine** — a hard-coded colour, a
  contrast ratio below the floor, a removed focus ring. The CLI decides those.
- The other **104 are judgment** — whether an empty state says anything useful,
  whether a label reads as an instruction, whether motion earns its place. No
  regex settles those. An agent reads the rules and applies them.

Running only the CLI gets you the 26. Running only the agent gets you the 104 with
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

**Claude Code can also install a Stop hook — if you ask for it.** Add `--hook`, or
answer yes when an interactive install offers it. It adds one entry to
`.claude/settings.json`, keeping everything already in that file, and runs `jig gate`
when the agent tries to finish: it holds the agent there while the files it changed
have a `check` error or warning, or while the `/jig` command it just ran left its
work incomplete — a spec that is prose, a critique with no verdict files, a review
that never rendered the page. After three attempts it lets the agent stop and says
the work is unfinished.

A warning that is right as it stands is waived on its own line, in a comment
reading `jig-allow <ID>: <why>` (`/* jig-allow A-01: the brand is violet */`). The
reason is required, an error cannot be waived, and `check` lists every waiver it
honoured, with its reason, on every run.

The skill and the hook are installed separately. With Jig installed globally, run
`install --agent claude --hook` in a project to add only that project's hook: a
global hook would run on every stop in every project on the machine.

It is off by default, and `--yes` never adds it, because that is the path an agent
takes and nobody is there to consent. It exists because weak models skip any step
they are merely asked to run: in live runs at the capability floor, builds shipped
53 mechanical errors, pages rendered with no styles at all, and four reviews in a row
wrote no verdicts. Delete the entry to remove it; `update` moves it with the version
but never adds one.

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

`init` is the only command that writes into your repo. It runs on a project
with nothing in it and on one with years of CSS, and behaves differently in
each — because the useful thing to do differs.

### An existing site

`init` reads what you already have. It detects the CSS system (Tailwind v4,
Tailwind v3, plain CSS), derives a brand colour from the project rather than
interviewing you cold — custom properties first, then a Tailwind config, then
the most frequent literal colour — and validates that colour against the
contrast and collision requirements in Jig's own brand file. It puts the token
layer **beside the stylesheet it wires**, and adds one import to it:

```
src/styles/app.css          ← @import "./jig/theme.css"; added at the top
src/styles/jig/
  brand.<project>.css       your identity, edit freely
  mode.<mode>.css           a copy of Jig's mode file, refreshed by `update`
  theme.css                 the barrel: brand + mode, in order
jig.config.json             route → mode map
.jig/state.json             bookkeeping — version, modes, checksums
```

Nothing you wrote is touched beyond that one import line. Re-running `init`
never overwrites a config or brand file you have edited.

#### Look before you write anything

**Start with `npx jig-ui@latest check --all`.** It reads your code as it stands
and writes nothing at all — no files, no config, no import. You see what Jig
would say about the project before deciding whether to adopt it.

It is a quieter report than people expect, because Jig checks your code against
its rules, never against its own naming:

- **Your token names are yours.** `--ink-900`, `--paper`, `--space-4`: Jig has no
  opinion about what you call things, and no rule asks you to rename anything.
  What it looks for is a reference to a name that nothing in your project
  declares, which is a bug in any codebase.
- **Rules that need a fact about your project stay silent until they have one.**
  Density and type scale follow the mode, and there is no mode until you declare
  one, so those rules say nothing on a first run.
- **Hard-coded values are only reported where a token layer exists to bypass.**
  A project with no tokens is not told off for having none.

On a tidy existing page with its own tokens, a first run typically reports a
couple of specific things — a lone hex among a hundred `var()` calls, a repeated
set of cards with no list element — rather than a wall.

#### When you do run `init`

The token layer is a set of custom property declarations. Declarations nothing
references change no pixel, so adding it does not restyle your site.

- **Different names never collide.** Your tokens and Jig's sit side by side; each
  is used by whoever asks for it. You can adopt one token at a time, or none.
- **If a name is the same in both, yours wins.** The import goes above your own
  rules, and the later declaration is the one that applies.
- **One line does more than declare a token:** `color-scheme: light dark`, which
  tells the browser your page supports both, so scrollbars and form controls
  follow the reader's system setting.

#### You decide how it is wired

`init`'s default is a convenience for a project with one obvious entry point,
not a requirement. Every part of it is yours to direct, whether you do it or
tell your agent to:

- **Where the files go.** `brand` in `jig.config.json` sets the token directory.
  Put it wherever your CSS lives.
- **Whether Jig wires anything at all.** It adds the import only when there is
  one unambiguous entry stylesheet. Otherwise it writes the files, prints the
  line to add, and leaves your CSS alone for you to place.
- **How it is wired.** The barrel is two `@import`s, brand then mode. Skip it and
  import the two files yourself, take only the brand file, inline them into your
  build, or import a different barrel at each route — which is what a project
  with more than one mode does. `init` names those extra barrels and
  deliberately does not wire them: which entry point serves `/admin` is your
  routing, and it cannot see it.
- **Your edits survive.** Every file `init` writes is checksummed. Change one and
  `update` leaves it alone and says so, rather than reverting your wiring at the
  next version.
- **One constraint that is not a preference.** The tokens are declared on
  `:root`, so the layer has to reach the document globally. Imported inside a CSS
  module or a scoped component block, the tokens exist only there. Anywhere
  global is fine.

#### One page, start to finish

A project with its own tokens, no Jig. Four steps, and the report after each is
the real output:

```
$ npx jig-ui@latest check --all
  ✗ H-47   Hard-coded colour `#fff` past the token layer      src/app.css:6
  ⚠ H-119  3 sibling article.card elements are a repeated set …
  1 error, 1 warning · 8 files, 5 with styles

$ npx jig-ui@latest install --agent claude     # the skill your agent reads
$ npx jig-ui@latest init --yes                 # writes the token layer, touches no CSS
```

`init` here found no single entry stylesheet, so it wrote the files and printed
the import rather than editing anything. Adding that line yourself, and changing
one value:

```css
@import "./jig/theme.css";   /* the line init printed */
@import "./tokens.css";      /* your tokens, unchanged */

.button { background: var(--accent); color: var(--color-on-brand); }
```

```
$ npx jig-ui@latest check --all
  ⚠ H-119  3 sibling article.card elements are a repeated set …
  0 errors, 1 warning
```

The error is gone, `--ink-900` and `--paper` and the rest are exactly as they
were, and the one warning is the judgment call left for you: whether those cards
are a list. That is the whole loop. Repeat it wherever it is worth repeating.

#### A large codebase

The first `check --all` on a big repo is a long list, and the list is not a
to-do. Read it in this order:

1. **`check --all --ci` first.** Mechanical bucket, errors only, exit code you
   can put in CI. It is the short list, and every line on it is decidable.
2. **Then warnings, by rule rather than by file.** The report groups by rule id,
   and a rule firing forty times is one decision made once, not forty.
3. **Then one page at a time.** `check` defaults to the files you changed, so
   once the first two passes are done it goes quiet and stays that way for
   everything except what you touch.

Nothing obliges you to reach zero. A `check` that is quiet on today's diff is
worth more than one that was quiet on the whole repo six months ago.

#### Only the new pages

Adopting Jig everywhere is not the price of using it anywhere. The rules apply
to what you point them at:

- **New work follows the loop** — decide, spec, mockup, make, critique — and the
  Stop hook holds it to that, if you asked for the hook.
- **Old pages sit where they are.** They are not rewritten, and the default
  `check` says nothing about a file nobody has touched.
- **`jig.config.json` can exempt paths** you have no intention of revisiting, and
  the report names every exemption on every run, so an exemption list cannot grow
  quietly.
- **The token layer works the same way.** A page adopts a token when someone
  edits it to use one; no page changes on its own.

#### A page you already have

The loop assumes a page being built. For one that exists, the order changes
slightly and the commands do not:

1. **`/jig decide`** first, as always: the rules are the system's, the
   decisions are yours, and a review with no decisions to check against is half a
   review.
2. **`/jig spec <page>`**, written from the page as built. Your agent
   reads what is there and describes it — regions, hierarchy, navigation at each
   size — and you confirm or correct it. It is a description, not a redesign.
3. **`/jig critique`** then has what it needs: the rules, the spec it
   just confirmed, and your decisions. It renders the page, measures it, and
   reports.
4. **`/jig make`** fixes what the critique found, and `critique` runs
   again until it is clean or you accept what is left.

Skipping step 2 and asking for a critique on its own leaves the review with
nothing to check the page against except the rules, which is the weakest half of
what Jig knows about your project.

#### Redesigning a page you already have

The opposite job, and the loop runs in its ordinary order. The difference is what
the old page counts as: **content and constraints, not a target.**

1. **Measure the page as it is, first.** `jig probe --run <page> --save <slug>`
   records what it does today at each width — whether it scrolls sideways, whether
   the menu opens, what order it reads in. Keep it. It is the only way to say
   afterwards whether the redesign improved anything or merely changed it.
2. **`/jig decide`**, if the project has not.
3. **`/jig spec <page>`** as normal, designing forward. Take the **content** from
   the old page — its copy, its real data, the questions its FAQ answers — and
   decide the structure from the rules, not from what the markup happens to do
   now. Anything that genuinely must survive is a constraint, so say so in the
   spec: a URL that is linked from elsewhere, a field order the back end depends
   on, legal wording somebody signed off. Everything else is open.
4. **`/jig mockup`**, low fidelity, reviewed before code. This is where a
   redesign is cheap to argue about.
5. **`/jig make`** builds it, and **`/jig critique`** checks it against the spec,
   the mockup and your decisions.

The trap worth naming: carrying the old structure across because it is there. A
page redesigned from its own markup ends up the same page with new colours. The
old page is the brief's content; the rules and the spec decide its shape.

Adopting Jig is additive. The pressure to move values into tokens arrives when
you start using them, not on the day you install.

### A brand-new site

There is no CSS to read, so there is nothing to derive from and nowhere obvious
to wire. `init` says so rather than guessing:

```
Detected: unknown
Token layer: jig/ — no stylesheet found to follow, so the project root.
Could not find a single unambiguous stylesheet to wire the import into.
Add this near the top of your global stylesheet:
  @import "./jig/theme.css";
```

The brand colour resolves to the unbranded near-black default, which ships a
coherent monochrome UI and makes the missing decision visible instead of
inventing a purple (`A-01`). Set `--brand-h/-s/-l` in the brand file when you
have decided, or tell your agent to ask you.

Add `--yes` to accept every derived default non-interactively — the mode CI and
agents run in.

### Where the token layer goes

Beside the stylesheet it wires, so it sits with the rest of your CSS rather than
in a dotfolder next to your lockfile. `src/styles/jig/` in a project whose CSS
lives in `src/styles/`, `app/assets/stylesheets/jig/` in a Rails app, `jig/` at
the root when there is no stylesheet to follow. `init` prints the path it chose.

Set `brand` in `jig.config.json` to put it somewhere else. Projects set up
before 0.7.0 keep their `.jig/tokens/` layout; `update` does not move them, and
`init` offers to.

The mode file is the one token file copied verbatim from the package: a
stylesheet `@import` is an edge in a build graph and has to resolve locally, on
every machine that builds. The brand file and the barrel are generated for your
project, not copied.

**Commit the token directory** — `<css dir>/jig/`. It holds the files your
stylesheet `@import`s, so ignoring it means the design system does not exist for
anyone who did not run `init` themselves: their build breaks on a missing import,
and CI's `jig check` sees no token layer at all.

**Commit `.jig/` too.** It is not the tokens (it was, before 0.7.0). It holds
`state.json`, which records the version and checksum of every file `init` wrote
and is what `update` reads to know what it may refresh, plus the durable record of
the design loop: your specs, approved mockups and critique verdicts. Ignored, a
teammate's `update` cannot tell a file you edited from one it wrote, and every
spec the project agreed is invisible to the next agent. `init` warns if it finds
either directory ignored.

Add `--yes` to accept every derived default non-interactively — the mode CI and
agents run in. It states the mode it chose and where to change it, because
`jig.config.json` outranks an agent's own inference. Re-running `init` never
overwrites a config or brand file you have edited.

## Commands

| Command | What it does |
| --- | --- |
| `install --agent <name> [--scope project\|global] [--hook]` | Puts the skill and its rules where your agent will find them. Writes nothing else into your repo, unless you ask for `--hook`. |
| `init [--yes]` | Sets the project up: CSS system, brand colour, token files, `jig.config.json`, wired imports, baseline check. The only command that writes into your repo. |
| `check [--all] [--ci] [--json]` | Runs the rules a machine can decide. Reports findings by rule id. |
| `update` | Refreshes an install to a newer version, leaving alone any file you have edited. |
| `seo [--json]` | Audits what a search engine and a link preview read, across the whole project: a route whose metadata says `noindex` sitting in the sitemap, two pages claiming one title, a sitemap that lists nothing or lists paths a crawler drops. Whether a sitemap and a robots file exist is counted, not reported: no rule asks for either, and a site with no domain yet cannot write an honest sitemap. Needs no config, no decisions and no spec. |
| `verdicts <surface>` | Verifies a critique's verdict files and computes its counts: every rule in each pass judged once, no id that does not exist, no rule in the wrong arm, and no verdict the render probe contradicts. |
| `probe` | Prints the render probe — one expression the critique runs in a browser at each width. It operates the menu, measures sideways scroll, and reads whether the styles and tokens applied. |
| `gate` | Run by the Stop hook `install` adds for Claude Code, not by hand. Blocks an agent from finishing while `check` fails on the files it changed, or the step it just ran left its work unfinished. |
| `explain <rule-id \| word> [--list]` | Given an id, prints a rule in full — what it forbids, what to do instead, the version it arrived in, and who checks it. Also resolves the `P-` pattern and `M-` mode specs, which no rule index contains. Given a **word**, searches every title and body and lists what matches, so you can find a rule you cannot name. `--list` prints every id, or one section's. |

Flags worth knowing:

| Flag | Effect |
| --- | --- |
| `check --all` | Scan the whole repo instead of just changed files. Use on a first run. |
| `explain --list` | Every rule id and title. Add a section letter (`explain G --list`) for one section. |
| `check --ci` | Mechanical bucket only — deterministic, and exits non-zero on any error. |
| `check --json` | Machine-readable findings, for tooling or for reading every finding when the terminal output elides repeats. |
| `init --yes` | Non-interactive; accept every derived default. |
| `install --scope global` | Install once for every project. |
| `install --hook` | Add the Stop hook (Claude Code, project scope). Off unless asked; `--no-hook` declines without being asked. |

**Run `update` unpinned:** `npx jig-ui@latest update`. The skill pins every other
command to the version that wrote it, so the CLI and the rules always agree;
`update` is the one command whose job is to move that pin, so pinning it would
mean it could never move.

### As slash commands

Every command is also a slash command in your agent, installed alongside the
skill. `/jig check --all` does what `npx jig-ui check --all` does, and then acts
on the result — the CLI reports, the agent applies the judgment half.

| Slash command | Equivalent |
| --- | --- |
| `/jig init` | `jig init` — then states the mode it chose and what it wired |
| `/jig check` | `jig check` — then applies the 104 judgment rules and reports both halves |
| `/jig explain C-19` | `jig explain C-19` — prints the rule as-is, without paraphrasing it |
| `/jig explain contrast` | `jig explain contrast` — every rule matching a word, when you do not have an id |
| `/jig install --agent cursor` | `jig install --agent cursor` |
| `/jig update` | `jig update` |
| `/jig seo` | `jig seo` — then reports what a stranger meets before the page, and what one file cannot see |
| `/jig decide` | No CLI. Once per project: interviews you and writes the project-wide decisions, with a reason for each |
| `/jig spec invoice page` | No CLI. What exactly is being built — a page, feature or functionality — at its smallest useful version, at every screen size |
| `/jig mockup` | No CLI. Low-fidelity design of that spec, reviewed before code — in HTML, Figma or Google Stitch, whichever you choose |
| `/jig make` | No CLI. High-fidelity: builds the actual page or feature from the spec and mockup |
| `/jig critique` | `jig verdicts` + `jig probe`. Scrutinises what was built against the rules, its spec and its mockup: two reader arms write their verdicts to files, the CLI decides whether the review is complete, and a browser probe checks the verdicts against what the page actually does |

`decide` runs once. The other four run for each page, feature or functionality, one
at a time — never the whole product at once.

Where each lands:

| Agent | Slash command file | Scope |
| --- | --- | --- |
| Claude Code | `.claude/commands/jig.md` | project or global |
| Cursor | `.cursor/commands/jig.md` | project or global |
| opencode | `.opencode/command/jig.md` | project or global |
| Gemini CLI | `.gemini/commands/jig.toml` | project or global |
| Codex | `~/.codex/prompts/jig.md` | **global only** |
| Generic | — | none |

Two exceptions, both deliberate.

**Codex** takes its command globally only: OpenAI documents custom prompts as
loading from `~/.codex/prompts` with no project-scoped equivalent, so a project
install writes no prompt file. Its skill works either way — and OpenAI
deprecates custom prompts in favour of skills for exactly that reason, since a
skill can be shared through your repository while a prompt stays on one machine.

**Generic** gets no slash command at all. `.agents/skills/` is a cross-agent
convention for *skills*, not a harness with a command system of its own, so
there is no file to write and nothing that would read one. Ask in plain language
instead; the skill still loads.

## What a search engine reads

A page's title, description and preview text are copy, and they drift because a
copy pass reads pages and nobody reads `<head>`. Jig treats them as copy: the
spec decides whether a page is indexable and what it claims, `make` writes the
metadata in the same change as the headline, and `check` holds the budgets.

**Which pages are meant to be found is decided by mode, not by taste.**
`editorial` is first-visit content, so it is indexable and needs its own title
and description. `product` and `operator` are what somebody reaches after signing
in, so they must carry `noindex` — an admin screen in a search result is an
invitation, and a sign-in page in one invites credential stuffing. A spec
overrides the default per page, with a reason: a CV shared by link, a
confirmation page, a page written for one recipient.

`robots.txt` is not that mechanism. It is public and advisory, and naming a path
in it tells strangers where to look; a path is safe to name only when something
else protects it.

`jig seo` covers what one file cannot: a route that says `noindex` and sits in
the sitemap anyway, two pages claiming one title, a sitemap of paths a crawler
drops. It writes nothing and needs nothing, so it is safe to run on the first
day, or on somebody else's codebase.

## Using it with a coding agent

`install` puts a skill file where your agent looks, and the rules beside it. From
then on the agent loads the anti-patterns and the mode profile before building
any UI, takes the mode from `jig.config.json`, loads the pattern section for
whatever it is building, consumes tokens by name, and cites any rule it
deliberately breaks.

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
JIG_CHECK: version=<version> mode=<mode> mechanical=<pass|fail|skipped>:<n> warnings=<n> judgment=<ran|skipped>:<n> files=<n> styled=<n>
```

`jig check` emits the same line for the half it can do, with `judgment=not-run`.
`mechanical=pass` means no errors; `warnings=` is counted beside it, because the
mobile detectors warn rather than fail CI and a page can carry `pass:0` while
not working on a phone.
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

What you will not get from the CLI alone is the other 95 rules. `check` says so
rather than letting a narrow pass read as a broad one.

## What `check` covers

It reads CSS wherever it lives:

| Where | Example |
| --- | --- |
| Stylesheets | `.css`, `.scss`, `.less` |
| `<style>` blocks | HTML, Astro, Vue, Svelte, PHP, ERB, Twig, Handlebars, MDX, ASP/ASP.NET, Razor, JSP, Phoenix, EJS, Nunjucks, Liquid, Jinja, Velocity, FreeMarker |
| Indented style blocks | Pug (`style.`), Haml (`:css`), Slim (`css:`) |
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

**It also reads the token layer itself.** The token layer is not application
code, so no detector scans it — but it is where a mistake costs most, since every
call site inherits it. `check` reads back what is declared there and holds it to
the floors the token layer claims: 4.5:1 for text roles, 3:1 for interface
strokes, **in both light and dark**, plus `--text-prose` at 18px and
`--size-touch-target` at 48px. Only floors, never density: `--size-control` at
28px is a deliberate `operator` choice, and reporting it would teach you to
ignore the ones that matter.

This is what makes a hand-written or agent-written token layer safe to have.
`init` validates a colour once, when it writes it; without this, anything edited
afterwards was never looked at again.

Two deliberate limits. A bare `p-4` is **not** a finding — it resolves through a
scale, which is what a scale is for, and the scale is your project's decision.
And a colour outside the framework's default palette is not resolved rather than
guessed at.

Anything the suite still cannot read is named in the report, so a narrow pass
never reads as a broad one.

## What Jig does not check

**Security.** There is a small section of rules about what an interface does to
itself — a new-tab link handing over the window it left, user content written
into the page as markup, a password field fighting the manager, a third-party
frame with nothing narrowing it, a secret printed on screen, an error naming the
stack. That is the interface's own surface, and it is all Jig can see.

It knows nothing about sessions, rate limits, CORS origins, secrets, headers,
dependencies or your hosting's assumptions. A clean `jig check` says nothing
about any of them, and should never be quoted as if it did. Use something built
for that, and keep its findings where you keep this one's.

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

| File | Contents |
| --- | --- |
| `rules/00-anti-patterns.md` | 112 universal rules with corrections |
| `rules/01-modes.md` | `editorial` / `product` / `operator` profiles |
| `rules/02-tokens.md` | Token contract, naming, consumption |
| `rules/03-patterns.md` | Component anatomy and behaviour |
| `rules/04-principles.md` | Five frames + seven tiebreakers |
| `rules/05-copy.md` | Interface text rules |
| `<css dir>/jig/brand.*.css` | Identity. One per project. |
| `<css dir>/jig/mode.*.css` | Density, scale, rhythm, motion |
| `<css dir>/jig/theme.css` | The barrel — brand + mode. This is what you import. |
| `.jig/state.json` | What `init` wrote, with checksums. `update` reads it to leave your edits alone. |
| `.jig/specs/`, `.jig/mockups/`, `.jig/critique/` | The design loop's record: what was agreed, what was drawn, what the review found. |

`rules/*` and `rules.index.json` live beside your installed skill file, not
in the project — see above.

Which of these an agent loads, and when, is `AGENTS.md`.

## Per-project declaration

Drop this in the project root so mode selection does not require asking on every task.

```jsonc
// jig.config.json
{
  // Where the token layer lives. `init` writes the brand file here and puts
  // the mode files beside it. Omit it and the layer follows your own
  // layout — beside the stylesheet init wires, or the project root.
  "brand": "src/styles/jig/brand.acme.css",

  // One entry per surface. This outranks an agent's own reading of the
  // project, so it is worth getting right before `init` runs.
  "surfaces": [
    { "match": "/",         "mode": "editorial" },
    { "match": "/app/**",   "mode": "product"   },
    { "match": "/admin/**", "mode": "operator"  }
  ],

  // Files that render OUTSIDE the cascade, where a literal is the only thing
  // that works: an OG card serialised into an SVG `foreignObject` carries no
  // stylesheet, and a PDF drawn by a React renderer never sees CSS.
  //
  // Prefer an exact path. An exemption is a claim about ONE file's rendering
  // context, and that is usually literally true of one file. Reach for a glob
  // only where the directory exists to hold them — `src/cv/pdf/**` is a fact
  // about that tree; `**/*-card.tsx` is a naming coincidence that would also
  // excuse every real card component you have.
  //
  // `check` names the pattern and its match count on every run, and says so
  // when one is excusing enough files to look like a mistake. Nothing is ever
  // exempt by default: this list is the only source.
  "exempt": ["src/components/og-card.tsx", "src/cv/pdf/**"]
}
```

Without this file, follow the selection procedure in `rules/01-modes.md`: infer, state the inference in one line, and ask when signals conflict.

## Consuming tokens

### Plain CSS, any framework

One import, the barrel:

```css
@import "./jig/theme.css";
```

Then `var(--color-text-strong)`, `var(--spacing-card)`, `var(--text-body)`
anywhere — plain CSS, CSS modules, styled-components, Vue, Svelte, Rails. They
are ordinary custom properties and nothing takes a dependency on anything.

### Tailwind v4

The same import. Jig needs nothing from Tailwind and Tailwind needs nothing from
Jig:

```css
@import "tailwindcss";
@import "./jig/theme.css";
```

That is what `init` wires, and it is enough. Every token is readable as
`var(--color-text-strong)` from any component.

**Optionally**, Tailwind can also generate utility classes from the tokens —
`p-card`, `rounded-surface`, `text-text-strong`. It only does that for names
declared in a `@theme` block, so `init` offers to generate one:

```css
@import "tailwindcss";
@import "./jig/utilities.css";   /* the generated @theme block */
```

`init` asks before writing it, because it changes how every component in the
project is written and both styles are correct. Under `--yes` it declines and
tells you how to get it.

One set of utilities serves every mode: the utility references the variable
rather than a resolved value, so whichever mode barrel a route loaded supplies
it. No `dark:` variants, nothing per-mode.

**Do not nest the import inside `@theme`.** Tailwind rejects it — *"@theme
blocks must only contain custom properties or @keyframes"* — and Jig's tokens
cannot move into one regardless, since they live in `:root` and are redeclared
under `[data-theme="dark"]` and a `prefers-color-scheme` query. That structure
is what makes dark mode work.

Full detail, including why a duplicate declaration in the compiled CSS is
correct and must not be "fixed": `rules/02-tokens.md`.

---

Working on Jig itself rather than with it: `AGENTS.md` for how an agent should
change the rules, `RECONCILE.md` for where each numeric default came from.
