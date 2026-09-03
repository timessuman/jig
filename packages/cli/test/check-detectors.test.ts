import { describe, it, expect } from 'vitest';
import { gradientText } from '../src/check/detectors/gradient-text.js';
import { backdropBlur } from '../src/check/detectors/backdrop-blur.js';
import { pureBlackWhite } from '../src/check/detectors/pure-black-white.js';
import { contrastFloor } from '../src/check/detectors/contrast-floor.js';
import { focusRemoved } from '../src/check/detectors/focus-removed.js';
import { hardcodedValue } from '../src/check/detectors/hardcoded-value.js';
import { violetBandHue } from '../src/check/detectors/violet-band-hue.js';
import type { Bucket, DetectorContext, Severity } from '../src/check/types.js';

function ctx(
  ruleId: string,
  bucket: Bucket,
  severity: Severity,
  tokens: Record<string, string> = {},
  projectParticipates = false,
): DetectorContext {
  return { ruleId, bucket, severity, tokens, projectParticipates, raw: '' };
}

describe('gradient-text (A-02)', () => {
  const c = ctx('A-02', 'mechanical', 'error');

  it('fires on background-clip: text combined with a gradient background', () => {
    const src = '.title {\n  background: linear-gradient(90deg, red, blue);\n  background-clip: text;\n  color: transparent;\n}\n';
    const findings = gradientText.run(src, 'a.css', c);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('A-02');
    expect(findings[0].line).toBe(3);
  });

  it('does not fire on a solid background-clip: text (no gradient) or a plain solid heading', () => {
    expect(gradientText.run('.title { background-clip: text; background: red; }', 'a.css', c)).toHaveLength(0);
    expect(gradientText.run('.title { color: var(--color-text-strong); }', 'a.css', c)).toHaveLength(0);
  });
});

describe('backdrop-blur (A-04)', () => {
  const c = ctx('A-04', 'mechanical', 'error');

  it('fires on backdrop-filter: blur() combined with a translucent background', () => {
    const src = '.panel {\n  background: rgba(255, 255, 255, 0.4);\n  backdrop-filter: blur(12px);\n}\n';
    const findings = backdropBlur.run(src, 'a.css', c);
    expect(findings).toHaveLength(1);
  });

  it('does not fire when the background is opaque', () => {
    const src = '.panel {\n  background: #ffffff;\n  backdrop-filter: blur(12px);\n}\n';
    expect(backdropBlur.run(src, 'a.css', c)).toHaveLength(0);
  });
});

describe('pure-black-white (C-18)', () => {
  const c = ctx('C-18', 'mechanical', 'warning');

  it('fires on #000 text over a #fff background in the same block', () => {
    const src = '.body {\n  color: #000;\n  background: #fff;\n}\n';
    const findings = pureBlackWhite.run(src, 'a.css', c);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('does not fire on near-black over near-white (the compliant correction)', () => {
    const src = '.body {\n  color: #111;\n  background: #f9f8f5;\n}\n';
    expect(pureBlackWhite.run(src, 'a.css', c)).toHaveLength(0);
  });

  // M7: the original regexes matched only #000/#fff hex literals. C-18's own
  // rule is about the colours, not the syntax used to spell them — the
  // `black`/`white` keywords and the rgb() equivalents are the same
  // violation and must be caught too.
  it('fires on the black/white keywords', () => {
    const src = '.body {\n  color: black;\n  background: white;\n}\n';
    expect(pureBlackWhite.run(src, 'a.css', c)).toHaveLength(1);
  });

  it('fires on rgb(0,0,0) over rgb(255,255,255)', () => {
    const src = '.body {\n  color: rgb(0, 0, 0);\n  background-color: rgb(255, 255, 255);\n}\n';
    expect(pureBlackWhite.run(src, 'a.css', c)).toHaveLength(1);
  });
});

describe('contrast-floor (C-19)', () => {
  const c = ctx('C-19', 'mechanical', 'error');

  it('fires on a literal foreground/background pair below 4.5:1', () => {
    const src = '.timestamp {\n  color: #999999;\n  background: #ffffff;\n}\n';
    const findings = contrastFloor.run(src, 'a.css', c);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/below the 4.5:1 floor/);
  });

  it('does not fire on a pair that clears the floor, and skips what it cannot resolve', () => {
    const src = '.body {\n  color: #111111;\n  background: #ffffff;\n}\n';
    expect(contrastFloor.run(src, 'a.css', c)).toHaveLength(0);
    // translucent colour: unresolvable, must be skipped rather than guessed
    const unresolvable = '.body {\n  color: rgb(0 0 0 / 90%);\n  background: #ffffff;\n}\n';
    expect(contrastFloor.run(unresolvable, 'a.css', c)).toHaveLength(0);
  });

  // C2: a var() with a fallback is a guess about a cascade branch Jig
  // cannot observe — even though the fallback alone would fail the floor,
  // the pair must be skipped, not reported as fact.
  it('does not fire on var(--x, fallback) even when the fallback would fail the floor', () => {
    const src = ':root { --brand-muted: #333333; }\n.c2 { color: var(--brand-muted, #999999); background: #ffffff; }\n';
    expect(contrastFloor.run(src, 'a.css', c)).toHaveLength(0);
  });
});

describe('focus-removed (E-29)', () => {
  const c = ctx('E-29', 'mechanical', 'error');

  it('fires on outline: none with no :focus-visible anywhere in the file', () => {
    const src = 'button {\n  outline: none;\n}\n';
    const findings = focusRemoved.run(src, 'a.css', c);
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe(2);
  });

  it('does not fire when the file supplies a :focus-visible replacement elsewhere', () => {
    const src = 'button {\n  outline: none;\n}\nbutton:focus-visible {\n  outline: 2px solid var(--color-focus);\n}\n';
    expect(focusRemoved.run(src, 'a.css', c)).toHaveLength(0);
  });
});

describe('hardcoded-value (H-47)', () => {
  // H-47 only runs on files that participate in the token layer, and
  // participation means referencing a *known* token — so the context must
  // carry a token map for these fixtures to be treated as adopted.
  const c = ctx('H-47', 'mechanical', 'error', { 'color-brand': '#000', 'spacing-m': '24px' });

  it('fires on a raw hex colour and a raw px spacing value', () => {
    // The leading token reference makes this an *adopted* file. H-47 means
    // "hard-coded past the token layer", so it only runs where that layer is
    // in use — see participatesInTokenLayer.
    const src = '.a { color: var(--color-brand); }\n.card {\n  color: #6D28D9;\n  padding: 18px;\n}\n';
    const findings = hardcodedValue.run(src, 'a.css', c);
    expect(findings).toHaveLength(2);
  });

  it('does not fire on tokenized values or hairline spacing (0/1px/2px)', () => {
    const src = [
      '.card {',
      '  color: var(--color-brand);',
      '  padding: var(--spacing-m);',
      '  margin: 1px;',
      '  gap: 2px;',
      '  row-gap: 0px;',
      '}',
      // The breakpoint px is not flagged — it lives in the @media prelude,
      // which lands in the outer block's selector and is never read as a
      // declaration. Declarations INSIDE a media query are checked; that is
      // covered separately below.
      '@media (min-width: 768px) {',
      '  .card { padding: var(--spacing-m); }',
      '}',
    ].join('\n');
    expect(hardcodedValue.run(src, 'a.css', c)).toHaveLength(0);
  });

  it('does not mistake a selector that looks like a property for a declaration', () => {
    // `.color:hover { ... }` must never be read as a `color:` declaration —
    // declarations are read from parsed block bodies, not flat file text.
    const src = '.a { color: var(--color-brand); }\n.color:hover {\n  background: #ffffff;\n}\n';
    expect(hardcodedValue.run(src, 'a.css', c)).toHaveLength(1); // only the real background-color literal
  });

  // I1: an animation waypoint (`from`, `to`, or a percentage step) inside
  // `@keyframes` is not a design value on the token layer — it's how far
  // something moves. Flagging it teaches users to distrust the detector.
  it('does not flag @keyframes steps as hard-coded spacing', () => {
    const src = [
      '.a { color: var(--color-brand); }',
      '@keyframes slide {',
      '  from { margin-left: 0; }',
      '  to { margin-left: 240px; }',
      '  50% { margin-left: 120px; }',
      '}',
      '',
    ].join('\n');
    expect(hardcodedValue.run(src, 'a.css', c)).toHaveLength(0);
  });
});

describe('violet-band-hue (A-01)', () => {
  const c = ctx('A-01', 'hybrid', 'warning');

  it('fires on a literal saturated violet/indigo colour', () => {
    const src = '.hero { background: #6D28D9; }\n';
    const findings = violetBandHue.run(src, 'a.css', c);
    expect(findings).toHaveLength(1);
    expect(findings[0].bucket).toBe('hybrid');
    expect(findings[0].severity).toBe('warning');
  });

  it('does not fire on an achromatic grey (0% saturation) even though its HSL hue number sits in the violet band', () => {
    const src = '.hero { background: hsl(264 0% 15%); }\n';
    expect(violetBandHue.run(src, 'a.css', c)).toHaveLength(0);
  });
});

describe('violet-band-hue — the band itself is pinned', () => {
  // These tests exist because the originals passed with the hue window and
  // the lightness gates removed entirely: they asserted the detector's
  // existence, not its substance.
  const c = ctx('A-01', 'hybrid', 'warning');
  const fire = (hex: string) =>
    violetBandHue.run(`.a { color: ${hex}; }\n`, 'a.css', c).length;

  it('fires across the violet AND indigo band', () => {
    expect(fire('#6366f1')).toBe(1); // indigo-500, 239deg — the commonest default
    expect(fire('#4f46e5')).toBe(1); // indigo-600, 243deg
    expect(fire('#8b5cf6')).toBe(1); // violet-500, 258deg
    expect(fire('#764ba2')).toBe(1); // 270deg
  });

  it('does not fire on blues below the band', () => {
    expect(fire('#3b82f6')).toBe(0); // blue-500, 217deg
    expect(fire('#2f5bd0')).toBe(0); // 224deg
  });

  it('does not fire on hues above the band', () => {
    expect(fire('#d946ef')).toBe(0); // fuchsia, ~292deg
  });

  it('does not fire on near-black or near-white in the band', () => {
    expect(fire('#050307')).toBe(0); // lightness below the gate
    expect(fire('#faf8fd')).toBe(0); // lightness above the gate
  });
});

describe('detectors read the last declaration in a rule', () => {
  // All three of these required a trailing `;`, so the final declaration of
  // every rule — and all minified CSS — was invisible.
  it('focus-removed sees `outline: none` with no trailing semicolon', () => {
    const c = ctx('E-29', 'mechanical', 'error');
    expect(focusRemoved.run('.a { outline: none }\n', 'a.css', c)).toHaveLength(1);
  });

  it('hardcoded-value sees a final declaration with no trailing semicolon', () => {
    const c = ctx('H-47', 'mechanical', 'error', { 'color-brand': '#000' });
    const src = '.a { color: var(--color-brand); }\n.b { color: #ff0000 }\n';
    expect(hardcodedValue.run(src, 'a.css', c)).toHaveLength(1);
  });
});

describe('hardcoded-value checks declarations inside media queries', () => {
  it('flags a literal inside @media but never the breakpoint itself', () => {
    const c = ctx('H-47', 'mechanical', 'error', { 'color-brand': '#000' });
    const src = [
      '.a { color: var(--color-brand); }',
      '@media (min-width: 768px) {',
      '  .card { padding: 24px; }',
      '}',
      '',
    ].join('\n');
    const found = hardcodedValue.run(src, 'a.css', c);
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('24px');
    expect(found.some((f) => f.message.includes('768'))).toBe(false);
  });
});

describe('contrast-floor applies the large-text floor', () => {
  const c = ctx('C-19', 'mechanical', 'error');

  it('does not flag large text that meets the 3:1 floor', () => {
    const src = '.h { font-size: 40px; background: #ffffff; color: #949494; }\n';
    expect(contrastFloor.run(src, 'a.css', c)).toHaveLength(0);
  });

  it('still flags normal-size text at the same ratio', () => {
    const src = '.p { font-size: 16px; background: #ffffff; color: #949494; }\n';
    expect(contrastFloor.run(src, 'a.css', c)).toHaveLength(1);
  });

  it('treats bold 20px as large', () => {
    const src = '.h { font-size: 20px; font-weight: 700; background: #ffffff; color: #949494; }\n';
    expect(contrastFloor.run(src, 'a.css', c)).toHaveLength(0);
  });

  // C3: `font-size: 2rem` is 32px — large text — but the exemption only
  // recognised `px` before this fix, so it never applied to a codebase that
  // sizes type in `rem` (the common case). 3.54:1 is AA-conformant for
  // large text; 2.5:1 is not.
  it('recognises rem font sizes for the large-text exemption', () => {
    const large = '.h { font-size: 2rem; background: #ffffff; color: #888888; }\n'; // ~3.54:1
    expect(contrastFloor.run(large, 'a.css', c)).toHaveLength(0);

    const tooLow = '.h { font-size: 2rem; background: #ffffff; color: #a4a4a4; }\n'; // ~2.49:1
    expect(contrastFloor.run(tooLow, 'a.css', c)).toHaveLength(1);
  });

  // An unresolvable unit (em, %, clamp()) must fall back to the LENIENT
  // floor rather than the strict one — guessing large produces a false
  // negative, guessing normal produces the false positive this fix exists
  // to remove.
  it('falls back to the lenient floor for a font-size it cannot resolve to px', () => {
    const src = '.h { font-size: 1.5em; background: #ffffff; color: #949494; }\n'; // ~3.54:1
    expect(contrastFloor.run(src, 'a.css', c)).toHaveLength(0);
  });
});
