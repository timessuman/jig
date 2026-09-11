import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cpSync } from 'node:fs';
import { init } from '../src/commands/init.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * `init --yes` picks a mode, and `01-modes.md` rule 1 then makes that choice
 * authoritative — the config wins over inference, for good reason.
 *
 * So a silent default is not a neutral placeholder; it is a design decision
 * that binds every agent afterwards. Two independent baseline runs on an
 * `ops-console` fixture read every signal in `01-modes.md` as `operator`,
 * found `product` in the config, and correctly deferred to it. One flagged the
 * cost: "the density difference is expensive to reverse".
 *
 * `init` already handles the brand colour exactly right — it states the default
 * and why ("no colour found in the project; using the unbranded default"),
 * which is Tiebreaker 5: ship the plainer thing and surface the question. The
 * mode had no such line, and it is the more consequential of the two.
 */
let project: string;
let pkg: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  // The real token files: `init` validates the brand file's shape, so a stub
  // fails before reaching anything this test is about.
  cpSync(join(repoRoot, 'tokens'), join(pkg, 'tokens'), { recursive: true });
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n');
  writeFileSync(join(pkg, 'rules.index.json'), JSON.stringify([]));
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'ops-console' }));
  mkdirSync(join(project, 'src'), { recursive: true });
  writeFileSync(join(project, 'src', 'app.css'), '.a { color: red; }\n');
});

afterEach(() => {
  for (const d of [project, pkg]) rmSync(d, { recursive: true, force: true });
});

describe('init --yes surfaces the mode it chose', () => {
  it('says which mode it defaulted to, and that it did not infer one', async () => {
    const lines: string[] = [];
    await init({
      projectRoot: project,
      packageRoot: pkg,
      version: '0.4.0',
      homeDir: pkg,
      yes: true,
      log: (l) => { lines.push(l); },
    });

    const output = lines.join('\n');
    // The brand default is already stated; the mode must be too.
    expect(output, 'no line mentions the mode at all').toMatch(/mode/i);
    expect(output).toMatch(/product/);
    // And it must point at how to change it, or the statement is decoration.
    expect(output).toMatch(/jig\.config\.json/);
  });
});

/**
 * The same line, told the truth.
 *
 * With a `jig.config.json` already present, `init --yes` used the surfaces it
 * declared — writing a mode file for each and wiring the first — and then
 * reported `'/' → product — the default, not inferred from this project`,
 * because it logged the variable it had NOT used. The message was a lie in
 * exactly the case where being told the truth matters most: someone who had
 * gone to the trouble of declaring three surfaces was told their config had
 * been ignored.
 */
describe('init reports the surfaces it actually used', () => {
  const threeModes = JSON.stringify({
    brand: '.jig/tokens/brand.acme.css',
    surfaces: [
      { match: '/', mode: 'editorial' },
      { match: '/app/**', mode: 'product' },
      { match: '/admin/**', mode: 'operator' },
    ],
  });

  it('names the modes from an existing config, and does not call them the default', async () => {
    writeFileSync(join(project, 'jig.config.json'), threeModes);
    const lines: string[] = [];
    await init({ projectRoot: project, packageRoot: pkg, version: '0.5.0',
                 homeDir: pkg, yes: true, log: (l) => { lines.push(l); } });

    const out = lines.join('\n');
    expect(out).toMatch(/editorial/);
    expect(out).toMatch(/operator/);
    expect(out, 'still claimed the default while using the config')
      .not.toMatch(/the default, not inferred/);
    expect(out, 'does not say where the surfaces came from').toMatch(/jig\.config\.json/);
  });

  it('still says "default" when there is genuinely no config', async () => {
    const lines: string[] = [];
    await init({ projectRoot: project, packageRoot: pkg, version: '0.5.0',
                 homeDir: pkg, yes: true, log: (l) => { lines.push(l); } });
    expect(lines.join('\n')).toMatch(/default/);
  });
});
