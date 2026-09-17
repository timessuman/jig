import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../src/commands/init.js';
import { modeWiringProblems } from '../src/check/mode-wiring.js';
import { formatReport } from '../src/check/report.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * A live run: `init --yes`, then the owner's mode — editorial — written into
 * jig.config.json. Every agent then read editorial; the browser read product,
 * because theme.css still imported mode.product.css. Nothing said so.
 */
let project: string;
let pkg: string;
const lines: string[] = [];
const run = () => init({ projectRoot: project, packageRoot: pkg, version: '0.10.0', homeDir: pkg, yes: true, log: (l) => { lines.push(l); } });

beforeEach(() => {
  lines.length = 0;
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  cpSync(join(repoRoot, 'tokens'), join(pkg, 'tokens'), { recursive: true });
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n');
  writeFileSync(join(pkg, 'rules.index.json'), JSON.stringify([]));
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'site' }));
  mkdirSync(join(project, 'src'), { recursive: true });
  writeFileSync(join(project, 'src', 'app.css'), '.a { color: red; }\n');
});

afterEach(() => {
  for (const d of [project, pkg]) rmSync(d, { recursive: true, force: true });
});

function declare(mode: string) {
  const path = join(project, 'jig.config.json');
  const config = JSON.parse(readFileSync(path, 'utf8'));
  config.surfaces = [{ match: '/', mode }];
  writeFileSync(path, JSON.stringify(config));
}

describe('init --yes tells you to run init again once surfaces are declared', () => {
  it('says that adding surfaces by hand is not enough', async () => {
    await run();
    expect(lines.join('\n')).toMatch(/run `?jig init`? again/i);
  });
});

describe('modeWiringProblems', () => {
  it('is quiet straight after init --yes, which declares nothing', async () => {
    await run();
    expect(modeWiringProblems(project)).toEqual([]);
  });

  it('names the mismatch when a mode is declared after init --yes', async () => {
    await run();
    declare('editorial');
    const problems = modeWiringProblems(project);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/declares editorial/);
    expect(problems[0].message).toMatch(/mode\.product\.css/);
  });

  it('is quiet again once init has been re-run', async () => {
    await run();
    declare('editorial');
    await run();
    expect(modeWiringProblems(project)).toEqual([]);
  });

  it('is quiet in a project with no token layer', () => {
    writeFileSync(join(project, 'jig.config.json'), JSON.stringify({ brand: 'jig/brand.x.css', surfaces: [{ match: '/', mode: 'editorial' }] }));
    expect(modeWiringProblems(project)).toEqual([]);
  });
});

describe('check reports an unwired mode', () => {
  it('prints each problem and the command that fixes it', () => {
    const out = formatReport([], {
      totalRules: 1, version: '0.10.0', mode: 'editorial', scanned: 1, withStyles: 1, scope: 'all',
      modeUnwired: [{ mode: 'editorial', barrel: 'jig/theme.css', message: 'jig.config.json declares editorial, but jig/theme.css imports mode.product.css' }],
    });
    expect(out).toMatch(/declares editorial/);
    expect(out).toMatch(/Run 'jig init' again/);
    expect(out).toMatch(/warnings=1/);
  });
});
