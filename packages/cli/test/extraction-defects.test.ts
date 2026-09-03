import { describe, it, expect } from 'vitest';
import { maskNonStyleRegions } from '../src/check/styles.js';
import { classAttributeValues } from '../src/check/tailwind.js';

/**
 * Defects found by probing the extraction rather than by reading it.
 */
describe('style-object masking produces balanced output', () => {
  it('does not emit a stray closing brace', () => {
    // `readObject` counted depth from the OUTER brace of `{{`, so its body ran
    // to the outer `}` — swallowing the inner one — and the brace rewrite then
    // added another. The result was `{ color: red }}`: syntactically wrong, and
    // a stray `}` can close an enclosing block early wherever one exists.
    const src = "const A = () => <b style={{ color: 'red' }}>x</b>;";
    const out = maskNonStyleRegions(src, 'a.tsx');
    const opens = (out.match(/\{/g) ?? []).length;
    const closes = (out.match(/\}/g) ?? []).length;
    expect({ opens, closes }).toEqual({ opens: 1, closes: 1 });
  });

  it('keeps every character position, including for style objects', () => {
    const src = "const A = () => <b style={{ color: 'red' }}>x</b>;";
    expect(maskNonStyleRegions(src, 'a.tsx')).toHaveLength(src.length);
  });

  it('does not let a stray brace swallow a following style region', () => {
    const src = [
      "const A = () => <b style={{ color: '#111111' }}>x</b>;",
      'const B = styled.i`',
      '  color: #222222;',
      '`;',
    ].join('\n');
    const out = maskNonStyleRegions(src, 'a.tsx');
    expect(out).toContain('#111111');
    expect(out).toContain('#222222');
    expect((out.match(/\{/g) ?? []).length).toBe((out.match(/\}/g) ?? []).length);
  });
});

describe('class attributes report their own position', () => {
  it('distinguishes two identical class strings on different lines', () => {
    // `indexOf` always found the first occurrence, so both findings pointed at
    // the first line. A user fixes it, re-runs, and the finding looks unchanged
    // with nothing naming the line that is still wrong.
    const raw = [
      'export const A = () => (',
      '  <div className="p-[13px]">one</div>',
      ');',
      'export const B = () => (',
      '  <div className="p-[13px]">two</div>',
      ');',
    ].join('\n');

    const found = classAttributeValues(raw);
    expect(found).toHaveLength(2);
    expect(found.map((f) => f.line)).toEqual([2, 5]);
    expect(found.every((f) => f.classes === 'p-[13px]')).toBe(true);
  });

  it('reports the line a multi-line class attribute starts on', () => {
    const raw = ['<div', '  className="a', '   b"', '>'].join('\n');
    expect(classAttributeValues(raw)[0].line).toBe(2);
  });
});
