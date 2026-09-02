import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detect } from '../src/init/detect.js';

let project: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-detect-'));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('detect', () => {
  it('identifies Tailwind v4 from an @import "tailwindcss" line', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), '@import "tailwindcss";\n\n.button { color: red; }\n');
    const result = detect(project);
    expect(result.cssSystem).toBe('tailwind-v4');
    expect(result.tailwindV4EntryFile).toBe('src/app.css');
  });

  it('identifies Tailwind v4 from an @theme block', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'globals.css'), '@theme {\n  --color-brand: #4f46e5;\n}\n');
    const result = detect(project);
    expect(result.cssSystem).toBe('tailwind-v4');
    expect(result.tailwindV4EntryFile).toBe('src/globals.css');
  });

  it('identifies Tailwind v3 from a tailwind.config.js with no v4 markers', () => {
    writeFileSync(
      join(project, 'tailwind.config.js'),
      'module.exports = { content: [], theme: { extend: {} } };\n',
    );
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'index.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    const result = detect(project);
    expect(result.cssSystem).toBe('tailwind-v3');
    expect(result.tailwindConfigFile).toBe('tailwind.config.js');
  });

  it('recognizes tailwind.config.ts and .cjs too', () => {
    writeFileSync(join(project, 'tailwind.config.ts'), 'export default { theme: {} };\n');
    expect(detect(project).cssSystem).toBe('tailwind-v3');
  });

  it('identifies plain CSS when there is a stylesheet but no Tailwind signal', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --color-text: #111; }\n.button { color: var(--color-text); }\n');
    const result = detect(project);
    expect(result.cssSystem).toBe('plain-css');
    expect(result.cssFiles).toContain('src/app.css');
  });

  it('identifies unknown when there is no CSS and no Tailwind config at all', () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'index.js'), 'console.log("hi");\n');
    const result = detect(project);
    expect(result.cssSystem).toBe('unknown');
    expect(result.cssFiles).toEqual([]);
  });

  it('excludes node_modules and .jig from the scan', () => {
    mkdirSync(join(project, 'node_modules', 'some-pkg'), { recursive: true });
    writeFileSync(join(project, 'node_modules', 'some-pkg', 'style.css'), '@import "tailwindcss";\n');
    mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
    writeFileSync(join(project, '.jig', 'tokens', 'brand.default.css'), '@import "tailwindcss";\n');
    const result = detect(project);
    expect(result.cssSystem).toBe('unknown');
    expect(result.cssFiles).toEqual([]);
  });

  it('reports a recognizable framework from package.json dependencies', () => {
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'x', dependencies: { react: '^18.0.0' } }));
    expect(detect(project).framework).toBe('React');
  });

  it('leaves framework undefined when nothing is recognized', () => {
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }));
    expect(detect(project).framework).toBeUndefined();
  });
});
