import { leafBlocks, lineOfOffset, maskMediaQueries, sourceLine } from '../css.js';
import { CSS_EXTENSIONS, hasExtension } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// H-47: values invented at the call site instead of read from the token
// layer. The highest noise-risk detector in the set — a real codebase is
// full of `px` — so this is deliberately narrow:
//
// False-positive story:
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
//    task brief, not an oversight here.
//  - Anything inside an `@media (...)` block is excluded — a breakpoint is
//    not a design token, so a raw px value that exists only to define one
//    should not be flagged as if it were.
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

const DECL_RE = /(?<![-\w])([a-zA-Z-]+)\s*:\s*([^;]+);/g;
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/;
const PX_RE = /(-?\d*\.?\d+)px/g;
const EXCLUDED_PX = new Set([0, 1, 2]);

export const hardcodedValue: Detector = {
  name: 'hardcoded-value',
  appliesTo: (file) => hasExtension(file, CSS_EXTENSIONS),
  run(source, file, ctx) {
    const findings: Finding[] = [];

    for (const block of leafBlocks(maskMediaQueries(source))) {
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
          PX_RE.lastIndex = 0;
          let px: RegExpExecArray | null;
          let flagged = false;
          while ((px = PX_RE.exec(value))) {
            if (!EXCLUDED_PX.has(Math.abs(parseFloat(px[1])))) {
              flagged = true;
              break;
            }
          }
          if (flagged) {
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
    return findings;
  },
};
