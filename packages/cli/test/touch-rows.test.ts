import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * A dense table row is shorter than the 48px touch-target floor. An agent
 * that met the floor with a control's own min-height made the rows holding
 * that control taller than the rest: an invoices table with "Mark paid" rows
 * at 48px among 36px ones. The mode files raise every row to the floor under
 * a coarse pointer instead, so the rows stay one height and a finger gets its
 * target.
 */
const mode = (m: string) => readFileSync(join(repoRoot, 'tokens', `mode.${m}.css`), 'utf8');
const px = (css: string, token: string) => Number(new RegExp(`${token}:\\s*(\\d+)px`).exec(css)![1]);

describe('rows below the touch target rise to it on a touch screen', () => {
  for (const m of ['editorial', 'product', 'operator']) {
    it(`${m}: every row token under 48px is raised under a coarse pointer`, () => {
      const css = mode(m);
      const floor = px(css, '--size-touch-target');
      const coarse = /@media \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
      for (const token of ['--size-row', '--size-row-compact']) {
        if (px(css, token) >= floor) continue;
        expect(coarse, `${m} ${token}`).toMatch(new RegExp(`${token}:\\s*var\\(--size-touch-target\\)`));
      }
    });
  }
});
