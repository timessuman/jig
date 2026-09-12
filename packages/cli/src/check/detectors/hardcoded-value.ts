import { leafBlocks, lineOfOffset, sourceLine } from '../css.js';
import { isStyleBearing } from '../ext.js';
import { isMarkupHost, isStyleHost } from '../styles.js';
import { arbitraryValues, classAttributeValues } from '../tailwind.js';
import { mkFinding } from '../finding.js';
import { participatesInTokenLayer } from '../token-layer.js';
import { hasHardCodedLength } from '../length.js';
import type { Detector, DetectorContext, Finding } from '../types.js';

// H-47: values invented at the call site instead of read from the token
// layer. The highest noise-risk detector in the set — a real codebase is
// full of `px` — so this is deliberately narrow:
//
// False-positive story:
//  - The rule is "hard-coded past the token layer" — you can only be past
//    a layer you are ON. A file with no `var(--jig-token)` reference and no
//    `@import` of a vendored `.jig/tokens/*.css` file has not adopted
//    tokens yet; every `px` in it is not a violation, it is pre-adoption
//    code. `run()` returns early for such a file — see
//    `participatesInTokenLayer` — rather than flagging its entire contents.
//  - Only two categories of property are examined: colour (color,
//    background[-color], border-*-color, fill, stroke, outline-color) and
//    spacing/type (font-size, margin*, padding*, gap/row-gap/column-gap).
//    Every other property (width, border shorthand, transform, ...) is
//    silent, even when it carries a literal value — flagging those would
//    require guessing which are "design tokens" and which are structural.
//  - A declaration that already routes through `var(...)` — even mixed
//    with a literal, e.g. `margin: 4px var(--spacing-m)` — is skipped
//    whole. This trades a small false-negative for not punishing a
//    consumer who is already using the token layer.
//  - `0`, `1px` and `2px` are excluded from the spacing/type check —
//    borders and hairlines Jig has no token for, a known gap stated in the
//    task brief, not an oversight here. That exclusion, and the set of units
//    that count as a length at all, live in `length.ts` — the Tailwind branch
//    below decides the identical question and the two answered it differently
//    for as long as both existed.
//  - A breakpoint `px` is never flagged, because it lives in the `@media`
//    prelude, which lands in the OUTER block's selector — and declarations
//    are only ever read from a leaf block's body. Declarations INSIDE a
//    media query are checked normally; they are ordinary design values.
//  - Declarations are read from parsed rule-block BODIES, not the flat file
//    text, so a selector that happens to look like a property (a class
//    named exactly `.color`, `a:hover { ... }`) can never be mistaken for
//    one — see `leafBlocks` in css.ts.
const COLOR_PROPS = new Set([
  'color',
  'background-color',
  'background',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'fill',
  'stroke',
  'outline-color',
]);
const SPACING_PROPS = new Set([
  'font-size',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'row-gap',
  'column-gap',
]);

// The terminator is `;` OR end-of-body: the final declaration in a rule may
// legally omit its semicolon, and minified CSS always does. Requiring `;`
// made the last declaration of every rule invisible.
const DECL_RE = /(?<![-\w])([a-zA-Z-]+)\s*:\s*([^;]+)(?:;|$)/g;
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/;
// A leaf block whose selector is a `@keyframes` step (`from`, `to`, or a
// percentage) is an animation waypoint, not a design value — `margin-left:
// 240px` inside `to { ... }` is how far something travels, not spacing that
// belongs on the token layer. Only the step selector itself is percentage-
// shaped; a real CSS selector can't legally be a bare percentage outside
// `@keyframes`, so this is safe to check without knowing the enclosing
// at-rule.
const KEYFRAME_STEP_RE = /^(from|to|\d+(\.\d+)?%)$/i;

/**
 * The token layer's raw channel inputs — the values every semantic colour is
 * derived FROM. `--brand-h/s/l`, `--error-fill-a`, and the same for warning,
 * success and info.
 *
 * Consuming one at a call site is H-47's other half, and the worse half. A
 * literal at least looks wrong; `color: var(--brand-l)` looks exactly like
 * correct token usage while being neither — `--brand-l` is a bare number
 * (`15%`), so as a colour it produces an invalid declaration that silently does
 * nothing, and reading any of them bypasses every theme override, since the
 * dark block remaps the semantic roles rather than the channels.
 *
 * Deliberately narrow: only the families Jig itself declares. A consumer's own
 * custom property is theirs, and guessing which of them are "primitives" would
 * produce findings on correct code.
 */
const PRIMITIVE_RE = /var\(\s*(--(?:brand|error|warning|success|info)-(?:h|s|l|fill-a))\s*[,)]/g;

/** The token layer declares these; it is the one place they may be read. A mode
 *  file composing `hsl(var(--brand-h) ...)` is correct, and once the token layer
 *  can live beside a project's own CSS it becomes a scanned file — so this
 *  cannot rely on those files being unreachable.
 *
 *  Scoped by DIRECTORY, not by filename. It matched `(brand|mode).*.css` with
 *  the directory optional, so a project's own `src/legacy/brand.colors.css` was
 *  silently exempt wherever it sat — the same over-broad exemption this system
 *  now warns users about in their own config. Jig owns the `jig/` directory
 *  outright; a filename that merely looks like one of ours is a coincidence. */
const TOKEN_LAYER_RE = /(^|\/)(\.jig\/tokens|jig)\/[^/]+\.css$/;

function primitiveConsumption(source: string, file: string, ctx: DetectorContext): Finding[] {
  if (TOKEN_LAYER_RE.test(file)) return [];
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const m of source.matchAll(PRIMITIVE_RE)) {
    const token = m[1];
    const line = source.slice(0, m.index ?? 0).split('\n').length;
    const key = `${token}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      mkFinding(
        ctx,
        'hardcoded-value',
        file,
        line,
        `${token} is a raw channel input, not a semantic role — consuming it bypasses ` +
          `the theme overrides, which remap \`--color-*\` and never the channels. ` +
          `Use the semantic token for what this is (\`--color-text-*\`, \`--color-fill-*\`, ` +
          `\`--color-stroke-*\`).`,
        sourceLine(source, line),
      ),
    );
  }
  return out;
}

export const hardcodedValue: Detector = {
  name: 'hardcoded-value',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    // A file that has not adopted the token layer is not bypassing it — it
    // simply has not got there yet. Flagging every literal in such a file
    // says "your whole codebase is wrong", which is true and useless, and
    // teaches users to disable the detector.
    // A stylesheet answers for itself. A host file's style regions never carry
    // the project's `@import`, so it inherits the project's answer — see
    // `projectParticipates`.
    // Reading a primitive is checked FIRST, and BEFORE the participation gate.
    //
    // Before it, because it is a `var()`, and every literal check below skips a
    // declaration that already routes through `var(...)` — right for
    // `var(--spacing-m)`, exactly wrong here, and why this half of H-47 went
    // unenforced.
    //
    // Before the gate, because naming a Jig primitive IS participation. The
    // gate exists so a project that has not adopted tokens is not told its
    // whole codebase is wrong; a file writing `var(--brand-l)` has adopted
    // them and is misusing them, which is the opposite situation.
    const findings: Finding[] = primitiveConsumption(source, file, ctx);

    const participates = isStyleHost(file)
      ? ctx.projectParticipates
      : participatesInTokenLayer(source, ctx.tokens);
    if (!participates) return findings;

    // No media-query masking. A breakpoint `px` lives in the `@media` prelude,
    // which lands in the OUTER block's selector — and `DECL_RE` only ever reads
    // `block.body`, so the breakpoint is already unreachable. Masking the body
    // instead (as this once did) deleted every real declaration inside a media
    // query, which in a responsive stylesheet is most of them.
    for (const block of leafBlocks(source)) {
      if (KEYFRAME_STEP_RE.test(block.selector.trim())) continue;
      DECL_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = DECL_RE.exec(block.body))) {
        const prop = m[1].toLowerCase();
        const value = m[2].trim();
        if (value.includes('var(')) continue;

        if (COLOR_PROPS.has(prop) && COLOR_LITERAL_RE.test(value)) {
          const line = lineOfOffset(block, m.index);
          findings.push(
            mkFinding(
              ctx,
              'hardcoded-value',
              file,
              line,
              `Hard-coded colour \`${value}\` past the token layer`,
              sourceLine(source, line),
            ),
          );
          continue;
        }

        if (SPACING_PROPS.has(prop)) {
          if (hasHardCodedLength(value)) {
            const line = lineOfOffset(block, m.index);
            findings.push(
              mkFinding(
                ctx,
                'hardcoded-value',
                file,
                line,
                `Hard-coded \`${value}\` past the token layer`,
                sourceLine(source, line),
              ),
            );
          }
        }
      }
    }
    // Values written as utility classes are not CSS, so they live in exactly
    // the regions `source` has masked away — `ctx.raw` is the original text.
    // Only the arbitrary-value form (`p-[13px]`) is a finding: it means "this
    // exact value, bypassing the scale", which is H-47 in Tailwind's own
    // notation. A bare `p-4` resolves through the scale, which is correct.
    // Class attributes are markup. A `className="..."` in a pure script file
    // is a string — test data, a template being assembled — not an element.
    for (const attr of isMarkupHost(file) ? classAttributeValues(ctx.raw) : []) {
      for (const found of arbitraryValues(attr.classes)) {
        findings.push(
          mkFinding(
            ctx,
            'hardcoded-value',
            file,
            attr.line,
            found.kind === 'colour'
              ? `Hard-coded colour \`${found.value}\` past the token layer (${found.utility}-[…])`
              : `Hard-coded \`${found.value}\` past the token layer (${found.utility}-[…])`,
            attr.classes.length > 80 ? `${attr.classes.slice(0, 77)}…` : attr.classes,
          ),
        );
      }
    }

    return findings;
  },
};


