# Jig's documentation site — design

**Date:** 2026-09-11
**Status:** proposed
**Repo:** `~/projects/jig-site` (new, outside this repo)
**Stack:** Astro 7.3.2 + Tailwind 4.3.3, static output (framework and styling fixed by the user; versions verified against npm 2026-09-11)

---

## 1. Why this exists

Two goals, and the second one is the reason it is worth doing now.

**Goal A — a real documentation website.** Jig is published on npm at 0.7.0 with
104 rules and 15 specs, and has no website. Every comparable project has one.
Someone evaluating Jig currently has to read a 359-line README on GitHub.

**Goal B — a controlled test of Jig.** Every check on Jig so far has been run by
someone who wrote Jig. The rules have never been handed cold to an agent that
knows nothing else, on a real build, with the result audited. This is that test.
The site is the pretext; the findings are the product.

Goal B constrains Goal A. If the site is built the fast way — me specifying the
design and subagents transcribing it — Goal B is destroyed, because a design that
never went through Jig proves nothing about Jig. So the division of labour below
is not a convenience. It is the experiment.

---

## 2. The experiment

### Division of labour

| | Decided by | Why |
| --- | --- | --- |
| Product brief: routes, purpose of each, content | **Me** | Product decisions, not design decisions |
| Brand: `--brand-h/s/l`, typefaces, radius personality | **Me** | Jig's own architecture says brand is declared by a human. `A-01` explicitly instructs the agent to *ask* rather than invent |
| Mode per route | **Me** | Mode is a product property — who the reader is and what they are doing |
| Everything downstream: layout, spacing, type usage, components, states, motion, copy | **Subagents** | This is precisely what Jig claims an agent can get right from the rules alone |

If I specify anything in the bottom row, I have pre-solved the problem Jig exists
to solve and the run is void.

### Conditions

- Subagents run in **fresh sessions**. They load `/jig` cold, as a real user's
  agent would. They do not inherit this conversation.
- They are given the product brief and nothing else about appearance.
- `jig check` runs on every task. It catches 6 mechanical rules and 1 hybrid.
- I audit by hand for the remaining **97 judgment-bucket rules**, which no
  detector can see. Most drift will be invisible to the CLI and visible only in
  the diff.

### The drift log

`DRIFT.md` in the new repo. One entry per deviation found, classified:

| Class | Meaning | Fix lands in |
| --- | --- | --- |
| **missing** | No rule covers this. The agent had no guidance | a new rule |
| **unclear** | A rule covers it but the agent read it differently | rule prose |
| **ignored** | The rule is clear and was not followed | a detector, or rule placement |
| **constrained** | The rule was followed and produced a worse result | the rule itself is wrong |

The fourth class matters as much as the first three and is the easiest to leave
out. A rule that is obeyed and makes the design worse is a defect.

---

## 3. Scope

### Routes

| Route | Mode | Source | Purpose |
| --- | --- | --- | --- |
| `/` | `editorial` | authored | The case for Jig. What it is, what it prevents, why an agent needs it |
| `/start` | `editorial` | authored | install → init → check, as one continuous path |
| `/rules` | `operator` | generated | Browse and filter all 119 entries |
| `/rules/[id]` | `editorial` | generated | One rule. The URL a `jig check` finding points at |
| `/rules/[id].txt` | — | generated | Plain text, for agents. No chrome, no styling |
| `/tokens` | `operator` | generated | The brand × mode token reference |
| `/modes` | `editorial` | authored | What the three modes are and when each applies |
| `/modes/[mode]` | that mode | authored | A full-page specimen rendered in that mode |
| `/cli` | `product` | generated + authored | `init`, `check`, `explain`, `install`, `update` |
| `/changelog` | `editorial` | generated | From `CHANGELOG.md` |

Roughly 10 authored pages, ~121 generated HTML pages (119 entries + tokens + changelog), and 119 generated `.txt` endpoints.

### Out of scope for v1

Tutorials namespace, blog, philosophy surface, interactive product demos,
testimonials or social proof of any kind, versioned docs for older releases.

Social proof is excluded deliberately. Both reference sites lean on it heavily
(impeccable: 67k stars and ~25 testimonials; taste-skill: a sponsor wall). Jig
has none yet, and an empty version of that section is worse than its absence.
The persuasion has to come from the artefact.

---

## 4. The design decisions that are mine

### 4.1 Mode per route, and the seam

This is the interesting one, and it is the first real pressure on
`01-modes.md:52-55`:

> Never blend two modes inside one view. A dense table inside a spacious
> marketing page is a mode error; give the table its own surface or redesign it
> as editorial content.

A conventional docs site violates this by construction: prose in the middle,
a dense persistent sidebar tree down the left, a search field and a version
switcher in the chrome. That is `editorial` content wearing `product` furniture,
in one view.

**Resolution: the site switches mode at the route boundary, and does not carry a
dense navigation tree into reading surfaces.**

- `/rules` is the dense surface. It is `operator`: tight rows, small type, many
  filters, scan-optimised. It is where you *find* a rule.
- `/rules/c-19` is `editorial`. Wide measure, prose type, generous leading, no
  permanent tree. Navigation sits at the end of the document — previous, next,
  related rules — not pinned beside it. It is where you *read* a rule.

Two consequences worth stating in advance:

1. The site-wide header exists on every route but renders at **that route's**
   density and type scale. Brand is constant; density switches. That is exactly
   what the rule prescribes, and it is different from every docs site that has
   one fixed chrome.
2. Mode specimens get **their own routes** rather than sitting side by side in
   one view. A side-by-side comparison of three modes on one page is, by the
   letter of the rule, three modes blended in one view. Honouring the rule costs
   a genuinely useful comparison view.

That cost goes in `DRIFT.md` as a **constrained** entry on day one, before any
agent touches the project. It is the first finding and I generated it, not them.
If the comparison turns out to be worth having, the honest implementation is an
iframe, because an iframe is a real separate document and therefore a real
separate surface.

### 4.2 Brand

Verified against the code rather than assumed:

| Band | Status | Source |
| --- | --- | --- |
| 235–290° violet/indigo | warns | `violet-band-hue.ts:27-28` (`HUE_MIN`/`HUE_MAX`) |
| ~0° red, ~42° amber, ~162° green | legal, but barred from interactive elements | `E-64` |
| ~220° blue | collides with `info` | `brand.default.css` |

A docs site's links *are* its interactive elements, so `E-64` effectively removes
red, amber and green from consideration.

**Direction: a deep raspberry around 330°.** Outside every band above. Because
dark mode derives `--color-bg-base: hsl(var(--brand-h) 6% 10%)` from the same hue
and lifts `--brand-l` to 88%, the palette resolves to deep magenta on warm paper
in light, and pale pink on a rose-cast near-black in dark — a genuine hue shift
between themes, produced by the architecture rather than bolted on.

Exact values are **not** fixed here. Task 0 returns a proposal; it must satisfy
`--color-brand` ≥ 4.5:1 against both `--color-bg-raised` and `--color-fill`, in
both themes, and must pass `auditTokenLayer`.

Type: one display face, one text face, one mono. Self-hosted, variable. The mono
must have a disambiguated zero, because it renders token values. Specific faces
come back with the Task 0 proposal for approval.

### 4.3 Content generation

Pages generate from the **published tarball**, not from this repo — and
crucially, **not as a dependency**:

```
jig-site/  scripts/fetch-corpus.mjs  →  npm pack jig-ui@0.7.0  →  .jig-corpus/
```

`jig-ui` must never appear in the site's `package.json`. Jig is a tool you
install — a skill and a CLI — not a package a project depends on. The docs site
is a user project like any other, and one that lists `jig-ui` in its
dependencies teaches the wrong pattern to everyone who copies it. `npm pack`
downloads and integrity-checks the published tarball without installing it,
which gets the corpus on disk, pinned and reproducible, at zero dependency cost.

`jig-ui` ships `rules/`, `tokens/`, `templates/`, `references/` and
`rules.index.json` in its tarball (`packages/cli/package.json` `files`). So:

- The docs cannot drift from the release. They are generated from it.
- If the site builds, the published asset layout is proven correct from outside
  the repo that produced it. That is a second test riding along free.
- A version bump is one constant in one script.

### 4.4 The agent route

`/rules/[id].txt` — the rule as plain text, no chrome. Agents are not the site's
audience, but they are a consumer of its URLs, and a `.txt` sibling costs one
Astro endpoint.

---

## 5. Architecture

```
jig-site/
  src/
    content/          parsed from node_modules/jig-ui at build time
      rules.ts        parser: rules/*.md + rules.index.json → typed entries
      tokens.ts       parser: tokens/*.css → declarations per brand/mode
    styles/
      jig/            written by `jig init` — NOT hand-edited
      theme.css       the barrel
      site.css        @import "tailwindcss" + @theme wrapping the barrel
    pages/            the routes in §3
  DRIFT.md
  jig.config.json
```

**Tailwind 4 interop** is already specified by Jig (`02-tokens.md:383-388`):
wrap the barrel in `@theme` and utilities generate from the tokens. Nothing
about the token layer changes. This is the first real use of that path, so
whether it actually works is itself a finding.

**Search:** Pagefind 1.5.2. Static, indexes at build time, no service, no API key.
Fits "static site" and costs one integration.

**Rule parsing** is the one genuinely non-trivial component. Format is stable —
`### A-01 Title`, then `❌`/`✅` lines, then optional prose — and `rules.index.json`
supplies bucket, severity, detector and `since`. Entries in the index with no
matching heading, or headings with no index entry, must **fail the build** rather
than be skipped. A generated docs site that silently omits rules is the same
failure class as a check that goes quiet when its subject moves.

---

## 6. Acceptance

1. `jig check` passes on the site's own source, with no exemptions in
   `jig.config.json` beyond ones I have personally approved and that are named in
   `DRIFT.md`.
2. All 119 entries render, each at a stable URL. Build fails on any mismatch
   between `rules.index.json` and the markdown.
3. Both themes pass `auditTokenLayer` on the custom brand.
4. Every route renders correctly at 320px wide, and at 200% zoom, and with
   `prefers-reduced-motion: reduce`.
5. `DRIFT.md` has entries. A run that produces none means the audit was not done.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| I leak design decisions into the brief and void the experiment | The brief is written once, reviewed against §2, and handed over unchanged |
| Subagents produce something that passes `check` and still looks bad | That is a finding, not a failure. 97 rules are judgment-bucket; if the site is ugly and green, Jig has a gap and we have found it |
| Tailwind 4 `@theme` interop does not work as `02-tokens.md` claims | Probe it in Task 0, before anything is built on it |
| `jig init` does not handle an Astro project cleanly | Task 0 runs it on a real fresh Astro app and reports what happens |

---

## 8. Task 0 — the probe, before any building

Three things, in a fresh session, in order:

1. **The A-01 test.** Hand a fresh subagent the site brief with **no brand colour
   specified** and ask it to propose the visual direction. `A-01` says the correct
   behaviour is to resolve to near-black and *ask*. Record what it actually does.
   Inventing a violet is the exact failure `A-01` exists to catch, in the wild.
2. **Scaffold + `jig init` on a real Astro 7 + Tailwind 4 app.** Report verbatim
   what `init` detects, where it puts the token layer, and what it wires.
3. **The `@theme` interop probe.** Confirm `02-tokens.md:383-388` actually works.

Nothing is built until these three report back.

---

## 9. Deferred, deliberately

**Hosting and domain.** Not decided here. The site is static output, so every
static host works and nothing in the build depends on the choice. Deciding it
now would be deciding it with less information than we will have in a week.

**Versioned docs.** The site documents one release, generated from the pinned
`jig-ui` dependency. Multi-version docs are a real feature with real cost
(URL scheme, version switcher, build matrix) and there is exactly one release
line so far.

**Dark/light toggle placement and behaviour.** A downstream design decision, so
it belongs to the subagents under `01-modes.md` and the theme contract in
`brand.default.css`, not to this spec.
