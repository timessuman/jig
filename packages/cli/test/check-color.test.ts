import { describe, it, expect } from 'vitest';
import { contrastRatio, extractColorComponents, resolveOpaqueColor } from '../src/check/color.js';

describe('extractColorComponents', () => {
  it('parses 3- and 6-digit hex', () => {
    expect(extractColorComponents('#fff', {})?.rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(extractColorComponents('#6D28D9', {})?.rgb).toEqual({ r: 109, g: 40, b: 217 });
  });

  it('parses rgb()/rgba() in both comma and space/slash syntax', () => {
    expect(extractColorComponents('rgb(0, 0, 0)', {})?.rgb).toEqual({ r: 0, g: 0, b: 0 });
    expect(extractColorComponents('rgba(0, 0, 0, 0.5)', {})?.alpha).toBeCloseTo(0.5);
    expect(extractColorComponents('rgb(0 0 0 / 90%)', {})?.alpha).toBeCloseTo(0.9);
  });

  it('parses hsl()/hsla()', () => {
    const c = extractColorComponents('hsl(264 0% 15%)', {});
    expect(c?.hsl.h).toBeCloseTo(264);
    expect(c?.hsl.s).toBeCloseTo(0);
    expect(c?.hsl.l).toBeCloseTo(15);
  });

  it('resolves a var() reference against the token map, including a token that itself references other tokens', () => {
    const tokens = {
      'brand-h': '264',
      'brand-s': '0%',
      'brand-l': '15%',
      'color-brand': 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
    };
    const c = extractColorComponents('var(--color-brand)', tokens);
    expect(c?.hsl.h).toBeCloseTo(264);
  });

  it('returns null for an unresolvable var()', () => {
    expect(extractColorComponents('var(--unknown-token)', {})).toBeNull();
  });

  it('returns null for oklch() and other unsupported forms', () => {
    expect(extractColorComponents('oklch(0.98 0.004 95)', {})).toBeNull();
    expect(extractColorComponents('currentColor', {})).toBeNull();
  });
});

describe('resolveOpaqueColor', () => {
  it('resolves a fully opaque colour', () => {
    expect(resolveOpaqueColor('#ffffff', {})).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('refuses a translucent colour rather than guessing', () => {
    expect(resolveOpaqueColor('rgba(0, 0, 0, 0.9)', {})).toBeNull();
    expect(resolveOpaqueColor('rgb(0 0 0 / 90%)', {})).toBeNull();
  });

  // C2: a var() carrying a fallback is unresolved for contrast purposes —
  // the fallback only applies on the branch that does NOT run when the
  // custom property is defined, and Jig never reads the consumer's `:root`
  // to know which branch is live. Reporting the fallback as fact is a guess.
  it('refuses a var() with a fallback, even when the fallback alone would resolve', () => {
    expect(resolveOpaqueColor('var(--brand-muted, #999999)', {})).toBeNull();
    expect(resolveOpaqueColor('var(--brand-muted, #999999)', { 'brand-muted': '#333333' })).toBeNull();
  });

  it('still resolves a var() with no fallback against a known token', () => {
    expect(resolveOpaqueColor('var(--brand-muted)', { 'brand-muted': '#333333' })).toEqual({
      r: 0x33,
      g: 0x33,
      b: 0x33,
    });
  });
});

describe('contrastRatio', () => {
  it('computes the WCAG contrast ratio for black on white as 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0);
  });

  it('computes a known failing pair below 4.5:1', () => {
    // #999 on white is a classic WCAG failure (~2.85:1)
    const ratio = contrastRatio({ r: 153, g: 153, b: 153 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeGreaterThan(2);
  });
});
