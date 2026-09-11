import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../src/commands/init.js';
import { install } from '../src/commands/install.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * A project installed before 0.6.0 keeps `.jig/tokens/`, deliberately: a silent
 * relocation could break an import the project wrote itself and `init` knows
 * nothing about. The cost is that the improvement only ever reaches new
 * projects, and the way out — set `brand` in `jig.config.json` and re-run — is
 * one line of output that is easy to miss.
 *
 * So `init` offers. Interactively it asks; under `--yes` it declines to move
 * and says how. Consent is the whole mechanism: with it, a broken import is the
 * user's decision to undo; without it, it is a tool's mistake to discover.
 */
let project: string;
let home: string;

const legacy = async () => {
  mkdirSync(join(project, 'src', 'styles'), { recursive: true });
  writeFileSync(join(project, 'src', 'styles', 'global.css'), 'body{color:#333}\n');
  install({ agent: 'claude', scope: 'project', projectRoot: project,
            packageRoot: repoRoot, version: '0.6.0', homeDir: home });
  // Pin the pre-0.6 layout by declaring it, which is what an upgraded project has.
  writeFileSync(join(project, 'jig.config.json'), JSON.stringify({
    brand: '.jig/tokens/brand.legacy.css',
    surfaces: [{ match: '/', mode: 'product' }],
  }));
  await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
               version: '0.6.0', yes: true, log: () => {} });
};

const run = (opts: { yes: boolean; answer?: string; log?: (l: string) => void }) =>
  init({
    projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.6.0',
    yes: opts.yes,
    prompt: async (q: string) =>
      /move|relocate/i.test(q) ? (opts.answer ?? '') : q.includes('Surface') ? '' : '',
    log: opts.log ?? (() => {}),
  });

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-reloc-'));
  home = mkdtempSync(join(tmpdir(), 'jig-reloc-home-'));
});
afterEach(() => {
  for (const d of [project, home]) rmSync(d, { recursive: true, force: true });
});

describe('init offers to move a legacy token layer', () => {
  it('does not move it under --yes, and says how', async () => {
    await legacy();
    const lines: string[] = [];
    await run({ yes: true, log: (l) => lines.push(l) });

    expect(existsSync(join(project, '.jig', 'tokens', 'brand.legacy.css')),
      'moved without being asked').toBe(true);
    expect(lines.join('\n').toLowerCase()).toMatch(/re-run without --yes|jig\.config\.json/);
  });

  it('moves it when asked', async () => {
    await legacy();
    await run({ yes: false, answer: 'y' });

    expect(existsSync(join(project, 'src', 'styles', 'jig', 'brand.legacy.css')),
      'not written at the new location').toBe(true);
    expect(existsSync(join(project, '.jig', 'tokens', 'brand.legacy.css')),
      'the old copy was left behind').toBe(false);
  });

  it('rewires the stylesheet to the new location', async () => {
    await legacy();
    await run({ yes: false, answer: 'y' });
    const css = readFileSync(join(project, 'src', 'styles', 'global.css'), 'utf8');
    expect(css).toContain('@import "./jig/theme.css";');
    expect(css, 'still traversing to the dotfolder').not.toContain('.jig/tokens');
  });

  it('updates the config so the move survives the next run', async () => {
    await legacy();
    await run({ yes: false, answer: 'y' });
    const config = JSON.parse(readFileSync(join(project, 'jig.config.json'), 'utf8'));
    expect(config.brand).toBe('src/styles/jig/brand.legacy.css');
  });

  it('leaves it alone when declined', async () => {
    await legacy();
    await run({ yes: false, answer: 'n' });
    expect(existsSync(join(project, '.jig', 'tokens', 'brand.legacy.css'))).toBe(true);
    expect(existsSync(join(project, 'src', 'styles', 'jig', 'brand.legacy.css'))).toBe(false);
  });

  it('never removes a file the user has edited', async () => {
    await legacy();
    const edited = join(project, '.jig', 'tokens', 'brand.legacy.css');
    writeFileSync(edited, readFileSync(edited, 'utf8') + '\n/* mine */\n');

    const lines: string[] = [];
    await run({ yes: false, answer: 'y', log: (l) => lines.push(l) });

    expect(existsSync(edited), 'an edited file was deleted').toBe(true);
    expect(readFileSync(edited, 'utf8')).toContain('/* mine */');
    expect(lines.join('\n').toLowerCase()).toMatch(/edited|left/);
  });

  it('does not offer when the layout is already where it would go', async () => {
    mkdirSync(join(project, 'src', 'styles'), { recursive: true });
    writeFileSync(join(project, 'src', 'styles', 'global.css'), 'body{color:#333}\n');
    install({ agent: 'claude', scope: 'project', projectRoot: project,
              packageRoot: repoRoot, version: '0.6.0', homeDir: home });
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
                 version: '0.6.0', yes: true, log: () => {} });

    const lines: string[] = [];
    await run({ yes: false, answer: 'y', log: (l) => lines.push(l) });
    expect(lines.join('\n').toLowerCase()).not.toMatch(/move the token layer/);
  });
});
