import { describe, it, expect } from 'vitest';
import { classAttributeValues, arbitraryValues, palettePairs } from '../src/check/tailwind.js';

/**
 * Tailwind writes values into class attributes, where they are not CSS and no
 * amount of style extraction will find them. Two forms are decidable:
 *
 * - **Arbitrary values** — `bg-[#6D28D9]`, `p-[13px]`, `text-[22px]`. The
 *   bracket syntax means "this exact value, bypassing the scale", which is H-47
 *   stated in Tailwind's own notation. Unambiguous, and detectable without
 *   modelling the framework.
 * - **Default-palette pairs** — `bg-gray-950 text-white`. Both sides are known
 *   constants, so C-19 can resolve the contrast without a parser.
 *
 * A bare `p-4` is deliberately NOT a finding: it resolves through a scale, which
 * is what a scale is for. Flagging it would mean flagging correct Tailwind.
 */
describe('classAttributeValues', () => {
  it('reads class and className, single or double quoted', () => {
    expect(classAttributeValues('<div class="a b">')).toEqual(['a b']);
    expect(classAttributeValues("<div className='c d'>")).toEqual(['c d']);
  });

  it('reads a JSX expression container', () => {
    expect(classAttributeValues('<div className={"e f"}>')).toEqual(['e f']);
  });

  it('reads template literals and clsx-style joins', () => {
    const out = classAttributeValues('<div className={`g ${x} h`}>').join(' ');
    expect(out).toContain('g');
    expect(out).toContain('h');
  });

  it('ignores unrelated attributes', () => {
    expect(classAttributeValues('<div data-x="p-[13px]">')).toEqual([]);
  });
});

describe('arbitraryValues', () => {
  it('finds a hard-coded colour', () => {
    expect(arbitraryValues('bg-[#6D28D9] text-white')).toEqual([
      { utility: 'bg', value: '#6D28D9', kind: 'colour' },
    ]);
  });

  it('finds hard-coded lengths', () => {
    expect(arbitraryValues('p-[13px] text-[22px] h-[32px]').map((v) => v.value)).toEqual([
      '13px', '22px', '32px',
    ]);
  });

  it('handles a variant prefix', () => {
    expect(arbitraryValues('hover:bg-[#fff] md:p-[13px]').map((v) => v.value)).toEqual([
      '#fff', '13px',
    ]);
  });

  it('ignores scale utilities, which are the correct way to write Tailwind', () => {
    expect(arbitraryValues('p-4 text-sm bg-brand rounded-lg flex')).toEqual([]);
  });

  it('ignores an arbitrary value that reads a token — that is the token layer working', () => {
    expect(arbitraryValues('bg-[var(--color-brand)] p-[var(--spacing-card)]')).toEqual([]);
  });

  it('ignores non-visual arbitrary values', () => {
    // A grid template or a z-index is not a colour or a size off the scale.
    expect(arbitraryValues('grid-cols-[1fr_auto] z-[60]')).toEqual([]);
  });
});

describe('palettePairs', () => {
  it('resolves a known foreground/background pair', () => {
    const pair = palettePairs('bg-gray-950 text-white');
    expect(pair).toEqual([{ background: '#030712', foreground: '#ffffff' }]);
  });

  it('returns nothing when only one side is known', () => {
    expect(palettePairs('bg-gray-950')).toEqual([]);
    expect(palettePairs('text-white')).toEqual([]);
  });

  it('returns nothing for a custom colour name it cannot resolve', () => {
    expect(palettePairs('bg-brand text-on-brand')).toEqual([]);
  });
});
