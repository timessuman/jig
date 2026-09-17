import { describe, it, expect } from 'vitest';
import { isResponsive } from '../src/check/responsive.js';
import { fixedWidth } from '../src/check/detectors/fixed-width.js';
import type { DetectorContext } from '../src/check/types.js';

function ctx(projectResponsive: boolean | undefined): DetectorContext {
  return {
    ruleId: 'D-111',
    bucket: 'mechanical',
    severity: 'warning',
    tokens: {},
    projectParticipates: false,
    raw: '',
    projectResponsive,
  };
}

describe('isResponsive — what counts as adapting to the viewport', () => {
  it('counts a width media query, in either direction and any unit', () => {
    expect(isResponsive('@media (max-width: 768px) { .a { display: block } }', '')).toBe(true);
    expect(isResponsive('@media (min-width: 40em) { .a { display: grid } }', '')).toBe(true);
    expect(isResponsive('@media (width >= 600px) { .a { gap: 0 } }', '')).toBe(true);
  });

  // The trap. L-04 asks every page for a reduced-motion path, so the one
  // @media a careful fixed-width page is most likely to contain is this one.
  // A detector that counted any @media would be silenced by following Jig.
  it('does NOT count a media query about preference or output rather than size', () => {
    expect(isResponsive('@media (prefers-reduced-motion: reduce) { * { transition: none } }', '')).toBe(false);
    expect(isResponsive('@media (prefers-color-scheme: dark) { :root { --bg: #000 } }', '')).toBe(false);
    expect(isResponsive('@media print { nav { display: none } }', '')).toBe(false);
  });

  it('counts constructs that adapt without a breakpoint', () => {
    expect(isResponsive('.g { grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)) }', '')).toBe(true);
    expect(isResponsive('.n { display: flex; flex-wrap: wrap }', '')).toBe(true);
    expect(isResponsive('h1 { font-size: clamp(2rem, 5vw, 4rem) }', '')).toBe(true);
    expect(isResponsive('@container (min-width: 30rem) { .c { display: grid } }', '')).toBe(true);
  });

  it('counts Tailwind breakpoint prefixes in markup, where no @media is ever written', () => {
    expect(isResponsive('', '<div class="grid md:grid-cols-3">')).toBe(true);
    expect(isResponsive('', '<nav className="hidden lg:flex">')).toBe(true);
  });

  it('does not mistake a non-breakpoint Tailwind variant for one', () => {
    expect(isResponsive('', '<a class="hover:underline focus-visible:ring">')).toBe(false);
  });

  it('is not fooled by flex-wrap: nowrap', () => {
    expect(isResponsive('.n { display: flex; flex-wrap: nowrap }', '')).toBe(false);
  });
});

describe('fixed-width (D-111)', () => {
  const plans = '.plans {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n}\n';

  it('fires on a multi-column grid when nothing in the project adapts to the viewport', () => {
    const f = fixedWidth.run(plans, 'pricing.css', ctx(false));
    expect(f).toHaveLength(1);
    expect(f[0].ruleId).toBe('D-111');
    expect(f[0].line).toBe(3);
  });

  it('fires on a row of flex items — the nav that overflows a phone', () => {
    expect(fixedWidth.run('nav ul {\n  display: flex;\n  gap: 2rem;\n}\n', 'site.css', ctx(false))).toHaveLength(1);
  });

  it('fires on a fixed pixel width wide enough to overflow a phone', () => {
    expect(fixedWidth.run('.page {\n  width: 1200px;\n}\n', 'a.css', ctx(false))).toHaveLength(1);
  });

  it('does not fire on a column of flex items, which stacks already', () => {
    expect(fixedWidth.run('.stack { display: flex; flex-direction: column; }', 'a.css', ctx(false))).toHaveLength(0);
  });

  // A single column of text with a max-width works on a phone with no media
  // query at all. There is nothing side by side to break.
  it('does not fire on a file with nothing laid out side by side', () => {
    expect(fixedWidth.run('body { max-width: 65ch; margin: 0 auto; line-height: 1.6 }', 'a.css', ctx(false))).toHaveLength(0);
    expect(fixedWidth.run('.page { max-width: 1200px }', 'a.css', ctx(false))).toHaveLength(0);
  });

  // The reason this is a project fact and not a file fact: the three-column
  // grid lives in pricing.css and the query that collapses it lives in
  // responsive.css. Judged per file, pricing.css would be flagged wrongly.
  it('does not fire when the project adapts somewhere, even if not in this file', () => {
    expect(fixedWidth.run(plans, 'pricing.css', ctx(true))).toHaveLength(0);
  });

  it('stays silent when responsiveness was never computed, rather than guessing', () => {
    expect(fixedWidth.run(plans, 'pricing.css', ctx(undefined))).toHaveLength(0);
  });

  it('does not fire on a small fixed width that fits a phone', () => {
    expect(fixedWidth.run('.icon { width: 24px; display: flex; flex-direction: column }', 'a.css', ctx(false))).toHaveLength(0);
  });
});
