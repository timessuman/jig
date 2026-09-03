import { describe, it, expect } from 'vitest';
import { participatesInTokenLayer } from '../src/check/token-layer.js';

/**
 * Tailwind v4 declares tokens inside `@theme { }` and consumes them as
 * utilities rather than `var(--x)`. A v4 project that has fully adopted Jig
 * still needs to count as being on the token layer, or H-47 never runs on it.
 */
const tokens = { 'color-text-strong': 'x', 'spacing-card': '24px' };

describe('participatesInTokenLayer with Tailwind v4', () => {
  it('accepts a @theme block that defines a known token', () => {
    const css = '@import "tailwindcss";\n@theme {\n  --color-text-strong: #111;\n}\n';
    expect(participatesInTokenLayer(css, tokens)).toBe(true);
  });

  it('accepts @theme wrapping the jig imports', () => {
    const css = '@theme {\n  @import "../.jig/tokens/mode.product.css";\n}\n';
    expect(participatesInTokenLayer(css, tokens)).toBe(true);
  });

  it('still accepts the plain var() form', () => {
    expect(participatesInTokenLayer('.a { color: var(--color-text-strong); }', tokens)).toBe(true);
  });

  it('rejects a stylesheet that names no known token', () => {
    expect(participatesInTokenLayer('@theme {\n  --brand-x: red;\n}\n', tokens)).toBe(false);
    expect(participatesInTokenLayer('.a { color: red; }', tokens)).toBe(false);
  });
});
