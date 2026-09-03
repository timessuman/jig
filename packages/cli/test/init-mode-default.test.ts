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
