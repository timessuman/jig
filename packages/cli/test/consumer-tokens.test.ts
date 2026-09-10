import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTokenMap } from '../src/check/tokens.js';

/**
 * I5. The token map held only Jig's own vendored `.jig/tokens/*.css`, so a
 * custom property the PROJECT declared in its own `:root` was never in it.
 * `resolveOpaqueColor` and `extractColorComponents` then treated every
 * `var(--their-token)` as unresolvable and skipped it — the safe direction, no
 * wrong answers, but it meant `contrast-floor` and `violet-band-hue` silently
 * did not evaluate an entire class of real values. On a project that had never
 * run `jig init`, that is very nearly all of them.
 */
let project: string;

const write = (rel: string, content: string) => {
  const abs = join(project, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
};

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-consumer-tokens-'));
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

describe('the project’s own tokens are resolvable', () => {
  it('reads a custom property the consumer declares in :root', () => {
    write('src/app.css', ':root { --brand: #6D28D9; --muted: #767676; }\n');
    const tokens = loadTokenMap(project, ['src/app.css']);
    expect(tokens.brand, 'a consumer token was invisible').toBe('#6D28D9');
    expect(tokens.muted).toBe('#767676');
  });

  it('reads them out of a host language too', () => {
    // A `createGlobalStyle` template is where a styled-components project puts
    // exactly this. The style-region mask already handles it.
    write('src/theme.ts', 'const g = createGlobalStyle`\n:root { --brand: #123456; }\n`;\n');
    expect(loadTokenMap(project, ['src/theme.ts']).brand).toBe('#123456');
  });

  it('still reads Jig’s vendored tokens with no consumer files at all', () => {
    write('.jig/tokens/brand.default.css', ':root { --color-brand: #000000; }\n');
    expect(loadTokenMap(project)['color-brand']).toBe('#000000');
  });

  it('does not read a vendored file twice as if it were the consumer’s', () => {
    write('.jig/tokens/brand.default.css', ':root { --color-brand: #000000; }\n');
    const tokens = loadTokenMap(project, ['.jig/tokens/brand.default.css']);
    expect(tokens['color-brand']).toBe('#000000');
  });
});

describe('ambiguity resolves to silence, not to a guess', () => {
  it('drops a token the consumer and Jig define differently', () => {
    // Which value a browser uses depends on import order, which is not knowable
    // from the files. Guessing wrong does not cost a missed finding — it costs
    // a REPORTED finding against a value the page never renders.
    write('.jig/tokens/brand.default.css', ':root { --color-brand: #000000; }\n');
    write('src/app.css', ':root { --color-brand: #ffffff; }\n');
    const tokens = loadTokenMap(project, ['src/app.css']);
    expect('color-brand' in tokens, 'an ambiguous token was resolved anyway').toBe(false);
  });

  it('keeps it when both agree, because there is nothing to be wrong about', () => {
    write('.jig/tokens/brand.default.css', ':root { --color-brand: #000000; }\n');
    write('src/app.css', ':root { --color-brand: #000000; }\n');
    expect(loadTokenMap(project, ['src/app.css'])['color-brand']).toBe('#000000');
  });

  it('drops a token two consumer files disagree about', () => {
    write('src/a.css', ':root { --brand: #111111; }\n');
    write('src/b.css', ':root { --brand: #222222; }\n');
    expect('brand' in loadTokenMap(project, ['src/a.css', 'src/b.css'])).toBe(false);
  });
});

describe('scope stays shallow, deliberately', () => {
  it('ignores a :root inside a media query', () => {
    // `check` cannot know which theme a given piece of markup renders under,
    // so it resolves against the one unambiguous default and leaves the rest.
    write('src/app.css', '@media (prefers-color-scheme: dark) {\n  :root { --brand: #ffffff; }\n}\n');
    expect('brand' in loadTokenMap(project, ['src/app.css'])).toBe(false);
  });

  it('ignores a themed :root variant', () => {
    write('src/app.css', ':root[data-theme="dark"] { --brand: #ffffff; }\n');
    expect('brand' in loadTokenMap(project, ['src/app.css'])).toBe(false);
  });

  it('survives a file that vanished between selection and read', () => {
    expect(() => loadTokenMap(project, ['src/gone.css'])).not.toThrow();
  });
});
