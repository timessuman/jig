import { describe, it, expect } from 'vitest';
import { layoutMotion } from '../src/check/detectors/layout-motion.js';
import type { DetectorContext } from '../src/check/types.js';

const run = (raw: string, file = 'app.css') =>
  layoutMotion.run(raw, file, { ruleId: 'G-162', bucket: 'hybrid', severity: 'warning', tokens: {}, projectParticipates: true, raw } as DetectorContext);

describe('layout-motion (G-162)', () => {
  it('reports a transition on a layout property, on its line', () => {
    const f = run('.a { color: red; }\n.row { transition: height 200ms ease; }');
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(2);
    expect(f[0].message).toMatch(/transition on `height`/);
  });

  it('reports `all`, in the shorthand and the longhand', () => {
    expect(run('.a { transition: all 150ms; }')[0].message).toMatch(/transition on `all`/);
    expect(run('.a { transition-property: opacity, margin-top; }')).toHaveLength(1);
  });

  it('reports a keyframe that moves layout', () => {
    expect(run('@keyframes slide { from { left: 0; } to { left: 40px; } }')).toHaveLength(1);
  });

  it('reports Tailwind classes that animate everything or layout, with variants', () => {
    expect(run('<div class="transition-all duration-200">', 'a.html')).toHaveLength(1);
    expect(run('<div class="hover:transition-[height]">', 'a.html')).toHaveLength(1);
  });

  it('leaves transform, opacity and the disclosure technique alone', () => {
    expect(run('.a { transition: opacity 150ms var(--ease-out), transform 150ms cubic-bezier(0.2, 0, 0, 1); }')).toHaveLength(0);
    expect(run('.d { transition: grid-template-rows 200ms; }')).toHaveLength(0);
    expect(run('@keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }')).toHaveLength(0);
    expect(run('<div class="transition transition-opacity transition-transform">', 'a.html')).toHaveLength(0);
    expect(run('.a { transition-duration: 200ms; }')).toHaveLength(0);
  });
});
