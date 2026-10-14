import { describe, it, expect } from 'vitest';
import { viewportHeight } from '../src/check/detectors/viewport-height.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inputZoom, touchFormText } from '../src/check/detectors/input-zoom.js';
import { repoRoot } from './helpers/registered-commands.js';
import { safeArea } from '../src/check/detectors/safe-area.js';
import type { DetectorContext } from '../src/check/types.js';

function ctx(ruleId: string, extra: Partial<DetectorContext> = {}): DetectorContext {
  return { ruleId, bucket: 'mechanical', severity: 'warning', tokens: {}, projectParticipates: false, raw: '', ...extra };
}

describe('viewport-height (D-112)', () => {
  const c = ctx('D-112');

  it('fires on a full-height section sized with 100vh', () => {
    const f = viewportHeight.run('.hero {\n  min-height: 100vh;\n}\n', 'a.css', c);
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(2);
  });

  it('fires on 100vh inside calc', () => {
    expect(viewportHeight.run('.shell { height: calc(100vh - 4rem); }', 'a.css', c)).toHaveLength(1);
  });

  // The correct progressive pattern keeps 100vh as the fallback line. It must
  // not be punished for including the old unit on purpose.
  it('does not fire when 100vh is only the fallback for a small or dynamic unit', () => {
    expect(viewportHeight.run('.hero { min-height: 100vh; min-height: 100svh; }', 'a.css', c)).toHaveLength(0);
    expect(viewportHeight.run('.app { height: 100dvh; }', 'a.css', c)).toHaveLength(0);
  });

  it('does not fire on widths or on other vh values', () => {
    expect(viewportHeight.run('.x { width: 100vw; max-height: 50vh; }', 'a.css', c)).toHaveLength(0);
  });
});

describe('input-zoom (F-113)', () => {
  it('fires on a form control whose text is below 16px', () => {
    const f = inputZoom.run('input,\nselect {\n  font-size: 14px;\n}\n', 'a.css', ctx('F-113'));
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(3);
  });

  it('reads rem against a 16px root', () => {
    expect(inputZoom.run('textarea { font-size: 0.875rem; }', 'a.css', ctx('F-113'))).toHaveLength(1);
    expect(inputZoom.run('textarea { font-size: 1rem; }', 'a.css', ctx('F-113'))).toHaveLength(0);
  });

  it('knows the caption token is below 16px in every mode', () => {
    expect(inputZoom.run('input { font-size: var(--text-caption); }', 'a.css', ctx('F-113'))).toHaveLength(1);
  });

  // Jig's own default trips the bug: operator body text is 14px. The same
  // declaration is correct in editorial and product, where body is 16px.
  it('flags the body token only in operator, where Jig itself sets it to 14px', () => {
    const css = 'input { font-size: var(--text-body); }';
    expect(inputZoom.run(css, 'a.css', ctx('F-113', { mode: 'operator' }))).toHaveLength(1);
    expect(inputZoom.run(css, 'a.css', ctx('F-113', { mode: 'product' }))).toHaveLength(0);
    expect(inputZoom.run(css, 'a.css', ctx('F-113'))).toHaveLength(0);
  });

  it('does not fire when the file raises form text for touch screens', () => {
    const css = 'input { font-size: 14px; }\n@media (pointer: coarse) { input { font-size: 16px; } }';
    expect(inputZoom.run(css, 'a.css', ctx('F-113'))).toHaveLength(0);
  });

  // An operator invoices page: the search field wrote `font: inherit` under a
  // body of `var(--text-body)`, and the file's only touch query raised the
  // rows. Both let 14px form text through.
  it('reads `font: inherit` through to the body, and a touch query that raises only rows is not a fix', () => {
    const page = [
      'body { font-size: var(--text-body); }',
      '.search input[type="search"] {',
      '  font: inherit;',
      '}',
      '@media (pointer: coarse) { :root { --size-row: var(--size-touch-target); } }',
    ].join('\n');
    const f = inputZoom.run(page, 'a.css', ctx('F-113', { mode: 'operator' }));
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(3);
    expect(f[0].message).toMatch(/inherits the body's 14px/);
    expect(inputZoom.run('input { font: 600 14px/1.5 Inter, sans-serif; }', 'a.css', ctx('F-113'))).toHaveLength(1);
  });

  it("is satisfied by the body token once a touch query raises it, in the file or in the project's tokens", () => {
    const css = 'input { font-size: var(--text-body); }';
    const raised = '@media (pointer: coarse) { :root { --size-row: 48px; --text-body: 16px; } }';
    expect(inputZoom.run(`${css}\n${raised}`, 'a.css', ctx('F-113', { mode: 'operator' }))).toHaveLength(0);
    expect(inputZoom.run(css, 'a.css', ctx('F-113', { mode: 'operator', touchFormText: touchFormText(raised) }))).toHaveLength(0);
    // Raising the body does nothing for a control that names its own small size.
    expect(inputZoom.run('input { font-size: var(--text-caption); }', 'a.css', ctx('F-113', { mode: 'operator', touchFormText: touchFormText(raised) }))).toHaveLength(1);
  });

  it("finds that raise in Jig's own operator tokens", () => {
    const operator = readFileSync(join(repoRoot, 'tokens', 'mode.operator.css'), 'utf8');
    expect(touchFormText(operator)).toEqual({ body: true, control: false });
  });

  it('does not fire on a small label or button, which never zoom', () => {
    expect(inputZoom.run('label, .hint { font-size: 12px; }', 'a.css', ctx('F-113'))).toHaveLength(0);
    expect(inputZoom.run('.input-group-label { font-size: 12px; }', 'a.css', ctx('F-113'))).toHaveLength(0);
  });
});

describe('safe-area (D-114)', () => {
  const bar = '.tabbar {\n  position: fixed;\n  bottom: 0;\n}\n';

  it('fires on a bar pinned to an edge when the page extends under the notch', () => {
    const f = safeArea.run(bar, 'a.css', ctx('D-114', { viewportFitCover: true }));
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(2);
  });

  it('does not fire when the bar pads itself with the safe-area inset', () => {
    const css = '.tabbar { position: fixed; bottom: 0; padding-bottom: env(safe-area-inset-bottom); }';
    expect(safeArea.run(css, 'a.css', ctx('D-114', { viewportFitCover: true }))).toHaveLength(0);
  });

  // Without viewport-fit=cover the browser letterboxes the page inside the safe
  // area itself, so an edge-pinned bar is already clear of the notch.
  it('does not fire when the page does not extend under the notch', () => {
    expect(safeArea.run(bar, 'a.css', ctx('D-114', { viewportFitCover: false }))).toHaveLength(0);
    expect(safeArea.run(bar, 'a.css', ctx('D-114'))).toHaveLength(0);
  });

  it('does not fire on a fixed element that is not pinned to an edge', () => {
    expect(safeArea.run('.toast { position: fixed; bottom: 2rem; }', 'a.css', ctx('D-114', { viewportFitCover: true }))).toHaveLength(0);
  });
});
