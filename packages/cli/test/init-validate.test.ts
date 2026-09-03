import { describe, it, expect } from 'vitest';
import { validateBrandColor, nearestPassingLightness } from '../src/init/validate.js';
import { describeValidation } from '../src/commands/init.js';

describe('validateBrandColor — contrast', () => {
  it('passes the unbranded default (near-black)', () => {
    const v = validateBrandColor(264, 0, 15);
    expect(v.passesContrast).toBe(true);
    expect(v.worstRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('fails a light, low-contrast colour and reports the measured ratio plus a passing alternative', () => {
    // A light, medium-saturation blue — nowhere near 4.5:1 against a white-ish background.
    const v = validateBrandColor(210, 60, 85);
    expect(v.passesContrast).toBe(false);
    expect(v.worstRatio).toBeLessThan(4.5);
    expect(v.nearestPassingLightness).toBeDefined();

    // The suggested lightness, at the same hue/saturation, actually passes.
    const retried = validateBrandColor(210, 60, v.nearestPassingLightness!);
    expect(retried.passesContrast).toBe(true);
  });

  it('nearestPassingLightness returns the input itself when it already passes', () => {
    expect(nearestPassingLightness(264, 0, 15)).toBe(15);
  });

  it('nearestPassingLightness finds a nearby darker value for a light colour', () => {
    const l = nearestPassingLightness(210, 60, 85);
    expect(l).not.toBeNull();
    expect(l!).toBeLessThan(85);
  });
});

describe('validateBrandColor — A-01 violet band', () => {
  it('flags a violet/indigo hue', () => {
    const v = validateBrandColor(260, 50, 45);
    expect(v.violetBand).toBe(true);
  });

  it('does not flag a hue outside the violet/indigo band', () => {
    const v = validateBrandColor(160, 50, 30);
    expect(v.violetBand).toBe(false);
  });

  it('does not flag a desaturated near-violet hue (reads as neutral grey)', () => {
    const v = validateBrandColor(260, 5, 45);
    expect(v.violetBand).toBe(false);
  });

  it('describeValidation cites A-01 for a violet-band hue', () => {
    const v = validateBrandColor(260, 50, 45);
    const lines = describeValidation(v).join('\n');
    expect(lines).toContain('A-01');
  });
});

describe('validateBrandColor — E-64 system-colour collision', () => {
  it('flags a red hue', () => {
    const v = validateBrandColor(2, 70, 45);
    expect(v.systemCollision).toBe('red');
  });

  it('flags an amber hue', () => {
    const v = validateBrandColor(42, 80, 40);
    expect(v.systemCollision).toBe('amber');
  });

  it('flags a green hue', () => {
    const v = validateBrandColor(150, 60, 35);
    expect(v.systemCollision).toBe('green');
  });

  it('does not flag a blue hue', () => {
    const v = validateBrandColor(220, 70, 45);
    expect(v.systemCollision).toBeNull();
  });

  it('describeValidation cites E-64 for a colliding hue', () => {
    const v = validateBrandColor(2, 70, 45);
    const lines = describeValidation(v).join('\n');
    expect(lines).toContain('E-64');
  });
});
