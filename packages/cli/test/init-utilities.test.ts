import { describe, it, expect } from 'vitest';
import { declaredTokenNames, tailwindNamespaced, utilitiesBody } from '../src/init/utilities.js';

/**
 * The alias block that turns Jig's tokens into Tailwind utilities.
 *
 * It is generated rather than hand-written because a missing alias fails
 * silently: the class renders onto the element, matches no rule, and produces
 * no style, no error and no warning. Hand-maintaining ~130 aliases against a
 * token layer that changes is a guarantee of drift in the one direction nobody
 * can see.
 */
describe('which tokens can become utilities', () => {
  it('keeps the names Tailwind has a namespace for', () => {
    expect(tailwindNamespaced(['--color-text-strong', '--spacing-card', '--radius-surface']))
      .toEqual(['--color-text-strong', '--radius-surface', '--spacing-card']);
  });

  it('drops names Tailwind has no namespace for', () => {
    // Aliasing these emits a declaration and generates NOTHING, which is the
    // same silent failure the block exists to prevent — so they are excluded
    // rather than passed through.
    expect(tailwindNamespaced(['--size-touch-target', '--measure-prose', '--focus-ring-width']))
      .toEqual([]);
  });

  it('drops the primitives a mode selects FROM, not the selections', () => {
    // `--spacing-m` is an option; `--spacing-card` is the selection. Both match
    // the namespace, and both are legitimate utilities, so both are kept — this
    // records that the decision was considered rather than overlooked.
    expect(tailwindNamespaced(['--spacing-m', '--spacing-card'])).toContain('--spacing-m');
  });

  it('deduplicates and sorts, so the block is stable across runs', () => {
    expect(tailwindNamespaced(['--color-b', '--color-a', '--color-b']))
      .toEqual(['--color-a', '--color-b']);
  });
});

describe('the generated block', () => {
  const body = utilitiesBody(['--color-text-strong', '--radius-surface'], '0.8.0');

  it('is a self-referential @theme inline block', () => {
    expect(body).toContain('@theme inline {');
    // Tolerant of the column alignment the generator applies — the property is
    // what matters, not how many spaces sit before the value.
    expect(body).toMatch(/--color-text-strong:\s+var\(--color-text-strong\);/);
    expect(body).toMatch(/--radius-surface:\s+var\(--radius-surface\);/);
  });

  it('carries the version it was generated from', () => {
    expect(body).toContain('0.8.0');
  });

  it('says why the duplicate declaration in the compiled CSS is not a bug', () => {
    // Someone will find `--radius-surface: var(--radius-surface)` in the output
    // and try to fix it. The file has to answer that where they are looking.
    expect(body).toMatch(/unlayered|@layer theme/i);
  });

  it('refuses to emit an empty block', () => {
    // An empty `@theme inline {}` generates no utilities while looking like it
    // should, which is the exact failure mode being designed against.
    expect(() => utilitiesBody([], '0.8.0')).toThrow(/empty @theme block/i);
  });
});

describe('reading the token layer', () => {
  it('reads declarations, not references', () => {
    // `--color-brand: hsl(var(--brand-h) ...)` declares one name and consumes
    // another. Aliasing the consumed one would expose a name the layer never
    // defines, which is a utility resolving to nothing.
    const css = ':root { --color-brand: hsl(var(--brand-h) var(--brand-s) 15%); }';
    expect(declaredTokenNames(css)).toEqual(['--color-brand']);
  });

  it('finds declarations across theme blocks', () => {
    const css = ':root { --a: 1; }\n[data-theme="dark"] { --b: 2; }';
    expect(declaredTokenNames(css)).toEqual(['--a', '--b']);
  });
});

// --- End to end: does `init` actually offer it, and only when asked? ---
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach } from 'vitest';
import { init } from '../src/commands/init.js';
import { repoRoot } from './helpers/registered-commands.js';

let project: string;
let home: string;
const NOOP = () => {};

/** A project that genuinely looks like Tailwind v4 to `init`'s detector. */
const tailwindProject = () => {
  mkdirSync(join(project, 'src', 'styles'), { recursive: true });
  writeFileSync(join(project, 'src', 'styles', 'site.css'), '@import "tailwindcss";\n');
  writeFileSync(join(project, 'index.html'), '<link rel="stylesheet" href="/src/styles/site.css">');
};

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-tw-proj-'));
  home = mkdtempSync(join(tmpdir(), 'jig-tw-home-'));
});
afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

const run = (over: Record<string, unknown>) =>
  init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
         version: '0.8.0', log: NOOP, ...over } as never);

describe('init and the Tailwind alias block', () => {
  it('writes it when the user says yes', async () => {
    tailwindProject();
    await run({ yes: false, prompt: async (q: string) => (/Generate it/.test(q) ? 'y' : '') });
    const abs = join(project, 'src', 'styles', 'jig', 'utilities.css');
    expect(existsSync(abs), 'utilities.css was not written after consent').toBe(true);
    const css = readFileSync(abs, 'utf8');
    expect(css).toContain('@theme inline {');
    expect(css).toMatch(/--color-text-strong:\s+var\(--color-text-strong\);/);
  });

  it('does NOT write it when the user declines', async () => {
    tailwindProject();
    await run({ yes: false, prompt: async () => '' });
    expect(existsSync(join(project, 'src', 'styles', 'jig', 'utilities.css'))).toBe(false);
  });

  it('does NOT write it under --yes', async () => {
    // Accepting on a caller's behalf is how a token layer quietly drags a CSS
    // framework into a project. --yes means "take the defaults", and the
    // default here is no.
    tailwindProject();
    await run({ yes: true });
    expect(existsSync(join(project, 'src', 'styles', 'jig', 'utilities.css'))).toBe(false);
  });

  it('never offers it to a project that is not on Tailwind', async () => {
    mkdirSync(join(project, 'src', 'styles'), { recursive: true });
    writeFileSync(join(project, 'src', 'styles', 'site.css'), 'body { margin: 0; }\n');
    writeFileSync(join(project, 'index.html'), '<link rel="stylesheet" href="/src/styles/site.css">');
    let asked = false;
    await run({ yes: false, prompt: async (q: string) => { if (/Generate it/.test(q)) asked = true; return ''; } });
    expect(asked, 'init offered a Tailwind block to a project with no Tailwind').toBe(false);
  });
});
