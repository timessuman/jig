# Changelog

## 0.17.2

Four defects found by building one page with the full loop.

### Fixed

- **Every mode declares every token name.** `editorial` had no row heights or
  `--font-numeric`, and `product` and `operator` had no ambient durations. A
  project with two modes shares one alias block, so those aliases resolved to
  nothing on the routes of the mode that lacked them; a real site's editorial
  pages had three undefined utilities, and the probe failed them. Each mode now
  states a value for each name (ambient motion is `0s` outside `editorial`),
  and `check-tokens` Rule 14 fails a mode file that declares a name another
  does not.
- **The gate no longer marks a critique as touched by writing its own lock.**
  0.17.1 judged only critiques touched this session, but a critique session
  wrote a lock into every critique folder, and the next stop read that write as
  a touch. Locks are now written only for the critiques in play, and the lock
  file is ignored when dating a folder.
- **The probe does not take an in-page section list for the site menu.** A
  `<summary>` in a `<nav>` inside `<main>`, `<article>` or `<aside>` is page
  navigation; judging it as a menu failed a rule page's "More in this section"
  disclosure for not behaving like one.
- **Every example fits 320 by 260.** The examples README promised about
  320 by 180; one figure was 363px wide and four were taller. The bound is now
  stated as measured, the two outliers are trimmed, and a test renders all 286
  figures in Chrome and fails any wider or taller.

## 0.17.1

### Fixed

- **The gate judges the critiques a session touched, not every critique.**
  A spec for one page could not finish because another page's critique
  predated 0.17.0, whose new rules that critique had never judged, and a
  record the project had set aside still failed for screenshots it no longer
  had. The gate now checks a critique with a file changed since the session
  began, and the current spec's surface after `critique`. A folder whose name
  starts with `_` is set aside and never judged. With no transcript, as when
  the gate is run by hand, it checks every critique as before.

## 0.17.0

Thirteen more tells of a generated page, ten of them caught by `check`, and a
picture for every rule. Also carries the probe and verdict fixes tagged as 0.16.2,
which was not published to npm.

### Added

- **Thirteen rules.** `A-135` a kicker above every heading, `A-136` an eyebrow
  chip over the headline, `A-137` cream and beige by reflex, `A-138` an italic
  serif display headline, `A-139` a side-tab accent border, `A-140` a thick
  coloured border on a rounded element, `A-141` cards inside cards, `A-142` the
  soft rounded card, `A-143` a decorative grid or stripe background, `A-144`
  dark mode with glowing accents, `G-145` a pulsing status dot, `A-146`
  numbered section labels, `F-147` asking for more than the task needs.
- **Ten detectors for them**, reading both the CSS and the utility classes in
  markup, and joining the two where a page splits them (a pulse or a serif
  declared on a class, worn by the element). All warnings; the rules are hybrid.
  On seven pages built with no guidance, every instance of these tells found by
  eye was reported, and every report was a real instance.
- **`examples/`: a dont and a do for all 143 rules**, shipped in the package.
  Each is a small self-contained HTML fragment that renders the same in a
  sandboxed frame or an inert box. `jig explain <ID>` names the file, and
  `packages/preview/examples.html` shows them all side by side.

### Fixed

- **A probe no longer fails while Chrome shuts down.** Its temporary profile
  was deleted the moment Chrome was killed; under load the delete raced
  Chrome's last writes, threw, and failed a probe whose measurement had
  succeeded. It now waits for Chrome to exit and retries the delete.
- **`jig probe --run <page> --serve <dir>` measures a built static site.** A
  build links its styles from the site root, so opened as a file nothing loaded
  and the probe measured an unstyled page. The CLI now serves the build
  directory on a local port. The stamp is still the page file's checksum on
  disk, and the gate re-renders a served probe the same way.
- **Verdicts are `critique`'s own.** `make`, fixing three findings, rewrote
  those verdicts to `ok` itself and the gate accepted it. The gate now records
  the verdict files when a `critique` session stops, and stops any later
  session that changed them without running `critique`.

### Changed

- `A-04` names glass applied everywhere, `A-06` the same equal-card reflex at
  any count, `I-81` the page's headline, and `I-89` button labels as well as
  links.

## 0.16.1

### Fixed

- **The corpus's own headings follow I-118.** Twelve `R-` titles ("Frame 1:
  Minimise usability risk", the seven tiebreakers) and `L-01`'s six steps used
  an em dash. Headings are interface text wherever they show, in `explain`, in
  `check` output and on a rendered page, so they now use a colon.
- **A quotation keeps its own punctuation.** I-118 now says text marked as a
  quotation with `<blockquote>` or `<q>` is the source's words, and changing
  it would misquote it; the page's own copy around it is still held to the
  rule. The render probe leaves quoted text out of its dash scan. Without
  this, a page quoting a rule verbatim could never pass its review.
- **A spec's `indexable:` is `true` or `false`.** A sentence on that line was
  read as nothing, the mode's default was used, and a correct page was
  reported as contradicting J-123. Anything else is now a spec-shape problem,
  and an error in `verdicts` that names the field.

## 0.16.0

With more than one mode, every barrel names its mode, and none sits in the
global stylesheet.

### Changed

- **`theme.<mode>.css` for every mode, once there are two.** `init` kept
  `theme.css` for the first mode and left it wired into the global stylesheet,
  so a second mode's routes loaded the first mode's tokens globally and their
  own from their layout, and got whichever came last. Now each barrel names its
  mode, the global stylesheet keeps only what every route shares (Tailwind and
  `utilities.css`), and each route's layout imports its own barrel. A project
  with one mode is unchanged: `theme.css`, wired globally.
- **A project gaining a second mode is migrated.** An unedited `theme.css`
  becomes `theme.<first mode>.css`, and every stylesheet import that resolves
  to it is removed, found by where it points rather than by guessing the file.
  An edited one is left, with a note on where its edits belong. `check` names a
  `theme.css` left beside two modes.

## 0.15.1

### Fixed

- **A question anywhere in the message is a question.** 0.15.0 let an owner
  pause through only when the message's last line ended in `?`. `decide` asks
  its round, then shows an example answer, then says "answer for your own
  project", so the message ends on a full stop, and the gate refused the first
  live `/jig decide` three times. Any sentence ending in `?` now counts; a `?`
  in a URL or a code span does not.

## 0.15.0

The gate holds an agent on warnings, waits while it asks the owner a question,
and reaches projects where the skill is installed globally.

### Changed

- **`gate` blocks on warnings in the files the agent changed**, not only on
  mechanical errors. One em dash survived two runs of fresh agents on a real
  site: the first saw the warning, called it pre-existing, and finished. The
  gate still reads only changed files, so old warnings elsewhere never trap an
  agent, and it now also runs when a changed file carries interface text.
- **The skill asks the user to run each command.** `decide`, `spec`, `mockup`,
  `make` and `critique` hold their procedures in the command, not in the
  skill. An agent told in prose to "run decide" made up five questions of its
  own and wrote a `DECISIONS.md` with no direction and no `## Unresolved`
  section.

### Added

- **`jig-allow <ID>: <why>`** waives one warning, on its own line or the line
  above, in any comment syntax. Some warnings are a detector's guess: `A-01`
  cannot tell a chosen violet from a default one. Warnings only, a reason is
  required, and `check` lists every waiver it honoured, with its reason, on
  every run. Waived findings are left out of `warnings=`.
- **`install --agent claude --hook` on a global install** writes only this
  project's Stop hook. The hook was written only by a project install, which is
  refused while the skill is global, so most projects never had a gate.

### Fixed

- **A question to the owner is not a finish.** After `decide`, `spec` or
  `mockup`, a stop whose last message asks a question is allowed, and the
  command's output is checked on the stop after the answer. Before, the gate
  refused `decide`'s first question because `DECISIONS.md` did not exist yet,
  and on the second refusal the agent wrote the file itself with no answers.
- **The gate finds `DECISIONS.md` beside the token layer** that `brand` in
  `jig.config.json` names. It looked in three fixed places, rejected a
  correctly placed file, and the agent moved the file to satisfy it.
- **`jig seo` says an endpoint is not a page**, so `pages=` can be checked
  against a site's route files.

## 0.14.1

`jig seo` cites only what a rule says.

### Fixed

- **No finding for a missing sitemap or robots file.** Both were filed under
  rules that do not ask for them: `J-123` is about a page that must not be
  indexed and says `robots.txt` is not it, and `J-124` is about a sitemap that
  contradicts the pages. A project with no domain yet cannot write an honest
  sitemap, so the only way to clear the old finding was to invent one. Both are
  now counts on the `JIG_SEO` line.
- **A sitemap of paths is a `J-124` error.** A `<loc>` that is `/about` rather
  than a full URL was read as a route, although a crawler drops it. `J-124` now
  names that case and says no sitemap is the honest one until there is an
  origin.
- **`pages=` counts pages.** It counted any file that mentioned `<title>` or
  `<meta>`, so a build script, a test, a data module and a layout were pages and
  a home page inheriting its layout was not. A page is now a route a framework
  serves, or a whole-document template outside the layout and partial folders.
  A dynamic route counts once.
- **Framework routes match their sitemap entries.** `src/pages/admin` was read
  as `/pages/admin`, so a `noindex` Astro or Next page listed in the sitemap
  went unreported.

## 0.14.0

What a stranger meets before the page, what the page must not hand them, and a
project that states its own direction.

### Added

- **`J-120` to `J-127`, search and sharing.** A page a stranger reaches through
  a search result or a pasted link is judged on what that reader meets first: a
  title that names this page and not the site, a description that says what the
  page holds, a canonical URL where more than one address serves the same
  content, and a share image where a link is meant to be shared. A page that
  must not be indexed says so in the page, not only in `robots.txt` — an
  operator surface is the case the rules were written around.
- **`jig seo`.** A project-level audit the page rules cannot do from one file:
  a `noindex` route listed in the sitemap, two pages claiming the same title, a
  site with no sitemap or no `robots.txt`, a sitemap with nothing in it. It
  reads metadata wherever the framework puts it, and it does not require
  `DECISIONS.md` — a project without one still gets the audit.
- **`K-128` to `K-134`, safety at the interface.** This is not a security
  review, and nothing here should be read as one. It is the set of interface
  decisions that are also safety decisions: markup built from text a reader
  supplied, a link opened into a new context, a form that submits across
  origins, a credential or a token rendered into the page, an error that quotes
  the system back at the reader. There is no `jig secure` command, because a
  command implies a guarantee this cannot make.
- **`L-01` Step 6, how the layout collapses.** A composition is not finished
  until you have said what happens to it at each width where the content needs
  it: reduce the count, never the size; order survives; distinction survives;
  type comes from the fluid scale, not from a breakpoint; content wider than
  the screen scrolls inside itself rather than pushing the page sideways.
- **A fourth judged width: 1600.** Three widths never asked what an unbounded
  layout does with room it was never given. A measure that keeps growing, a
  row that keeps stretching and a page that turns into a gutter with a line of
  text in it only show themselves past the desktop width. `jig probe` renders
  360, 768, 1280 and 1600, and `spec` composes for all four.
- **The project's own decisions are judged, one verdict each.** `DECISIONS.md`
  is the file the agent is most likely to read once and then drift from, so
  `jig verdicts` now carries a `decisions=` arm: every decision in the file is
  judged against the page, and an unjudged decision is a failure like any other.

### Changed

- **`/jig decide` asks for the north star and the personality.** The north star
  is the product's, not a page's — what someone can do that they could not
  before, and what the product gives up to do it. A page's own purpose stays
  `spec`'s question and inherits its direction from here. Personality is asked
  through the four things that produce it, each named with the token it
  becomes: type, colour, corners, language. An owner with no gut feeling is
  asked what the reader already uses — and pointed away from direct
  competitors, because a project that borrows from one looks like a
  second-rate version of it.
- **Every question in `decide` and `spec` carries an example answer**, in the
  form that can be checked beside the form that cannot. A question that takes
  five minutes of thought to parse gets a worse answer than the same question
  with an example attached.
- **Adopting Jig in a project that already has CSS.** The README now says
  plainly what happens: the rules are read before anything is written, the
  token layer is wired how you choose, and there are four ways in — one page
  start to finish, a large codebase, only the new pages, and a page you
  already have. Redesigning an existing page is its own path, and `spec` asks
  different questions when the page exists.

## 0.13.0

Meaning before presentation, and one fewer step anyone can skip.

### Added

- **`H-119` A generic element where a native one says what the content is.**
  The rule carries a decision order: what is this content, is there a native
  element whose meaning is that, does it describe it accurately, does order or
  relationship matter, can CSS do the presentation, and only then a generic
  container. It is not a rule against `div` — a `div` is right where nothing
  more specific is true, and an approximate element is worse than a generic
  one because it asserts something untrue. Presentation must not be required
  to understand the content.
  Its detector decides what the source can: a page with no `<main>`, a row of
  destinations in a header or footer with no `<nav>`, a generic element named
  or styled as a heading, and a repeated set on a page with no list or table.
- **`jig probe --run <page> --save <surface>`.** The CLI renders the page
  itself, at 360, 768 and 1280, in a headless Chrome, Chromium or Edge it
  finds for itself — including the browsers Playwright or Puppeteer have
  already downloaded. No dependency: Chrome's own debugging protocol over the
  WebSocket client Node has had since 22. The Stop hook runs it before judging
  a critique, so a review is measured whether or not anyone remembered to.
- **The probe measures markup order against reading order.** A block the CSS
  lifts above the one that precedes it in the markup is reported, whatever the
  verdicts say. Two columns side by side are not an inversion: putting the
  sidebar after the main content and moving it left is the correct pattern.
- **The probe reads the rendered text for em dashes.** A string built in code —
  a description assembled in a framework's frontmatter, a label written by a
  script — reaches the page having passed no file check.

### Changed

- **`I-118` reads every place a reader sees text.** Every template language the
  suite knows, and the markdown a framework renders as pages. Repository
  documents are still exempt, and capitals now mean "document" only beside the
  lockfile, so `docs/FAQ.md` is a page. Code is not copy: a script's text is
  read only between real tags.
- **The scan skips `.claude`, `.codex`, `.cursor`, `.opencode`, `.gemini` and
  `.github`.** Jig's own vendored rules are not the project's interface.
- **Probe files are version 3.** Older ones no longer validate.

## 0.12.0

### Added

- **`I-118` Em dashes in interface text.** Use a full stop, a comma, a colon
  or a second element. The mark is ambiguous on its own: it stands in for
  four different ones, and the reader only learns which after reading past
  it. It is also the clearest tell of machine-written copy, and copy that
  reads as generated is copy the reader trusts less. The `em-dash` detector
  reads element text and the attributes a reader hears or sees; scripts,
  styles, comments, class names and documentation are not interface text.
  The en dash keeps its one job, a range read as "to" (`2-10 seats`).

## 0.11.1

Two holes in the gate, both found by running the loop twice on 0.11.0 —
once on Haiku, once on Sonnet.

### Fixed

- **The Stop hook's block budget is per failure, not per session.** A
  headless session keeps one session id across every `/jig` step, so a run
  that spent its three blocks on `init`, `spec` and `make` reached
  `critique` with none left: it reported "complete and approved, zero
  findings" having written no verdict files, and the gate that would have
  caught it had already let go. Fixing a failure now returns its attempts,
  a new failure starts fresh, and an agent that cannot fix a given failure
  still gets out after three tries.
- **`nav: horizontal bar (no menu)` is no longer read as a menu button**
  at a width where the links fit. A false positive is how a gate gets
  ignored.

## 0.11.0

One release, one lesson: a measurement an agent can type is not a
measurement. Everything here came from two live runs at the capability
floor the day 0.10.0 shipped.

### Added

- **`jig probe --save <surface>`.** The CLI writes the probe file now. It
  reads what the probe returned on stdin, checks it is probe output for a
  page inside the project, and stamps it with that page's checksum and the
  time. A run had written its own probe file by hand — five links and an
  Escape key that closed a menu with thirteen links and no Escape handler —
  and its review passed on those numbers.
- **`install --hook` / `--no-hook`.** The Stop hook is opt-in. An
  interactive install offers it once and takes silence as no; `--yes` never
  adds it, because that is the path an agent takes and nobody is there to
  consent. `update` moves an existing hook and never adds one.

### Changed

- **Probe files are version 2.** `jig verdicts` rejects a probe with no
  stamp — nothing measured it — and one whose page changed after it was
  taken. Version 1 files no longer validate.
- **README and `init` say which directory to commit, and why.** The tokens
  live in `<css dir>/jig/`; `.jig/` holds `state.json`, specs, mockups and
  critique verdicts. Both are warned about separately, each with what
  ignoring it costs. Since 0.7.0 both had said `.jig/` holds the tokens.

## 0.10.0

Mobile-first, and a design loop that a weak model cannot skip. Everything here
was measured on live runs at the capability floor (Haiku), and most of it exists
because an instruction the agent could choose to ignore was ignored.

### Added

- **The loop: `decide` → `spec` → `mockup` → `make` → `critique`.** `decide`
  runs once per project. The other four run per page, feature or functionality.
  `mockup` is new: a low-fidelity grayscale drawing, reviewed before any code,
  in HTML (the default), Figma or Google Stitch. Every region is labelled with
  its measured size, and the phone frame draws the menu open as well as closed.
- **`jig verdicts <surface>`.** A critique's reader arms write one verdict per
  rule to `.jig/critique/<surface>/screen.json` and `code.json`; this command
  decides whether the review is complete and computes the counts the attestation
  reports. It refuses invented ids, a rule filed by the wrong arm, a rule judged
  twice, an `n/a` whose reason says the rule was never read, and `rendered: true`
  with no artefact. A screen pass with no render is `skipped`, not `ran`.
- **`jig probe`.** One expression the critique evaluates in any browser at 360,
  768 and 1280. It operates the phone menu (does it open, does `aria-expanded`
  change, does the label read as close, does Escape close it), measures sideways
  scroll, and reads whether the styles and tokens actually applied. `verdicts`
  refuses a verdict the probe contradicts.
- **`jig gate`, run by a Stop hook** — off unless you ask for it with
  `install --hook`, or say yes when an interactive install offers it. It blocks
  an agent from finishing while the files it changed fail `check`, or while the
  `/jig` command it just ran left its work unfinished. After three attempts it
  lets go and says the work is not done. `--yes` never adds it: that is the
  agent's path, and nobody is there to consent. `update` moves an existing hook
  to the new version and never adds one.
- **Six mobile rules.** `D-111` a page that never adapts, `D-112` `100vh`,
  `F-113` form text that zooms on iOS, `D-114` a bar under the notch,
  `D-115` a page that scrolls sideways, `E-116` a menu that cannot be opened or
  cannot say it is open.
- **`H-117` a token name nothing declares.** A `var()` naming a property no file
  declares makes its whole declaration invalid, so the page silently loses its
  font, spacing and borders. Three of four live builds shipped exactly that,
  and every file-based check passed them.
- **`P-14` site navigation**, composed for the phone first: what to show at each
  width, a named menu control whose state is visible and announced, `aria-current`
  styled from the attribute, and no sideways-scrolling nav row.

### Changed

- **`spec` writes a whole composition per screen size**, phone first, with
  `regions:` and `nav:` at each — not one composition and a note about narrow
  screens. A menu button at a width where the links fit is refused: where the
  button sits is the project's decision, whether it exists at that width is not.
- **`make` finishes on three gates**: a pasted `JIG_CHECK` with no mechanical
  errors, a region-by-region comparison with the approved mockup at each width,
  and each size's spec fields accounted for.
- **`critique` operates the page** instead of only looking at it, judges the
  `P-` patterns the spec uses, and sends its findings back to `make` until the
  page is clean or the user accepts what is left, by id.
- **`decide` records what is still open** in an `Unresolved` section, and writes
  only reasons the owner gave.
- **`explain` searches every line of every rule**, and the free sections of the
  reference, not only titles and preambles.
- **`check` warns** when `jig.config.json` is unreadable or declares a mode the
  token layer does not import, and counts those warnings in `JIG_CHECK`.
- **`L-01`'s squint test runs on a grayscale render** where a browser exists;
  reading the source is the fallback, not the equal.
- **`init --yes` says what it did not decide** — no surface mapping, and
  re-running `init` after you declare one.

## 0.9.0

One new rule and one amended correction, both from the same afternoon of
dogfooding and both about the same blind spot: H-47's correction always pointed
at a token, so an agent reading it literally always produced one.

### Added

- **`B-105` Monospace sized by a guessed ratio.** No rule in the corpus
  mentioned monospace or inline `code` at all — `jig explain monospace` returned
  nothing — while `brand.default.css` ships a `--font-mono` stack, so every Jig
  project has the pairing and none had guidance on it.

  Shrinking inline code by a ratio is right for faces drawn apart, where a mono
  face often does sit larger at the same `font-size`. In a superfamily it is
  wrong: IBM Plex Sans and IBM Plex Mono are both x-height 51.6 and cap-height
  69.8 per 1000 units — identical — and mono is *narrower*. A `0.9em` there sets
  code at x-height 46.8 inside text at 52, creating the mismatch it was meant to
  remove. The rule asks for one measurement, once per project, when the brand
  file is written.

  It deliberately has no token. Inline `code` appears inside body text,
  headings, table cells and captions; one multiplier has to be right for all
  four, and a fixed token is worse — it collapses code in a heading to caption
  size. Inheriting is correct in every host.

### Changed

- **`H-47`'s correction names a third branch.** It offered "reference the token"
  or "a value that cannot be expressed as a token indicates a missing token".
  Both end in a token. Twice in a row on Jig's own documentation site the right
  answer was **deletion** — the `0.9em` above, and a `min-width` in `em` on a
  table column that `max-content` measures for free. An agent following the text
  as written invents `--text-code: 0.9em` and entrenches a value that should not
  exist. The correction now says to check "should this value exist at all"
  before minting a token.

  `rules.index.json`'s `fix: token-substitute` on H-47 encoded the same
  assumption and is now `token-substitute-or-remove`. Nothing consumes that
  field yet, which is why it was worth correcting before something does.

- **Rule count is 105.** The attestation line and the README's counts move with
  it.


## 0.8.2

Every fix here was found by a consumer using Jig rather than by Jig checking
itself: the documentation site was upgraded to 0.8.1 and then styled in
Tailwind, which is the first time Jig's Tailwind guidance had been followed
end to end by anything other than its own tests.

Three of the four are the same shape — two places answering one question, and
disagreeing without either knowing the other existed.

### Fixed

- **`H-47` read a value differently depending on how it was spelled.**
  `00-anti-patterns.md:11` sets the scope of the whole rule file: "**Framework:**
  agnostic. […] Where a utility-class framework is in use, translate — the rule
  is about the resulting style, not the syntax." The detector was the exact
  inverse, in both directions at once. Its CSS branch matched `px` alone and
  excluded `0/1px/2px`; its Tailwind branch matched ten units and excluded
  nothing. So `font-size: 0.9em` was silent while `text-[0.9em]` was an error,
  and `p-[1px]` was an error while `padding: 1px` was not.

  A project on plain CSS got a clean `check` for code a Tailwind project got
  eight errors for. Found by converting a real stylesheet to utilities without
  changing one computed value and watching the report go from `No findings` to
  eight; the two declarations responsible had been in that file since it was
  written and had never been flagged. Both branches now read one definition.

  **This widens what `check` reports.** A stylesheet carrying `1rem` or `0.9em`
  past the token layer was always an H-47 violation and is now reported as one,
  so a repo that was clean under 0.8.1 can have findings here without its CSS
  having moved.

- **The naming contract named namespaces Tailwind does not have.**
  `02-tokens.md` opened with "an alias block can expose **any of them** as
  Tailwind utilities" over a table of thirteen. Three generate nothing in
  Tailwind v4 — `--duration-*`, `--measure-*` and `--focus-ring-*` — and
  `--duration-*` shared a row with `--ease-*`, so only half of that row worked.
  Aliasing one is accepted, emits the custom property, and produces no rule, so
  the class lands on the element and does nothing: the same silent failure the
  file warns about 190 lines later, reached from the opposite direction. The
  table now carries a **Utility** column, and the three say how to be read from
  a class instead — `max-w-(--measure-prose)`, which keeps the semantic token
  and satisfies `H-47` without going through `@theme`.

  `init`'s own generator was wrong in both directions. It correctly filtered
  `--measure-*` and `--focus-ring-*`, and it also filtered `--size-*` and
  `--border-width-*`, which both generate working utilities — `size-control`
  sets width and height, `border-hairline` sets a border width. Jig was
  withholding correct aliases for its own tokens, and a test asserted that as
  correct, which is how it survived.

- **`check` did not say which files it had looked at.** It defaults to the
  files changed since HEAD and falls back to the whole repo when that diff is
  empty. Nothing in the output said so, so the same repo reported `files=31` on
  a clean tree and `files=9` with nine files touched, minutes apart, with
  nothing committed — and a consumer bisected it by reverting files one at a
  time to find out why.

  Worse, `mechanical=pass:0` on a dirty tree means "nothing in your diff
  fired", not "the project is clean", and the skill tells an agent to run
  `check` before finishing — exactly when the tree is dirty and the scope is
  narrowest. The exempt line compounded it: `src/content/rules.ts (matches
  nothing — check the path)` was printed for a path that exists, is tracked,
  and had matched a file on the previous run. The glob was fine; it matched
  nothing *within the narrowed set*, and "check the path" sends you to debug a
  correct config.

  The summary now names the scope, a narrowed run says a clean result is not a
  clean project, the exempt note distinguishes "no such path" from "not in this
  scan", and `--all`'s help says it widens the files rather than the rules —
  which is how it had been read.

- **A flag written across two lines vanished from the metadata guard.**
  `registeredFlags` read `src/index.ts` line by line and required the flag
  string to sit on the same line as `.option(`, so reformatting one option to
  fit a longer description dropped `--all` from the parsed set and from every
  guard built on it. Caught by its own canary the moment an option wrapped.


## 0.8.1

Both fixes here are the same shape: 0.8.0 corrected the instance it was looking
at and left the class alone, and in each case the commit message claimed a
verification that had only checked the file it had just edited. Both were found
by inspecting the published tarball rather than the working tree.

### Fixed

- **Four rule files still shipped author notes.** 0.7.x removed the section
  headed "Notes for the author (not for the agent)" from `00-anti-patterns.md`
  after an agent read it as "license to go tighter than the shared default" and
  halved the radius scale on that authority. `01-modes.md`, `03-patterns.md`,
  `04-principles.md` and `05-copy.md` carried a section under the same heading
  and kept shipping it to every agent that installed Jig.

  `01-modes.md` was the worst of them: it told the reader to **"Change them in
  `tokens/mode.*.css`"** and closed with **"it is your call"** — an invitation
  to edit the token layer, which is the one thing Jig's architecture reserves
  for a human. `03-patterns.md` described navigation and cards as "deliberately
  absent… add them once you have built enough". `05-copy.md` pointed at
  `03-brand.md`, which does not exist. The content moves to
  `docs/house-positions.md` unchanged; only its audience changes.

- **`02-tokens.md` contradicted its own Tailwind fix 352 lines earlier.** The
  compatibility table near the top still read *"Tailwind v4 | Wrap in
  `@theme { }`"* — the exact instruction the section below it retracts with
  *"Earlier versions of this file told you to, and Tailwind rejects it
  outright."* The table is the part an agent reads first, so the correction
  shipped underneath the error it corrected. A second, softer restatement
  ("the same file can be wrapped in `@theme`") is gone too. `@theme` now first
  appears in the section that explains it correctly.

- **`jig explain` rendered a dangling `---` in 14 of the 15 pattern and mode
  specs.** `parse.ts` has always dropped bare separator lines; `specs.ts` is a
  separate code path and never did, so every `P-` and `M-` spec that is
  followed by a separator in the source carried it into the rendered body,
  between the last paragraph and the footer. Spotted on `P-12`, but it was
  never about `P-12`. Table separators (`| --- |`) are untouched.

- **`jig init`'s refusal without a terminal offered a way out that does not
  work.** The message ended *"(To choose the mode without a terminal, write
  jig.config.json first — init honours it.)"* The guard runs before any config
  is read, so a config alone still exits 1. The sentence was true about mode
  selection and false in a paragraph about not having a terminal, so it read as
  a third alternative when it is a modifier on the first — a cold agent
  followed it literally, hit the identical error, and allocated a
  pseudo-terminal with Python's `pty` to get past it. It now says a config does
  not replace `--yes`, and what the two do together. Nothing covered this path;
  three tests now do.

### Added

- **`check-tokens` rule 13 — no shipped rule file addresses the author.** The
  guard that should have existed for the 0.7.x fix. It reads `rules/` from disk
  rather than a hardcoded list, so a rule file added later cannot escape it the
  way those four did, and it checks the second-person tells ("your taste", "it
  is your call", "my inclination is") as well as the heading, because a rename
  would otherwise defeat it. Each tell is verified to fire on reintroduction.

## 0.8.0

Everything here was found by handing Jig to agents that had never seen it and
asking them to build something real — its own documentation site. None of it
was found by the test suite, which passed throughout.

Minor rather than patch: `explain` prints lines it did not print before, and
`init` can write a file it did not write before.

### Fixed

- **`jig explain` discarded most of the reasoning in the rules.** The parser
  kept the first `❌` and the first `✅` and threw away everything else. **41 of
  104 rules carry prose outside that pair — 103 lines.** `A-04` explains why
  shadow-only definition cannot hold 3:1; `C-22` loses sixteen lines; `C-49`
  leads with a three-row table distinguishing when a link needs colour, when it
  needs an underline, and when neither is required — and its pair alone says
  "keep the underline". All of it shipped in the tarball, installed into every
  skill directory, and was unreachable through the command built to read it.

- **`02-tokens.md` documented a Tailwind arrangement that fails.** It told every
  reader to write `@theme { @import "./jig/theme.css"; }` and claimed it yields
  `bg-surface`, `rounded-surface`, `p-card` and `text-body` as utilities.
  Tailwind 4 rejects it: *"@theme blocks must only contain custom properties or
  @keyframes."* The tokens cannot move into `@theme` regardless — it requires
  them top-level and unnested, while they live in `:root` and are redeclared
  under `[data-theme="dark"]` and a `prefers-color-scheme` query, which is what
  makes dark mode work. The flat import is what works, and is what `init`
  already wired without being told.

- **`02-tokens.md` named a token location the tool had stopped using.** It said
  tokens live at `.jig/tokens/`, that this was "the only location, in every
  scope and every project", and that "nothing relocates them" — while `init`
  printed `Token layer: src/styles/jig/` in the same run. `check-tokens` rule 4
  hardcoded the same path in a comment anticipating and forbidding this exact
  change, so the guard held the claim in place and would have failed the build
  on anyone correcting it. Shipped in 0.7.1.

- **A section headed "Notes for the author (not for the agent)" shipped to every
  agent.** The heading was a label, not a mechanism: the file is in the tarball
  and installs into every skill directory. A probe read it, quoted the
  `A-07`/`A-08` line back as "the author's own notes… license to go tighter than
  the shared default", and halved the radius scale on that authority. Moved to
  `docs/house-positions.md`.

- **The published package shipped no changelog**, despite the repo holding 32KB
  of one. Staging and `files` now change together, which the tarball guard
  already enforced.

- **`A-01` had no stated scope for "then ask".** Two agents given the same brief
  split on it — one shipped the unbranded default and deferred, the other
  proposed a hue and argued the proposal *was* the ask — both citing the same
  conflict-resolution clause. The rule now says a proposal is a question with a
  suggested answer, not a decision.

- **`B-11` capped line length and stated no floor**, so a column could be halved
  indefinitely and still pass. Measured on the documentation site: two
  side-by-side panels rendering prose at 41 characters, in a mode whose
  `--measure-prose` selects 68. The 40–80 band existed in `02-tokens.md` but not
  in the file an agent reads for a line-length decision.

### Added

- **Three detectors for the anti-slop rules, and a self-check that names them.**
  Section A is Jig's answer to "what is AI slop" — fourteen rules for the
  defaults a model reaches for when nothing was specified. **Three had
  detectors.** The other eleven were enforced by one self-check question —
  *"would this look different from a generic template?"* — which an agent that
  has just produced a generic template answers yes to, and whose `A-01 → A-10`
  range silently excluded `A-58`, `A-59`, `A-60` and `A-67`.

  Jig's own documentation site shipped `<span aria-hidden="true">❌</span> Don't`
  in the chrome of all 104 rule pages with `check --all` reporting nothing.

  `A-05` (emoji as iconography) and `A-10` (placeholder content) were never
  judgment calls — an emoji in a text node is a regex, and so is "lorem ipsum".
  `A-09` (marketing voice) is the first **mode-gated** detector: it fires in
  `product` and `operator`, stays silent in `editorial` where that register
  belongs, and stays silent when no mode is declared rather than guessing.

  The remaining eight stay judgment. Detecting "a container around every group"
  needs to know what an element is and how heavy it looks, and six noisy checks
  that fire on correct code is how a linter gets switched off. What reaches them
  is the self-check, rewritten to name each tell the way every other item does.

- **`check` reports what it examined.** `0 errors · 104 rules, 0 fired` was
  byte-identical whether forty components were examined and found clean or
  nothing was examined at all. It now reads `· 26 files, 4 with styles`, the
  `JIG_CHECK:` record carries `files=` and `styled=`, and a run where nothing
  carried a style region says **"Nothing inspected."** rather than "No
  findings." Both counts, because `.ts` and `.tsx` are style-bearing by
  extension and the file count includes parsers and configs that can never
  produce a finding.

  Worth knowing: `check` defaults to changed files, so on a clean tree it scans
  almost nothing. That was always true and always looked like a pass.

- **`init` offers a Tailwind v4 alias block.** The flat import gives you tokens,
  not utility classes — Tailwind only generates those for names declared in
  `@theme`. `init` can now generate that block, and **asks first**: it changes
  how every component in a project is written, both styles are correct, and
  silence is no. Under `--yes` it declines and says how to get it.

  Only the 18 Tailwind namespaces are aliased. `--size-*`, `--measure-*`,
  `--focus-ring-*`, `--border-width-*` and `--opacity-*` have none, and aliasing
  one emits a declaration that generates nothing. 189 declared names filter to
  87 — and the filter also excludes every primitive `02-tokens.md` says never to
  consume directly.

  The generated file explains why `--radius-surface: var(--radius-surface)`
  appears beside Jig's own declaration in the compiled CSS: Tailwind's lands in
  `@layer theme`, Jig's is unlayered, and unlayered beats layered regardless of
  source order. Without that note, someone finds it and "fixes" it.

- **The skill treats Tailwind setup as an ask.** Finding Tailwind in a project
  is not permission to change how every component in it is written. The agent
  reports what it found, shows both arrangements, and waits — and is told never
  to write `@import "tailwindcss"` into a project that does not already have it.

- **A guard that staged assets stay out of git.** Adding `CHANGELOG.md` to the
  prepack staging list committed a build artifact, because
  `packages/cli/.gitignore` is a hand-maintained list that nothing forced into
  step. On its first run the new guard caught a second, pre-existing hole:
  `references` had been staged and unignored since it was added, saved only by
  the directory not existing yet.

### Corrected

- **0.7.0's notes said the non-TTY refusal "names the three ways out".** It
  names three; two work. The guard runs before any config is read, so
  `jig.config.json` alone still exits 1 — it selects the mode once you are past
  the guard, it does not get you past it. The message is unchanged here and
  recorded in `docs/known-follow-ups.md`, because the right wording depends on
  whether the guard should consult the config first, which is a behaviour
  question rather than a copy one.

## 0.7.1

A rule file that contradicted the tool, and the guard that kept it that way.

Patch: the shipped rules change, but no command writes anything different.

### Fixed

- **`02-tokens.md` named a token location that 0.7.0 stopped using.** It said
  tokens live at `.jig/tokens/`, that this was "the only location, in every
  scope and every project", and that "nothing relocates them". Since 0.7.0 the
  layer follows the project: `init` puts it beside the stylesheet it wires and
  prints the path it chose. So a single `init` run told you `Token layer:
  src/styles/jig/` while the rule file an agent is explicitly told to load
  before writing token code insisted that directory could not exist.

  The file also disagreed with itself — four absolute examples, and one
  relative one added when the Tailwind section was written.

  It now describes the real behaviour, says pre-0.7.0 projects keep their
  layout, and points at the `theme.css` barrel so relocating the layer costs
  one line instead of every stylesheet.

- **`check-tokens` rule 4 was holding the claim in place.** It hardcoded the
  same path, in a comment that anticipated and forbade this exact change:
  "nothing — including a future `init` — relocates them". It was checking the
  documentation against itself rather than against the CLI, so it could not
  see the drift and would have failed the build on anyone correcting it.

  It now asserts what stays true as the layer moves: token imports shown in
  the rules must be relative. Mutation-tested in both directions.

### Corrected

- **0.7.0's notes said the non-TTY refusal "names the three ways out:
  `--yes`, a real terminal, or writing `jig.config.json` first."** The third
  is not a way out on its own. The guard runs before any config is read, so a
  config alone changes nothing — it selects the *mode* once you are past the
  guard. `jig.config.json` plus `--yes` works; `jig.config.json` alone exits 1
  with the same message that suggested it.

  The message itself is unchanged in this release and still reads as though
  the config were a third alternative. It is recorded in
  `docs/known-follow-ups.md` rather than reworded here, because the wording
  that is actually right depends on whether the guard should consult the
  config first — a behaviour question, not a copy question.

### How these were found

Not by the test suite, which passes 631 tests either way. By handing the rules
to agents that had never seen this repository and asking them to build
something real. Everyone who could have caught the token-location defect
already knew where the tokens were.

## 0.7.0

A silent no-op, fixed, plus the missing half of 0.6.0's token-layer move.

Minor rather than patch, and the call is arguable. The non-TTY fix is a
correction; the relocation offer is new behaviour that can move files, though
only interactively and only with consent. Taking the higher of the two is the
reading that does not understate the change, and anyone who might be prompted
to move their token layer should read these notes.

### Fixed

- **`jig init` without `--yes` exited 0 having written nothing when stdin was
  not a terminal.** It printed the first prompt, read EOF, and stopped. Every CI
  step, every piped invocation, and every agent shelling out without a TTY got a
  silent no-op — and exit 0 having done nothing is the worst outcome available,
  because the caller cannot tell it from success and then acts on a token layer
  that was never created. Confirmed identical in 0.5.0, so this predates the
  prompts added since. It now fails where the cause is still visible and names
  the three ways out: `--yes`, a real terminal, or writing `jig.config.json`
  first.

### Added

- **`init` offers to move a legacy `.jig/tokens/` layout** to the location your
  project's own structure suggests. 0.6.0 deliberately left an upgraded project
  where it was — a silent relocation could break an import you wrote that `init`
  knows nothing about — but that meant the improvement only ever reached new
  projects, and the way out was one line of output that is easy to miss.

  Interactively it asks; under `--yes` it declines and says how. Moving is all
  four halves or none: write at the new location, remove the old copies, strip
  the stale import before wiring the new one, and update `jig.config.json` so
  the next run does not go back for them. A file you have edited is never
  removed — it is named and left for you to clear.

  ```text
  BEFORE  @import "../../.jig/tokens/brand.acme.css";
          @import "../../.jig/tokens/mode.product.css";
  AFTER   @import "./jig/theme.css";
  ```

## 0.6.0

The token layer stops hiding in a dotfolder, and `check` starts reading it back.

Both came from the same question: who should write the tokens. The answer turned
out to depend on something that did not exist — **nothing validated the token
layer's own declarations.** `init` checked a brand colour once, at write time,
and no command ever looked again. A generated file edited afterwards, by a person
or an agent, went unexamined: `--color-text-weak` dropped to 22% opacity and
`check` reported "No findings". With that closed, where the files live and who
writes them become ordinary decisions rather than load-bearing ones.

**Upgrading:** run `npx jig-ui@latest update`, then `npx jig-ui@latest init`.
Existing installs keep their `.jig/tokens/` layout — nothing moves unless you
move it, because relocating files could break an import you wrote yourself.

### Added

- **`check` validates the token layer** (`check/token-audit.ts`). Text roles to
  4.5:1, interface strokes to 3:1, **in both themes**, plus `--text-prose` at
  18px and `--size-touch-target` at 48px. Alpha foregrounds are composited over
  each surface first — Jig's foregrounds are alpha by design, so a ratio before
  compositing means nothing. Only floors, never density: `--size-control` at 28px
  is a deliberate `operator` choice, and reporting it would teach you to ignore
  the ones that matter.
- **`H-47` enforces the half of itself it only stated.** Its correction always
  read "consume the semantic role, not the primitive"; the detector caught raw
  hex and raw px and nothing else. `color: var(--brand-l)` was silent — and it is
  the worse case, because it looks exactly like correct token usage while reading
  a bare number and bypassing every theme override.
- **`exempt` in `jig.config.json`.** Some surfaces render outside the cascade: an
  OG card in an SVG `foreignObject` carries no stylesheet, a PDF renderer never
  sees CSS. Those files were in permanent violation, which is an adoption blocker
  — a check that cannot pass is a check people switch off.

  Nothing is exempt by default and no filename is baked in; this list is the only
  source. Every run reports the **pattern** and what it excused, because an
  over-broad glob does not fail — `check` simply gets quieter, and quieter looks
  like progress:

  ```text
  5 file(s) exempt via jig.config.json and not scanned:
    src/*-card.css  (5 files — likely too broad, review it)
    src/nope.css  (matches nothing — check the path)
  ```

  Prefer an exact path. An exemption is a claim about one file's rendering
  context, and that is usually literally true of one file. `src/cv/pdf/**` is a
  fact about a tree; `**/*-card.tsx` is a naming coincidence that would also
  excuse every real card component in the project.
- **One import per surface, through a barrel.** `jig/theme.css` imports the brand
  file and one mode file; your stylesheet imports that single line and then never
  changes again. Switching mode rewrites Jig's file, not yours.

### Changed

- **The token layer follows your project's layout.** `.jig/tokens/` was right
  everywhere by being right nowhere — a tool dotdir holding product source,
  reached from a Rails stylesheet by `@import "../../../.jig/tokens/…"`. The
  default is now a `jig/` directory beside the stylesheet being wired, so the
  import is `./jig/theme.css` in every ecosystem. `jig.config.json`'s `brand`
  now decides placement, not just wiring — it previously honoured the path only
  when the file already existed, which is the one case where it does not matter.
- **The mode is chosen before `init` runs.** It is the most consequential thing
  `init` writes and the thing it is worst at choosing: `--yes` took `'/' → product`
  without reading the project, and that config then outranks every agent's later
  inference. The command file now tells the agent to ask what the product is, map
  each surface, write the config, and only then run. `init` also reports the
  surfaces it **used** rather than the ones it defaulted to — with a config
  present it had been announcing a default it was about to ignore.
- A barrel holds exactly one mode, never a merge. Importing all three into one
  document leaves only the last; verified in a browser, it yields `operator`
  throughout. `01-modes.md` already said why that is not a loss: density switches
  at the route boundary, never inside one view.

### Fixed

- `--text-prose`, `--size-touch-target` and every semantic colour are now held to
  their floors after `init` as well as during it.
- **`H-47`'s built-in token-layer skip was over-broad.** It matched
  `(brand|mode).*.css` with the directory optional, so a project's own
  `src/legacy/brand.colors.css` was silently exempt from the primitive check
  wherever it sat. Scoped to the token layer's directory now — Jig owns `jig/`
  outright, and a filename that merely looks like one of ours is a coincidence.
- The token audit follows the token layer instead of reading a fixed directory.
  It was written when `.jig/tokens/` was the only possible answer, so moving the
  layer made it find nothing and report nothing — caught in a pre-release smoke
  test, where a brand file edited to 22% opacity passed cleanly. A check that
  goes quiet when its subject moves is worse than one that was never written,
  because the silence reads as a pass.
- Tailwind v4 does not scan workspace packages — documented, with the `@source`
  directive it needs. Nothing errors when this bites: the class lands on the
  element, no rule exists to match it, and the style simply does not apply.

## 0.5.0

Four things shipped in 0.4.0 were broken in ways that reported success. `/jig
update` refreshed to the version already installed and said "Updated Jig →
0.4.0". Dark mode could not be reached by choosing it. `check` skipped nearly
every colour in a project that had not run `init`. And the reconciliation of
every numeric default against an external reference is finished — 0 rows open —
which is where most of the rest of this release came from.

**If you are on 0.4.0, run `npx jig-ui@latest update` from a terminal.** The
`/jig update` fix cannot deliver itself: your command file is the broken one, so
the slash command will keep reporting a successful no-op until the CLI replaces
it. Once, from the terminal, and the slash command works from then on.

### Fixed

- **`/jig update` could never upgrade anyone.** Every subcommand is invoked at
  the installed pin so the CLI and the vendored rules agree; `update` is the one
  exception, because its job is to move that pin. The skill file knew that and
  the slash command did not, so it ran `npx jig-ui@<installed> update` — a no-op
  that reports success, which is worse than an error.
- **Dark mode was unreachable by explicit choice.** `brand.default.css` had one
  dark block, inside `@media (prefers-color-scheme: dark)`. A selector inside a
  media query cannot match when the query is false, so `data-theme="dark"` on a
  light-mode system produced no dark tokens at all. A second, unmediated block
  now carries the same declarations, and a check keeps the two identical.
- **`check` did not resolve the project's own tokens.** The token map held only
  Jig's vendored `.jig/tokens/*.css`, so any `var(--your-token)` was
  unresolvable and skipped. On a project that had never run `jig init`,
  `contrast-floor` and `violet-band-hue` evaluated very nearly nothing. A name
  declared in two places with different values is still skipped — which value a
  browser uses depends on import order, and a wrong guess reports a finding
  against a value the page never renders.
- **`operator` prose text was 16px** against the 18px floor `B-75` states and
  `02-tokens.md` repeats. It is the mode most likely to be read for hours.
- **Rules cited tokens that do not exist** — the `--color-danger` family,
  `--color-surface`, `--leading-heading`, `--leading-display`,
  `--font-weight-body`, `--spacing-unit`. An agent following those wrote a
  `var()` resolving to nothing, with no error anywhere.
- **`C-19` named the same token twice**, once "for large text only".
  `--color-text-weak` clears 4.5:1 at any size, and there is no lighter grey.
- **The error message in `P-03` moved above the input**, where autofill menus
  and on-screen keyboards do not cover it.
- **CSS nesting and line endings.** `install` and `update` had three near-copies
  of one write helper and one had lost its line-ending handling, so `update`
  flattened a CRLF token file to LF while leaving the rule files beside it
  alone. All three now share `install/writer.ts`, and writes are atomic.

### Added

- **`P-13 · Ambient motion`** — a third category of motion the system lacked.
  Interaction and transition motion are milliseconds; ambient motion is slow,
  looping and decorative, and must never be noticed. `G-44` forbade all of it by
  stating a 300ms ceiling it had never scoped, so an agent asked for a slow
  decorative loop would have refused, citing a rule about something else.
- **`--duration-ambient-fast/base/slow`** (3s / 4.7s / 7.1s), `editorial` only.
  The values are mutually prime in tenths of a second so layered loops do not
  re-align into one visible pulse.
- **Fluid headings.** `--text-h1` and `--text-h2` are `clamp()` in `editorial`
  and `product`, reaching their minimum at a 360px viewport and their maximum at
  1024px. Every term is `rem`-based: a `px` or bare-`vw` bound ignores a
  reader's font-size preference, which is a WCAG 1.4.4 failure.
- **`explain` finds rules you cannot name.** A word searches every title and
  body; one match prints in full. `--list` prints every id, or one section's.
- **Easing direction** — `--ease-out` on entry, `--ease-in-out` on exit, never
  linear for anything that moves. Both tokens shipped with no rule for choosing.

### Changed

- **`--text-h1` resolves to 32px on a phone**, not 48px. This is the change most
  likely to be visible in an existing project, and it is the point: at a fixed
  48px, a 45-character headline set as four lines and 211px of headline on a
  360px screen.
- **Line heights are documented per mode.** They always were per mode; the docs
  quoted one mode's values as though they were everyone's, and were wrong for
  two modes out of three.
- **The README covers installing and using Jig, and nothing else.** How to
  change a rule and how to test that a rule earns its context cost moved to
  `AGENTS.md`, where an agent working on this repository will read them.

### Reconciliation

`RECONCILE.md` is at **0 open rows**. Every numeric default is either adopted
from the reference or deliberately kept with its argument stated in one line.
The motion rows are the exception worth knowing: that reference has no motion
chapter, so those values were settled against separate sources, and where no
source gave a number they are kept as ours on stated reasoning rather than
adopted.

`check-tokens` grew from 5 rules to 12, each mutation-tested. Two of the new
ones exist because a guard had been passing vacuously: rule 6's regex was
line-anchored and so covered 103 of 133 tokens while claiming to cover all of
them, and nothing at all checked that a token cited in the rules exists.

## 0.4.0

Jig stops copying itself into your project. It is a skill an agent reads, and
0.3.0 wrote 220KB across 17 files into every consuming repo to deliver it —
roughly 200KB of that Jig's own property, read by an agent that already had it
from the skill install. A single-mode project now gets **three** files, all of
them its own.

### Changed

- **`install` writes one place: the harness's skill directory.** `SKILL.md`, the
  rules, `rules.index.json` and attribution live beside each other at
  `<harness>/skills/jig/`, project or global. Nothing lands in `.jig/` any more.

  The rules are not a build input — nothing compiles them, and the agent reading
  them already has them. The genuine exception is CSS: a stylesheet `@import` is
  an edge in a build graph and must resolve inside the project, on every machine
  that builds it. That is the one category `init` still copies.

- **`.jig/` holds only what belongs to the project** — the brand file, the mode
  files for the modes actually declared (not all three), and `state.json`.

- **A project install refuses when a global one exists.** Two `jig` skills
  registered with the same harness, whose rule paths point at different places,
  is exactly the incoherence this layout exists to prevent.

- **Every harness comes from one table.** Five adapters — Claude Code, Cursor,
  opencode, Gemini CLI, and a generic `.agents/skills` — share the
  `<harness>/skills/<name>/` convention, so adding one is a row rather than a
  file. Codex keeps a bespoke implementation because `AGENTS.md` genuinely is a
  different mechanism.

### Fixed

- **The skill told agents `check` was planned.** It shipped in 0.3.0. A baseline
  run reported "the CLI is ahead of the doc" and worked by hand rather than
  running it. The guard that should have caught this compared the metadata
  against a hand-maintained list, so when `check` landed and neither was
  updated, the two agreed and the test stayed green. The list is now read out of
  the CLI source, and agreement is asserted in both directions.

- **The skill sent agents to an unpinned CLI.** `npx jig-ui` resolves to whatever
  is latest on npm, which need not be the version that wrote the bundle. Two
  baselines hit this and fell back to working by hand. The skill now names the
  version that built it, and `jig update` moves both together.

- **`JIG_CHECK:` named two different records.** The CLI emitted `version=
  mechanical= judgment=`; the skill told the agent to emit `version= mode=
  self_check=` — disjoint fields under one label. There is now one field set,
  `version mode mechanical judgment`, asserted against both sources. An emitter
  that cannot determine a field says so in the value rather than dropping it.

- **Every vendored file cited a licence path that no longer exists.** The header
  hardcoded `.jig/LICENSE`, true only while install vendored into `.jig/`. In
  the new layout the one line whose job is directing a reader to the licence
  directed them nowhere. It is now computed from the file's depth in the bundle.

- **`update` refreshed only one harness.** A project can hold several installs,
  each with its own manifest; the rest stayed pinned at their install version
  with nothing said about them. It now refreshes every one and reports each.

- **`update` wrote files before checking the path.** `assertSafeRelPath` covered
  adapter-rendered files but not `referenceDir`, which the harness table derives
  just as directly. The shipped table is asserted at module load, so a bad entry
  fails at import rather than at whichever command writes first.

- **A project-scope Codex install wrote Jig's rules into your project's
  `.jig/`.** Codex has no skill-directory convention, so its bundle went to a
  bare `.jig` — the one directory this release reserves for the project's own
  material. Install plus `init` left 13 files there, Jig's rules and manifest
  interleaved with your tokens and state, and the harness that most needed the
  0.4.0 separation was the only one that did not get it.

  Two concrete harms beyond the untidiness: `init`'s legacy scanner looks in
  `.jig/` for exactly those artifacts and offers to remove them, so it could
  offer to delete a live install; and one directory holding two manifests is
  what let a stale `.jig/manifest.json` hijack `update` in the first place.

  Codex now uses `.codex/.jig/` at both scopes, mirroring the path its global
  install already used. Verified against the real Codex CLI: it reads
  `AGENTS.md`, resolves every rule path under the new location, and picks up the
  declared mode. Upgrading leaves the old bundle in place — nothing is deleted —
  and `update` now names it rather than reporting a bare "Jig is not installed"
  to someone looking straight at the files.

- **`update` could never move an install forward.** Pinning the CLI fixed version
  skew, but applied to every command it trapped the install: `npx jig-ui@0.4.0
  update` refreshes to 0.4.0, reports success, and changes nothing. `update` is
  the one command whose job is moving the pin, so it is the one that does not
  carry it — the skill renders `npx jig-ui@latest update`.

- **`init --yes` chose a mode silently.** It takes `'/' → product` without
  inferring anything, and `01-modes.md` rule 1 makes the config authoritative
  over an agent's own inference — so the default is not a neutral placeholder,
  it binds every agent that reads the project afterwards. Two baseline runs on
  an `ops-console` project read every signal as `operator`, found `product`, and
  correctly deferred to it; one noted the density difference is expensive to
  reverse. The brand colour already stated its default and why. The mode now
  does too, and says where to change it.

- **A source build could stamp a pin to a version that was never published**,
  silently, until an agent tried to run it. `install` and `update` now say so
  when the running CLI is not an npm-installed package.

- **Concurrent runs lost each other's manifest entries.** Two runs against one
  install — two agents, or a script running `jig init` across a monorepo against
  a shared global install — both read the manifest and both wrote it, and the
  last writer's copy dropped the other's records of "Jig owns this file".
  Losing one makes a later `update` treat that file as the user's and stop
  refreshing it: the safe direction, but silent.

  Fixed without a lock. The `files` map is additive and per-file — a run only
  records entries for files it actually wrote — so merging against whatever is
  on disk at write time is correct, and needs none of the stale-lock recovery a
  mutex would after a process is killed mid-run. Writes are atomic
  (temp + rename), and verified-and-retried to close the window between the read
  and the rename. Ten parallel processes writing fifty entries now keep all
  fifty; without the merge, one survives.

- **An asset could be staged at prepack and left out of the tarball** — correct
  code reading an asset that never shipped. Both lists must now agree, verified
  against the real `npm pack` output.

- **A legacy `.jig/manifest.json` hijacked `update`** and resurrected the whole
  vendored layout.

- **Agents invented token values when `init` had not been run.** A baseline run
  with the skill installed but the project not initialised authored its own
  `:root` block — "control height (32), row height (48), duration (120ms) and
  the near-black brand default are my resolved values, not the system's" — and
  wrote it into the project's stylesheet. Step 5 said "consume tokens by
  semantic name only", and it complied to the letter by inventing the
  definitions behind the names.

  `SKILL.md` now opens with the precondition: no `jig.config.json` means no
  token layer, so run `init` and stop, and do not author a `:root` block of your
  own. Step 5 gained the counter — a token with no value is a finding to report,
  not a number to supply. Re-run on the same fixture, the agent invented
  nothing, and reported a real gap in the token contract instead.

### Added

- **`/jig` slash commands.** `install` writes a command file for every harness
  that has a slash-command mechanism, so `/jig init`, `/jig check --all` and
  `/jig update` work without leaving the session. One file named `jig`
  dispatching on its arguments, which is what gives `/jig init` with a space
  rather than a separate `/jig-init` per subcommand.

  The command is not a thin wrapper: `/jig check` runs the CLI for the seven
  mechanical rules, then applies the 97 judgment rules to the same files and
  merges both halves into one report keyed by rule id — the half a CLI cannot
  do, which is the reason the command exists at all.

  Claude Code, Cursor, opencode and Gemini CLI (which gets its own TOML shape).
  Not Codex: its custom prompts are not expanded by `codex exec` — probed
  directly — so a file there could sit and never fire. Only subcommands the CLI
  actually registers are offered, since a slash command that errors out is worse
  than one that does not exist.

- **`check` reads CSS wherever it lives.** It read `.css`/`.scss`/`.less` only,
  which for most projects meant it examined almost nothing — and said nothing
  about that. A Tailwind v4 fixture with `bg-[#6D28D9] p-[13px] rounded-[12px]
  text-[22px] h-[32px]` reported "No findings · 0 errors · mechanical=pass:0". A
  clean bill of health for a project where every value bypassed the token layer.

  Now covered: `<style>` blocks (HTML, Astro, Vue, Svelte, PHP, ERB, Twig,
  Handlebars, MDX, ASP and ASP.NET, Razor, JSP, Phoenix, EJS, Nunjucks, Liquid,
  Jinja, Velocity, FreeMarker), the indentation-delimited templates (Pug's
  `style.`, Haml's `:css`, Slim's `css:`, each with its own attribute syntax),
  `style="…"` and `style={{ }}`, CSS-in-JS tagged templates
  (`styled.button`, `styled(Link)`, `css`, `createGlobalStyle`, `keyframes`),
  Tailwind arbitrary values, and Tailwind default-palette contrast pairs.
  `@theme` counts as the token layer, so a v4 project that has adopted Jig is
  recognised as having done so.

  The mechanism is extraction rather than a detector per language: everything
  that is not CSS is blanked, preserving character positions, and the existing
  detectors run unchanged — so a finding in a `.vue` file still points at the
  right line, and all seven rules gained host-language support at once.

  Two deliberate limits. A bare `p-4` is not a finding: it resolves through a
  scale, and flagging it would mean flagging correct Tailwind. A colour outside
  the default palette is not resolved rather than guessed at.

- **Reference files ship beside the skill.** `references/**` in the package
  installs into the bundle with its subdirectory shape preserved, refreshed by
  `update` under the same rule as the rules: replace when untouched, skip when
  you have edited it. Adding one is a file drop, no code change.

  **No reference ships in 0.4.0.** Four were planned — a procedure for `init`,
  for `check`, for building a component, and one for resolving apparent rule
  conflicts. Each was tested first by running an agent on the task with no
  guidance, and in every case the agent already did the right thing: it inferred
  the mode with signals stated, kept a 32px control inside a 48px target rather
  than reading the two as contradictory, surfaced the brand question instead of
  guessing, and handled loading, error and never-checked states unprompted.
  `04-principles.md`'s tiebreakers were doing the work the references were meant
  to do. Writing them anyway would have added words the rules already carry.

### Migration

`install` no longer writes rule files into `.jig/`, so a pre-0.4.0 project has
rules in two places. The old copies are yours to remove; nothing deletes them
for you, because you may have edited one and that edit is yours to keep. Run
`jig install --agent <name>` to place the new bundle, then delete `.jig/rules/`
and `.jig/rules.index.json` once you have checked them for your own changes.

## 0.3.0

Two new commands. `install` and `update` put the system in place; these two make
it do something.

### Added

- **`jig check`** — verifies a consumer's code against the rules. Seven
  detectors, exactly the ones `rules.index.json` already named: `gradient-text`
  (A-02), `backdrop-blur` (A-04), `pure-black-white` (C-18), `contrast-floor`
  (C-19), `focus-removed` (E-29), `hardcoded-value` (H-47), and
  `violet-band-hue` (A-01, hybrid — it asks rather than fails). With `--all`,
  `--ci` (mechanical bucket only, no model, deterministic) and `--json`.

  H-47 runs only on files that reference a Jig token or import a vendored token
  file. "Hard-coded *past* the token layer" means nothing for a file that never
  adopted it, and without that scope it produced 13 of 13 findings on a 20-line
  stylesheet. A project where nothing participates is told how to start.

- **`jig init`** — sets a project up to use the system. Detects the CSS system,
  derives a brand colour from existing code rather than interviewing cold,
  validates it against the contract `brand.default.css` already states, writes
  the brand file and `jig.config.json`, wires the imports, and runs `check` for
  a baseline.

  This is also what makes global installs coherent. The brand file and config
  always live in the project, and for a global install the one selected mode
  file is copied into the project's `.jig/tokens/` so the import is
  project-relative. A `$HOME`-relative CSS import resolves only on the machine
  that generated it; a stylesheet is committed and must build everywhere.

- `oklch()` is parsed. Tailwind v4 and shadcn emit it by default, so skipping it
  meant `init` derived nothing on a large share of new projects and `C-19`
  computed no contrast against Jig's own `--color-bg-base`.

### Fixed

- **CSS nesting hid the parent's declarations.** A block containing braces was
  discarded whole, so in `.card { color: red; .h { … } }` the `color: red`
  belonged to no block and was invisible to every detector. On a Sass codebase
  that was most declarations, reported as a clean result.

- Comments produced findings, and a commented-out `:focus-visible` silenced
  E-29 for a whole file — a dead detector reporting success.

- `var(--x, fallback)` was resolved to the fallback and reported as fact.

- The large-text contrast exemption was inert because only `px` font-sizes were
  recognised, so `2rem` at 3.54:1 was flagged as failing a 4.5:1 floor that did
  not apply to it.


## 0.2.1

### Fixed

- **`--color-text-warning` and `--color-text-success` failed their contrast
  floors.** Warning was 3.64:1 and success 4.48:1 against the surfaces they can
  land on, where text requires 4.5:1 and strokes 3:1. The source is explicit:
  system colours used for text need 4.5:1; used for interface elements and
  icons, 3:1. `RECONCILE.md` also lists the contrast floors as the one category
  not up for reconciliation, and `C-19` is a rule about this exact failure — so
  the system was breaking its own hardest rule, in a shipped default that every
  consumer inherits unless they override it.

  Warning lightness 36% → 29%, success 26% → 23%. Hue and saturation unchanged,
  so both are the same colour, darker. All four semantic colours now clear both
  floors against `bg-base`, `bg-raised`, and `fill` on either.

- The system colours now state what a replacement must satisfy. The brand colour
  already carried that contract; these did not, so a user bringing their own
  error or warning colour — the intended workflow — had no floor to hit.

### Added

- `scripts/check-tokens.mjs` gains two rules, both mutation-tested. Rule 5
  computes contrast from the token values and fails the build; this is the only
  defect class here that arithmetic can catch, and it shipped twice because
  nobody was doing the arithmetic. Rule 6 fails the build when a token is
  defined but never rendered by the preview.

- `packages/preview` — a rendering harness. Every prior check verified the
  system by arithmetic or grep; nothing had looked at it. Plain HTML and CSS,
  no build, not published. It found two gaps on its first run: there is no
  border-width token and no focus-ring geometry tokens.

## 0.2.0

The first release that actually works end to end. `0.1.0` shipped rules that
cited tokens it never installed, and a token name that did not exist.

### Fixed

- **`--color-brand` was cited nine times and defined nowhere**, including
  `03-patterns.md`'s primary-button spec. An agent following that rule wrote
  `background: var(--color-brand)` and got an unset custom property.
- **The design tokens were never installed.** The rules cite tokens 22 times
  and `02-tokens.md` instructs the reader to import them, but `install` only
  wrote the rule markdown. The CSS was in the published tarball the whole time
  and never copied out.
- **Rule `C-49` had no correction and `I-80` had no anti-pattern**, in a file
  whose own contract states every rule pairs both. The totals hid it — the two
  defects cancelled at 103/103.
- **Ten values in the mode profile tables contradicted the tokens**, including
  editorial body size, section rhythm, card padding, and a heading step that
  did not exist.
- **`A-07`'s correction had silently inverted from true to false.** A mechanical
  rename of `--radius-base` to `--radius-sm` turned a correct statement about
  radius derivation into an incorrect one, with nothing to catch it.
- **`A-07`'s prohibition used a `16px+` threshold** that flagged `--radius-md`,
  the value the rule exists to sanction.
- **`C-68` depended on a radius token it never named.** "A badge is more rounded
  than a button" now cites `--radius-full`.

### Changed

- Tokens vendor to **`.jig/tokens/`** on install, in every scope. That is the
  only location; `update` refreshes them there and nothing relocates them.
- Editing a vendored token file is expected: `install` and `update` both leave
  files you have changed alone and report them skipped.
- The mode profile tables cite token names instead of literals; the comparison
  table is ordinal. A number in prose is a call site.
- The semantic colours are defined once each as `--<name>-h/s/l`. Every variation
  previously repeated the same literal four to five times, so changing a colour
  meant editing every copy or the variations desynchronised.

### Added

- `scripts/check-tokens.mjs`, run by `npm test`. Four rules, each mutation-tested
  against the drift it guards: the type table must match its tokens by name, no
  unanchored literal in a prose table, no chosen colour literal repeated in a
  token file, and every token import must use the canonical path.

