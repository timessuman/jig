import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { declaredSwitches, probeWidths } from '../src/probe/switches.js';
import { PROBE_WIDTHS } from '../src/probe/save.js';

/**
 * A layout switch falls between the judged widths. On a real site the
 * three-column frame appeared at 1216px and 1024 to 1215 still got the phone
 * arrangement; nothing measured there. A probe run now measures either side
 * of every width a project declares.
 */
let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'jig-switch-')); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('declaredSwitches', () => {
  it('reads every distinct --breakpoint-* width, in px and rem, from the project\'s styles', () => {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'site.css'), '@theme {\n  --breakpoint-nav: 540px;\n  --breakpoint-rails: 76rem;\n}\n');
    writeFileSync(join(root, 'src', 'other.css'), ':root { --breakpoint-nav: 600px; }\n');
    writeFileSync(join(root, 'src', 'again.css'), ':root { --breakpoint-nav: 540px; }\n');
    expect(declaredSwitches(root)).toEqual([{ name: 'nav', px: 540 }, { name: 'nav', px: 600 }, { name: 'rails', px: 1216 }]);
  });

  it('finds nothing in a project that declares no switch', () => {
    writeFileSync(join(root, 'a.css'), ':root { --size-row: 48px; }\n');
    expect(declaredSwitches(root)).toEqual([]);
  });
});

describe('probeWidths', () => {
  it('adds the last width before and the first width at each switch to the judged four', () => {
    expect(probeWidths(PROBE_WIDTHS, [{ name: 'nav', px: 540 }, { name: 'rails', px: 1216 }]))
      .toEqual([360, 539, 540, 768, 1215, 1216, 1280, 1600]);
  });

  it('keeps the judged four alone when there is no switch, and does not repeat a width', () => {
    expect(probeWidths(PROBE_WIDTHS, [])).toEqual(PROBE_WIDTHS);
    expect(probeWidths(PROBE_WIDTHS, [{ name: 'x', px: 769 }])).toEqual([360, 768, 769, 1280, 1600]);
  });
});
