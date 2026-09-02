import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deriveBrandColor,
  fromCssCustomProperties,
  fromTailwindConfig,
  fromLiteralFrequency,
  DEFAULT_PROPOSAL,
} from '../src/init/derive.js';

let project: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-derive-'));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('fromCssCustomProperties', () => {
  it('prefers a custom property named brand/primary/accent over any other candidate', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(
      join(project, 'src', 'app.css'),
      ':root {\n  --brand-color: #4F46E5;\n  --other-thing: #16A34A;\n  --other-thing: #16A34A;\n  --other-thing: #16A34A;\n}\n',
    );
    const proposal = fromCssCustomProperties(project, ['src/app.css']);
    expect(proposal).not.toBeNull();
    expect(proposal!.source).toBe('css-custom-property');
    expect(proposal!.detail).toContain('--brand-color');
    // #4F46E5 is hue ~244.
    expect(Math.round(proposal!.h)).toBeGreaterThan(230);
    expect(Math.round(proposal!.h)).toBeLessThan(260);
  });

  it('falls back to the most frequent chromatic custom property when no name matches', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(
      join(project, 'src', 'a.css'),
      ':root { --tag-1: #16A34A; }\n.x { --tag-2: #16A34A; }\n.y { --tag-3: #EAB308; }\n',
    );
    const proposal = fromCssCustomProperties(project, ['src/a.css']);
    expect(proposal).not.toBeNull();
    // #16A34A (green) appears twice, #EAB308 (yellow) once.
    expect(proposal!.detail).toContain('#16A34A');
  });

  it('returns null when no custom property resolves to a literal colour', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'a.css'), ':root { --spacing: 8px; --radius: 4px; }\n');
    expect(fromCssCustomProperties(project, ['src/a.css'])).toBeNull();
  });
});

describe('fromTailwindConfig', () => {
  it('reads theme.extend.colors without evaluating the config file', () => {
    writeFileSync(
      join(project, 'tailwind.config.js'),
      [
        'module.exports = {',
        '  content: [],',
        '  theme: {',
        '    extend: {',
        "      colors: { brand: '#22C55E', muted: '#9CA3AF' },",
        '    },',
        '  },',
        '};',
        '',
      ].join('\n'),
    );
    const proposal = fromTailwindConfig(project, 'tailwind.config.js');
    expect(proposal).not.toBeNull();
    expect(proposal!.source).toBe('tailwind-config');
    expect(proposal!.detail).toContain('brand');
    expect(proposal!.detail).toContain('#22C55E');
  });

  it('returns null when the config has no parseable colours', () => {
    writeFileSync(join(project, 'tailwind.config.js'), 'module.exports = { content: [] };\n');
    expect(fromTailwindConfig(project, 'tailwind.config.js')).toBeNull();
  });
});

describe('fromLiteralFrequency', () => {
  it('proposes the most frequent literal chromatic colour', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'a.css'), '.a { color: #E11D48; }\n.b { border-color: #E11D48; }\n');
    writeFileSync(join(project, 'src', 'b.css'), '.c { background: #0EA5E9; }\n');
    const proposal = fromLiteralFrequency(project, ['src/a.css', 'src/b.css']);
    expect(proposal).not.toBeNull();
    expect(proposal!.detail).toContain('#E11D48');
  });

  it('ignores near-grey literals so black/white utility colours never win by volume', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(
      join(project, 'src', 'a.css'),
      '.a { color: #000000; } .b { color: #ffffff; } .c { color: #eeeeee; } .d { color: #7C3AED; }\n',
    );
    const proposal = fromLiteralFrequency(project, ['src/a.css']);
    expect(proposal).not.toBeNull();
    expect(proposal!.detail).toContain('#7C3AED');
  });

  it('returns null when the project has no chromatic literal colours at all', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'a.css'), '.a { color: #000; } .b { color: #fff; }\n');
    expect(fromLiteralFrequency(project, ['src/a.css'])).toBeNull();
  });
});

describe('deriveBrandColor — priority and fallback', () => {
  it('prefers a CSS custom property over a Tailwind config or literal colours', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand: #4F46E5; }\n.x { color: #E11D48; }\n');
    writeFileSync(
      join(project, 'tailwind.config.js'),
      "module.exports = { theme: { extend: { colors: { brand: '#22C55E' } } } };\n",
    );
    const proposal = deriveBrandColor(project, ['src/app.css'], 'tailwind.config.js');
    expect(proposal.source).toBe('css-custom-property');
  });

  it('falls back to the Tailwind config when there are no usable custom properties', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --radius: 8px; }\n');
    writeFileSync(
      join(project, 'tailwind.config.js'),
      "module.exports = { theme: { extend: { colors: { brand: '#22C55E' } } } };\n",
    );
    const proposal = deriveBrandColor(project, ['src/app.css'], 'tailwind.config.js');
    expect(proposal.source).toBe('tailwind-config');
  });

  it('falls back to literal-frequency when there is no config and no custom properties', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), '.a { color: #E11D48; } .b { border-color: #E11D48; }\n');
    const proposal = deriveBrandColor(project, ['src/app.css'], undefined);
    expect(proposal.source).toBe('literal-frequency');
  });

  it('falls back cleanly to the unbranded default when nothing is found anywhere', () => {
    const proposal = deriveBrandColor(project, [], undefined);
    expect(proposal).toEqual(DEFAULT_PROPOSAL);
    expect(proposal.source).toBe('default');
  });
});
