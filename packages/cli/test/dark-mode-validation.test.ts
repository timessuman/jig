import { describe, it, expect } from 'vitest';
import { validateBrandColor } from '../src/init/validate.js';

/**
 * `init` validates a derived brand colour against the LIGHT-mode backgrounds
 * only. `brand.default.css` also ships a dark block, which keeps the brand's
 * hue and saturation but overrides lightness to 88% against a
 * `hsl(h 6% 15%)` raised surface — values `init` never looked at.
 *
 * So a colour could be accepted, written into the project, and fail the
 * contrast contract the generated brand file itself states, in a mode the user
 * only discovers by switching their OS theme. For a system whose entire claim
 * is enforced contrast floors, that is the wrong half to check.
 */
describe('brand validation covers dark mode', () => {
  it('reports a dark-mode ratio at all', () => {
    const r = validateBrandColor(264, 0, 15);
    expect(r.darkRatioVsRaised, 'no dark-mode ratio reported').toBeGreaterThan(0);
    expect(r.darkRatioVsFill).toBeGreaterThan(0);
    expect(r.darkWorstRatio).toBe(Math.min(r.darkRatioVsRaised, r.darkRatioVsFill));
  });

  it('holds the unbranded default to the floor in both modes', () => {
    // The shipped default must pass what it asks of everyone else.
    const r = validateBrandColor(264, 0, 15);
    expect(r.passesContrast, 'the shipped default fails its own contract').toBe(true);
    expect(r.darkWorstRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('takes the verdict from the worse of the two modes, not the light one', () => {
    const r = validateBrandColor(55, 95, 45);
    expect(r.worstRatio).toBe(Math.min(r.lightWorstRatio, r.darkWorstRatio));
    expect(r.passesContrast).toBe(r.worstRatio >= 4.5);
  });

  it('keeps the light-mode fields working for existing callers', () => {
    const r = validateBrandColor(264, 0, 15);
    expect(r.ratioVsRaised).toBe(r.lightRatioVsRaised);
    expect(r.ratioVsFill).toBe(r.lightRatioVsFill);
  });
});
