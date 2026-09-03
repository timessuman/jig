import { describe, it, expect } from 'vitest';
import { extractColorComponents } from '../src/check/color.js';

const rgb = (v: string) => extractColorComponents(v, {})?.rgb;

describe('oklch parsing', () => {
  it('resolves pure white and pure black', () => {
    expect(rgb('oklch(1 0 0)')).toEqual({ r: 255, g: 255, b: 255 });
    expect(rgb('oklch(0 0 0)')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("resolves Jig's own --color-bg-base to its off-white", () => {
    // oklch(0.980 0.004 95) is the documented page background, ~#f9f8f5
    const c = rgb('oklch(0.980 0.004 95)')!;
    expect(c.r).toBeGreaterThan(245);
    expect(c.r).toBeLessThan(255);
    expect(c.b).toBeLessThan(c.r); // warm: blue channel lowest
  });

  it('accepts percentage lightness and an alpha', () => {
    const a = extractColorComponents('oklch(100% 0 0)', {})!;
    expect(a.rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(extractColorComponents('oklch(0.5 0.1 240 / 0.5)', {})!.alpha).toBe(0.5);
  });

  it('clamps an out-of-gamut colour rather than returning nonsense', () => {
    const c = rgb('oklch(0.7 0.4 150)')!;
    for (const ch of [c.r, c.g, c.b]) {
      expect(ch).toBeGreaterThanOrEqual(0);
      expect(ch).toBeLessThanOrEqual(255);
    }
  });

  it('still returns null for things it genuinely cannot resolve', () => {
    expect(extractColorComponents('currentColor', {})).toBeNull();
    expect(extractColorComponents('linear-gradient(90deg,#f00,#00f)', {})).toBeNull();
  });
});
