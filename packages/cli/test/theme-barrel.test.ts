import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../src/commands/init.js';
import { install } from '../src/commands/install.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * One import per surface, through a barrel Jig owns.
 *
 * Two things forced the shape. A barrel CANNOT merge modes: the three mode
 * files declare the same token names with different values, so importing all
 * three into one document leaves only the last — measured, and it yields
 * operator throughout, with editorial and product dead weight. `01-modes.md`
 * already says why that is not a loss: density switches at the route boundary,
 * never inside one view. So there is one barrel per mode.
 *
 * And the primary barrel is named `theme.css`, not `theme.product.css`. The
 * point of a barrel here is that changing the mode in `jig.config.json` stops
 * rewriting the user's stylesheet — only Jig's own file changes. A
 * mode-in-the-name barrel would rewire on every mode change, which is what it
 * exists to prevent.
 */
let project: string;
let home: string;

const setup = (stylesheetDir = 'src/styles', name = 'global.css') => {
  mkdirSync(join(project, ...stylesheetDir.split('/')), { recursive: true });
  writeFileSync(join(project, ...stylesheetDir.split('/'), name), 'body{color:#333}\n');
  install({ agent: 'claude', scope: 'project', projectRoot: project,
            packageRoot: repoRoot, version: '0.6.0', homeDir: home });
};
const run = (log: (l: string) => void = () => {}) =>
  init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
         version: '0.6.0', yes: true, log });

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-barrel-'));
  home = mkdtempSync(join(tmpdir(), 'jig-barrel-home-'));
});
afterEach(() => {
  for (const d of [project, home]) rmSync(d, { recursive: true, force: true });
});

const css = () => readFileSync(join(project, 'src', 'styles', 'global.css'), 'utf8');

describe('one import, through a barrel', () => {
  it('wires a single line', async () => {
    setup();
    await run();
    expect(css()).toContain('@import "./jig/theme.css";');
    expect((css().match(/@import "\.\/jig\//g) ?? []).length, 'more than one jig import').toBe(1);
  });

  it('the barrel imports the brand then the mode', async () => {
    setup();
    await run();
    const barrel = readFileSync(join(project, 'src', 'styles', 'jig', 'theme.css'), 'utf8');
    expect(barrel).toMatch(/@import "\.\/brand\.[\w.-]+\.css";/);
    expect(barrel).toContain('@import "./mode.product.css";');
  });

  it('changing the mode rewrites the barrel and NOT the project stylesheet', async () => {
    setup();
    await run();
    const before = css();

    writeFileSync(join(project, 'jig.config.json'), JSON.stringify({
      surfaces: [{ match: '/', mode: 'operator' }],
    }));
    await run();

    expect(css(), 'the user stylesheet was edited for a mode change').toBe(before);
    expect(readFileSync(join(project, 'src', 'styles', 'jig', 'theme.css'), 'utf8'))
      .toContain('mode.operator.css');
  });
});

describe('several surfaces, several barrels', () => {
  const three = JSON.stringify({
    surfaces: [
      { match: '/', mode: 'editorial' },
      { match: '/app/**', mode: 'product' },
      { match: '/admin/**', mode: 'operator' },
    ],
  });

  it('writes one barrel per declared mode', async () => {
    setup();
    writeFileSync(join(project, 'jig.config.json'), three);
    await run();
    const dir = join(project, 'src', 'styles', 'jig');
    expect(existsSync(join(dir, 'theme.css')), 'no primary barrel').toBe(true);
    expect(existsSync(join(dir, 'theme.product.css'))).toBe(true);
    expect(existsSync(join(dir, 'theme.operator.css'))).toBe(true);
  });

  it('each barrel carries the brand and exactly one mode', async () => {
    setup();
    writeFileSync(join(project, 'jig.config.json'), three);
    await run();
    const operator = readFileSync(join(project, 'src', 'styles', 'jig', 'theme.operator.css'), 'utf8');
    expect(operator).toContain('mode.operator.css');
    expect(operator, 'a barrel merged two modes').not.toContain('mode.editorial.css');
    expect(operator).toMatch(/brand\./);
  });

  it('tells the reader which barrel each surface imports', async () => {
    setup();
    writeFileSync(join(project, 'jig.config.json'), three);
    const lines: string[] = [];
    await run((l) => lines.push(l));
    const out = lines.join('\n');
    expect(out).toContain('/app/**');
    expect(out).toContain('theme.product.css');
  });

  it('does not wire the non-primary barrels itself', async () => {
    // Which entry point serves `/admin/**` is the project's routing, which init
    // cannot see. Guessing would edit the wrong file.
    setup();
    writeFileSync(join(project, 'jig.config.json'), three);
    await run();
    expect(css()).toContain('theme.css');
    expect(css()).not.toContain('theme.operator.css');
  });
});

describe('upgrading a two-import wiring', () => {
  it('replaces the old brand+mode pair with the barrel', async () => {
    setup();
    await run();                       // writes the barrel form
    // Simulate the pre-0.6 wiring in the same file.
    const dir = join(project, 'src', 'styles');
    const brand = readFileSync(join(dir, 'jig', 'theme.css'), 'utf8')
      .match(/@import "\.\/(brand\.[\w.-]+\.css)";/)![1];
    writeFileSync(join(dir, 'global.css'),
      `@import "./jig/${brand}";\n@import "./jig/mode.product.css";\nbody{color:#333}\n`);

    await run();

    const after = readFileSync(join(dir, 'global.css'), 'utf8');
    expect(after, 'old brand import survived').not.toContain(`@import "./jig/${brand}";`);
    expect(after).toContain('@import "./jig/theme.css";');
    expect(after, 'body rule was lost').toContain('body{color:#333}');
  });
});
