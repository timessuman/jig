import { describe, it, expect } from 'vitest';
import { gradientText } from '../src/check/detectors/gradient-text.js';
import { backdropBlur } from '../src/check/detectors/backdrop-blur.js';
import { pureBlackWhite } from '../src/check/detectors/pure-black-white.js';
import { contrastFloor } from '../src/check/detectors/contrast-floor.js';
import { focusRemoved } from '../src/check/detectors/focus-removed.js';
import { hardcodedValue } from '../src/check/detectors/hardcoded-value.js';
import { violetBandHue } from '../src/check/detectors/violet-band-hue.js';
import type { Bucket, DetectorContext, Severity } from '../src/check/types.js';

function ctx(ruleId: string, bucket: Bucket, severity: Severity, tokens: Record<string, string> = {}): DetectorContext {
  return { ruleId, bucket, severity, tokens };
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

  it('does not fire on tokenized values, hairline spacing (0/1px/2px), or values inside @media', () => {
    const src = [
      '.card {',
      '  color: var(--color-brand);',
      '  padding: var(--spacing-m);',
      '  margin: 1px;',
      '  gap: 2px;',
      '  row-gap: 0px;',
      '}',
      '@media (min-width: 768px) {',
      '  .card { padding: 999px; }',
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
