# Changelog

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

