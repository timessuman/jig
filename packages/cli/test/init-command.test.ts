import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { install } from '../src/commands/install.js';
import { init } from '../src/commands/init.js';
import { readManifest } from '../src/install/manifest.js';
import { deriveBrandColor } from '../src/init/derive.js';
import { validateBrandColor } from '../src/init/validate.js';
import { getAdapter } from '../src/adapters/registry.js';
// `repoRoot` comes from the package location, never `process.cwd()` — a test
// whose result depends on which directory you ran it from is worse than none.
import { repoRoot } from './helpers/registered-commands.js';

const claudeDir = getAdapter('claude').referenceDir('project'); // '.claude/skills/jig'

// The real vendored assets (rules/, tokens/, templates/, rules.index.json)
// live at the repo root. Using them — rather than a synthetic fixture, as
// install.test.ts does — is deliberate here: init's brand-file rendering and
// contrast validation are meaningless against a fake brand.default.css, and
// the whole point of the safety/integration tests is that they exercise the
// real contract.

let project: string;
let home: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-init-proj-'));
  home = mkdtempSync(join(tmpdir(), 'jig-init-home-'));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

const NOOP_LOG = () => {};

function installProject() {
  install({ agent: 'claude', scope: 'project', projectRoot: project, packageRoot: repoRoot, version: '0.1.0', homeDir: home });
}

describe('init — writing', () => {
  beforeEach(() => {
    installProject();
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: '@acme/storefront' }));
    mkdirSync(join(project, 'src'), { recursive: true });
    // A single stylesheet with a named custom property so derivation is
    // deterministic, and a hue nowhere near the violet or red/amber/green
    // bands so it should pass validation cleanly.
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand-color: #0F766E; }\n.button { color: red; }\n');
  });

  it('writes the brand file beside the wired stylesheet, with the derived h/s/l and the vendor header with the derived h/s/l and the vendor header', async () => {
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.brand.action).toBe('written');
    expect(result.brand.relPath).toBe('src/jig/brand.storefront.css');
    const abs = join(project, 'src', 'jig', 'brand.storefront.css');
    expect(existsSync(abs)).toBe(true);
    const content = readFileSync(abs, 'utf8');
    expect(content).toContain('Licensed Apache-2.0');
    expect(content).toContain(`--brand-h: ${Math.round(result.finalColor.h)};`);
    expect(content).toContain(`--brand-s: ${Math.round(result.finalColor.s)}%;`);
    expect(content).toContain(`--brand-l: ${Math.round(result.finalColor.l)}%;`);
    // The contract comment must survive untouched.
    expect(content).toContain('4.5:1 against --color-bg-raised AND against --color-fill');
    expect(content).toContain('E-64');
  });

  it('writes jig.config.json with a forward-slash brand path and the default surface mapping under --yes', async () => {
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.config.action).toBe('written');
    const configPath = join(project, 'jig.config.json');
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(config.brand).toBe('src/jig/brand.storefront.css');
    expect(config.brand).not.toContain('\\');
    expect(config.surfaces).toEqual([{ match: '/', mode: 'product' }]);
  });

  it('records both written files in the init sidecar (.jig/state.json) with forward-slash keys and real checksums', async () => {
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const sidecar = JSON.parse(readFileSync(join(project, '.jig', 'state.json'), 'utf8'));
    expect(sidecar.files['src/jig/brand.storefront.css']).toMatch(/^sha256:/);
    expect(sidecar.files['jig.config.json']).toMatch(/^sha256:/);
    for (const key of Object.keys(sidecar.files)) expect(key).not.toContain('\\');
  });

  it('does not touch the real skill/reference-bundle manifest', async () => {
    const before = readManifest(project, claudeDir)!;
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const after = readManifest(project, claudeDir)!;
    expect(after.files).toEqual(before.files);
  });

  it('wires the @import into the single unambiguous stylesheet, and the generated path resolves to the real brand file', async () => {
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.wiring.target).toBe('src/app.css');
    expect(result.wiring.status).toBe('wired');
    // One line now: the project imports a barrel Jig owns. What still has to
    // hold is that the whole chain resolves to real files — the barrel from the
    // stylesheet, and the brand and mode from the barrel.
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    const barrelMatch = /@import "([^"]+theme\.css)";/.exec(cssContent);
    expect(barrelMatch).not.toBeNull();

    const barrelAbs = resolve(dirname(join(project, 'src', 'app.css')), barrelMatch![1]);
    expect(barrelAbs).toBe(join(project, 'src', 'jig', 'theme.css'));
    expect(existsSync(barrelAbs)).toBe(true);

    const barrel = readFileSync(barrelAbs, 'utf8');
    for (const [re, expected] of [
      [/@import "([^"]+brand\.storefront\.css)";/, join(project, 'src', 'jig', 'brand.storefront.css')],
      [/@import "([^"]+mode\.product\.css)";/, join(project, 'src', 'jig', 'mode.product.css')],
    ] as const) {
      const m = re.exec(barrel);
      expect(m, `barrel is missing ${expected}`).not.toBeNull();
      const abs = resolve(dirname(barrelAbs), m![1]);
      expect(abs).toBe(expected);
      expect(existsSync(abs)).toBe(true);
    }
  });

  it('does not duplicate the import on a second run', async () => {
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const once = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(result.wiring.status).toBe('already-present');
    expect(readFileSync(join(project, 'src', 'app.css'), 'utf8')).toBe(once);
  });

  it('prints the import for the user rather than guessing when there are multiple stylesheets', async () => {
    writeFileSync(join(project, 'src', 'other.css'), '.x { color: blue; }\n');
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.wiring.target).toBeNull();
    expect(result.wiring.status).toBe('print-only');
    // ONE import, the barrel — the same thing the wiring path writes when it
    // can find a target. Printing the brand and mode files separately told
    // anyone without a wirable stylesheet to set their project up differently
    // from everyone else, and cost them the barrel's whole point: relocating
    // the token layer later changes one line rather than every stylesheet.
    const lines = result.wiring.snippet.split('\n').filter((l) => l.includes('@import'));
    expect(lines).toHaveLength(1);
    const m = /@import "([^"]+)"/.exec(lines[0])!;
    expect(resolve(project, m[1])).toBe(join(project, 'src', 'jig', 'theme.css'));

    // Neither stylesheet was silently edited.
    expect(readFileSync(join(project, 'src', 'app.css'), 'utf8')).not.toContain('@import');
    expect(readFileSync(join(project, 'src', 'other.css'), 'utf8')).not.toContain('@import');
  });

  it('runs a baseline check and reports a finding count', async () => {
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(typeof result.baseline.findingsCount).toBe('number');
    expect(result.baseline.report).toMatch(/\d+ rules(?: \(\+ \d+ pattern and mode specs\))?/);
  });

  it('falls back to the directory name for the brand slug when there is no package.json', async () => {
    rmSync(join(project, 'package.json'));
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const base = project.split('/').pop()!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    expect(result.brand.relPath).toBe(`src/jig/brand.${base}.css`);
  });

  // M4: the DEFAULT_PROPOSAL fallback (no colour found anywhere) is exactly
  // brand.default.css's own --brand-h/-s/-l (264 / 0% / 15%) — a legitimate
  // no-op substitution that must not be mistaken by the M4 "did this regex
  // actually match" guard for the pattern never having matched at all.
  it('M4: writing the unbranded-default fallback (a no-op substitution) does not throw', async () => {
    rmSync(join(project, 'src', 'app.css'));
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(result.proposal.source).toBe('default');
    const content = readFileSync(join(project, ...result.brand.relPath.split('/')), 'utf8');
    expect(content).toContain('--brand-h: 264;');
    expect(content).toContain('--brand-s: 0%;');
    expect(content).toContain('--brand-l: 15%;');
  });

  // C1: a Tailwind config with a neutral-only palette (no chromatic colour,
  // no brand/primary/accent name) used to crash `mostFrequent` with a bare
  // TypeError. This exercises the exact shape of that repro end-to-end.
  it('C1: does not crash on a Tailwind v3 config with a neutral-only palette', async () => {
    rmSync(join(project, 'src', 'app.css'));
    writeFileSync(
      join(project, 'tailwind.config.js'),
      "module.exports = { theme: { extend: { colors: { surface: '#f8f8f8', ink: '#111111' } } } };\n",
    );
    await expect(
      init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG }),
    ).resolves.toBeDefined();
  });

  // I1: `--yes` used to write `proposal` verbatim even when it failed the
  // 4.5:1 contrast the generated file itself states, discarding the passing
  // `nearestPassingLightness` it had already computed.
  it('I1: --yes never writes a colour that fails the 4.5:1 contract stated in the file it writes', async () => {
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand: #ffe600; }\n');
    const proposal = deriveBrandColor(project, ['src/app.css'], undefined);
    const rawValidation = validateBrandColor(proposal.h, proposal.s, proposal.l);
    // Sanity: this repro really is a failing colour with a passing alternative.
    expect(rawValidation.passesContrast).toBe(false);
    expect(rawValidation.nearestPassingLightness).toBeDefined();

    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.validation.passesContrast).toBe(true);
    expect(result.finalColor.l).toBe(rawValidation.nearestPassingLightness);
    const content = readFileSync(join(project, ...result.brand.relPath.split('/')), 'utf8');
    expect(content).toContain(`--brand-l: ${Math.round(result.finalColor.l)}%;`);
    expect(content).not.toContain(`--brand-l: ${Math.round(proposal.l)}%;`);
  });

  // I2: an existing config that init correctly leaves alone (untracked, so
  // "kept") must drive wiring — otherwise the stylesheet ends up importing a
  // brand file and mode the config doesn't name, a three-way contradiction
  // reported as success.
  it('I2: an existing (untracked) config drives wiring — its brand path and mode win over fresh derivation', async () => {
    mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
    writeFileSync(
      join(project, '.jig', 'tokens', 'brand.custom.css'),
      ':root { --brand-h: 10; --brand-s: 50%; --brand-l: 40%; }\n',
    );
    writeFileSync(
      join(project, 'jig.config.json'),
      JSON.stringify({ brand: '.jig/tokens/brand.custom.css', surfaces: [{ match: '/', mode: 'editorial' }] }, null, 2),
    );

    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.config.action).toBe('skipped-untracked');
    expect(result.surfaces).toEqual([{ match: '/', mode: 'editorial' }]);
    // The stylesheet imports the barrel; the barrel carries what the config
    // named. Assert through it rather than against the stylesheet, which by
    // design no longer mentions a brand or a mode at all.
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    const barrelPath = /@import "([^"]+theme\.css)";/.exec(cssContent)![1];
    const barrel = readFileSync(
      resolve(dirname(join(project, 'src', 'app.css')), barrelPath), 'utf8');
    expect(barrel).toContain('brand.custom.css');
    expect(barrel).toContain('mode.editorial.css');
    expect(barrel).not.toContain('mode.product.css');
    expect(barrel).not.toContain('brand.storefront.css');
  });

  // C2: changing the config's mode (here: a hand-edit after the first run)
  // used to leave `wireImport` reporting `already-present` forever, because
  // only the brand import was ever checked.
  it('C2: changing the config mode on a later run rewrites the barrel, leaving the stylesheet alone', async () => {
    const first = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(first.wiring.status).toBe('wired');

    const configPath = join(project, 'jig.config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.surfaces = [{ match: '/', mode: 'editorial' }];
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const second = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(second.config.action).toBe('skipped-edited');
    // The stylesheet already imports the barrel and does not change — that is
    // the reason the barrel exists. What changes is Jig's own file.
    expect(second.wiring.status).toBe('already-present');
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    expect(cssContent, 'the user stylesheet was edited for a mode change')
      .toContain('@import "./jig/theme.css";');
    expect(cssContent).not.toContain('mode.');

    const barrel = readFileSync(join(project, 'src', 'jig', 'theme.css'), 'utf8');
    expect(barrel).toContain('mode.editorial.css');
    expect(barrel).not.toContain('mode.product.css');
    // The brand import inside the barrel was left alone — exactly once.
    expect(barrel.match(/@import "[^"]*brand\.storefront\.css"/g) ?? []).toHaveLength(1);
  });

  // I4: a CSS Module is scoped to one component by its own build tooling —
  // wiring `:root`-level tokens into it as "the" global stylesheet is wrong
  // even when it's the only stylesheet in the project.
  it('I4: a single *.module.css stylesheet is excluded from auto-wiring (falls back to print-only)', async () => {
    rmSync(join(project, 'src', 'app.css'));
    writeFileSync(join(project, 'src', 'styles.module.css'), ':root { --x: 1; }\n');

    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.wiring.target).toBeNull();
    expect(result.wiring.status).toBe('print-only');
    expect(readFileSync(join(project, 'src', 'styles.module.css'), 'utf8')).not.toContain('@import');
  });

  // I3: `@charset` is only honoured at byte 0 of a stylesheet — displaced
  // even by a blank line it is silently ignored, changing decoding for a
  // file that declares a non-UTF-8 encoding. The import must be inserted
  // after it, never before.
  it('I3: a leading @charset stays at byte 0 after wiring', async () => {
    writeFileSync(join(project, 'src', 'app.css'), '@charset "UTF-8";\n:root { --brand-color: #0F766E; }\n');
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.wiring.status).toBe('wired');
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    expect(cssContent.startsWith('@charset "UTF-8";')).toBe(true);
  });

  // I8: a read-only stylesheet used to abort the whole run with a raw
  // EACCES, after the brand file and config had already been written and
  // before the baseline check ever ran.
  it('I8: an unwritable stylesheet falls back to print-only and the baseline still runs', async () => {
    const cssPath = join(project, 'src', 'app.css');
    chmodSync(cssPath, 0o444);
    try {
      const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
      expect(result.wiring.status).toBe('print-only');
      expect(result.wiring.target).toBeNull();
      expect(result.brand.action).toBe('written');
      expect(result.config.action).toBe('written');
      expect(typeof result.baseline.findingsCount).toBe('number');
      expect(result.baseline.report.length).toBeGreaterThan(0);
    } finally {
      chmodSync(cssPath, 0o644);
    }
  });
});

describe('init — safety (never silently clobbers)', () => {
  beforeEach(() => {
    installProject();
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand-color: #0F766E; }\n');
  });

  it('is a clean no-op on jig.config.json when it exists but was not created by init, even under --yes', async () => {
    writeFileSync(join(project, 'jig.config.json'), JSON.stringify({ brand: 'hand-written.css', surfaces: [] }, null, 2));
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.config.action).toBe('skipped-untracked');
    const config = JSON.parse(readFileSync(join(project, 'jig.config.json'), 'utf8'));
    expect(config.brand).toBe('hand-written.css');
  });

  it('is a clean no-op on the brand file when it exists but was not created by init, even under --yes', async () => {
    mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
    writeFileSync(join(project, '.jig', 'tokens', 'brand.myproj.css'), ':root { --brand-h: 999; }\n');
    // Force the same slug so the collision is real: no package.json means the
    // slug comes from the directory name, so pin it via package.json instead.
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'myproj' }));

    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.brand.action).toBe('skipped-untracked');
    expect(readFileSync(join(project, '.jig', 'tokens', 'brand.myproj.css'), 'utf8')).toContain('--brand-h: 999');
  });

  it('does not clobber a jig-written config the user has since hand-edited', async () => {
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const configPath = join(project, 'jig.config.json');
    const edited = JSON.stringify({ brand: '.jig/tokens/brand.custom.css', surfaces: [{ match: '/admin/**', mode: 'operator' }] }, null, 2) + '\n';
    writeFileSync(configPath, edited);

    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.config.action).toBe('skipped-edited');
    expect(readFileSync(configPath, 'utf8')).toBe(edited);
  });

  it('does not clobber a jig-written brand file the user has since hand-edited', async () => {
    const first = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const brandPath = join(project, ...first.brand.relPath.split('/'));
    const edited = `${readFileSync(brandPath, 'utf8')}\n:root { --my-own-var: 1; }\n`;
    writeFileSync(brandPath, edited);

    const second = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(second.brand.action).toBe('skipped-edited');
    expect(readFileSync(brandPath, 'utf8')).toBe(edited);
  });

  it('refreshes an untouched jig-written config on a second run (safe re-run)', async () => {
    const first = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(first.config.action).toBe('written');
    const afterFirst = readFileSync(join(project, 'jig.config.json'), 'utf8');

    const second = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(second.config.action).toBe('written');
    // Untouched input, so the "refresh" reproduces byte-identical content —
    // this is what makes a re-run of an unedited file safe rather than just
    // silent.
    expect(readFileSync(join(project, 'jig.config.json'), 'utf8')).toBe(afterFirst);
  });

  it('--yes never blocks on input: resolves without a prompt function being supplied', async () => {
    await expect(
      init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG }),
    ).resolves.toBeDefined();
  });

  // Since 0.4.0, `init` no longer requires a prior `jig install` — nothing
  // it writes (the brand file, the mode-file copies, the baseline check)
  // depends on an install being present; the mode files it copies come
  // straight from `packageRoot`.
  it('runs successfully with no prior jig install', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'jig-init-bare-'));
    try {
      const result = await init({
        projectRoot: bare, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG,
      });
      expect(result.brand.action).toBe('written');
      expect(existsSync(join(bare, 'jig.config.json'))).toBe(true);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe('init — interactive prompts (injected, no real stdin)', () => {
  beforeEach(() => {
    installProject();
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand-color: #0F766E; }\n');
  });

  it('asks exactly two questions when not --yes: confirm colour, then surface mapping', async () => {
    const questions: string[] = [];
    const prompt = async (q: string) => {
      questions.push(q);
      return '';
    };
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: false, prompt, log: NOOP_LOG });
    expect(questions).toHaveLength(2);
  });

  it('accepts a user-provided hex override for the brand colour', async () => {
    let call = 0;
    const prompt = async (q: string) => {
      call += 1;
      if (call === 1) return '#1D4ED8'; // override, accepted next loop with enter
      if (call === 2) return '';
      return '';
    };
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: false, prompt, log: NOOP_LOG });
    expect(result.proposal.detail).toContain('#1D4ED8');
  });

  it('parses a custom surface mapping answer', async () => {
    let call = 0;
    const prompt = async () => {
      call += 1;
      if (call === 1) return 'y';
      return '/:editorial,/app/**:product,/admin/**:operator';
    };
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: false, prompt, log: NOOP_LOG });
    expect(result.surfaces).toEqual([
      { match: '/', mode: 'editorial' },
      { match: '/app/**', mode: 'product' },
      { match: '/admin/**', mode: 'operator' },
    ]);
  });

  // M8: a typo'd mode name in the surface answer used to fall back to the
  // default surface mapping with no indication anything went wrong.
  it('M8: logs a warning when the surface mapping answer cannot be parsed, instead of failing silently', async () => {
    const lines: string[] = [];
    let call = 0;
    const prompt = async () => {
      call += 1;
      if (call === 1) return 'y';
      return '/:editoral'; // typo — not a valid mode
    };
    const result = await init({
      projectRoot: project,
      packageRoot: repoRoot,
      homeDir: home,
      version: '0.1.0',
      yes: false,
      prompt,
      log: (l) => lines.push(l),
    });
    expect(result.surfaces).toEqual([{ match: '/', mode: 'product' }]);
    expect(lines.some((l) => l.includes('Could not parse') && l.includes('editoral'))).toBe(true);
  });

  it('offers refresh/keep on an untracked existing config and honors "keep"', async () => {
    writeFileSync(join(project, 'jig.config.json'), JSON.stringify({ brand: 'x.css', surfaces: [] }));
    const prompt = async (q: string) => (q.includes('[k]eep') ? 'k' : '');
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: false, prompt, log: NOOP_LOG });
    expect(result.config.action).toBe('kept');
    const config = JSON.parse(readFileSync(join(project, 'jig.config.json'), 'utf8'));
    expect(config.brand).toBe('x.css');
  });
});

describe('init — global scope', () => {
  it('writes the brand file and config into the project even when the rules install is global, and the mode import resolves into the project (C3)', async () => {
    install({ agent: 'claude', scope: 'global', projectRoot: project, packageRoot: repoRoot, version: '0.1.0', homeDir: home });
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand-color: #0F766E; }\n');
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'globalapp' }));

    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(existsSync(join(project, 'src', 'jig', 'brand.globalapp.css'))).toBe(true);
    expect(existsSync(join(project, 'jig.config.json'))).toBe(true);
    // The real skill/reference-bundle manifest lives beside the skill file
    // under $HOME, untouched by init's own writes.
    expect(existsSync(join(home, claudeDir, 'manifest.json'))).toBe(true);
    // init's sidecar lives in the project, and must never collide with a
    // real reference-bundle manifest.json there (which would corrupt scope
    // detection).
    expect(existsSync(join(project, claudeDir, 'manifest.json'))).toBe(false);
    expect(existsSync(join(project, '.jig', 'state.json'))).toBe(true);

    expect(result.wiring.status).toBe('wired');
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    const barrelAbs = resolve(
      dirname(join(project, 'src', 'app.css')),
      /@import "([^"]+theme\.css)";/.exec(cssContent)![1],
    );
    const modeMatch = /@import "([^"]+mode\.product\.css)";/.exec(readFileSync(barrelAbs, 'utf8'))!;
    // C3: a global install's mode file is copied into the *project's own*
    // .jig/tokens/, and the @import is project-relative — never pointing at
    // $HOME, which would resolve only on the machine that ran `init`.
    // The mode import now lives inside the barrel, so resolve through it. The
    // property being guarded is unchanged and is the point of C3: the path is
    // project-relative and never reaches into $HOME, which would resolve only
    // on the machine that ran `init`.
    const resolved = resolve(dirname(barrelAbs), modeMatch[1]);
    expect(resolved).toBe(join(project, 'src', 'jig', 'mode.product.css'));
    expect(existsSync(resolved)).toBe(true);
    expect(resolved.startsWith(home)).toBe(false);

    // The copy is tracked in the init sidecar manifest, so a later `jig
    // update` can refresh it (see the companion fix in commands/update.ts).
    const sidecar = JSON.parse(readFileSync(join(project, '.jig', 'state.json'), 'utf8'));
    expect(sidecar.files['src/jig/mode.product.css']).toMatch(/^sha256:/);
  });

  it('does not clobber a hand-edited copy of the mode file on a second run', async () => {
    install({ agent: 'claude', scope: 'global', projectRoot: project, packageRoot: repoRoot, version: '0.1.0', homeDir: home });
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand-color: #0F766E; }\n');

    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const modePath = join(project, 'src', 'jig', 'mode.product.css');
    const edited = `${readFileSync(modePath, 'utf8')}\n:root { --my-own-var: 1; }\n`;
    writeFileSync(modePath, edited);

    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(readFileSync(modePath, 'utf8')).toBe(edited);
  });
});

/** Every file `init` actually put on disk under `.jig/` plus `jig.config.json`
 *  at the project root — walked fresh each time rather than hardcoded, so
 *  this fails loudly if a future change adds an unexpected file. */
/** What `init` recorded writing, from the sidecar itself.
 *
 *  This used to walk `.jig/` on the assumption that everything init wrote lived
 *  there. Once the token layer follows the project's own layout that is no
 *  longer true, and a walk of a fixed directory would silently find fewer files
 *  and pass — the file-count guard reporting a smaller number than it was
 *  written to catch. The sidecar is the authoritative list and does not move. */
function initWrittenFiles(root: string): string[] {
  const statePath = join(root, '.jig', 'state.json');
  if (!existsSync(statePath)) return [];
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as { files: Record<string, string> };
  return [...Object.keys(state.files), '.jig/state.json'].sort();
}

// --- Target: 3 files for a single-mode project (brand.css, <mode>.css,
// jig.config.json) — state.json is bookkeeping, not one of "your files". ---
describe('init — file count (target: 4 files for a single-mode project)', () => {
  beforeEach(() => {
    installProject();
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: '@acme/storefront' }));
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand-color: #0F766E; }\n');
  });

  it('writes exactly 4 project-facing files: brand, one mode, the barrel, and jig.config.json', async () => {
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    const files = initWrittenFiles(project);
    const withoutState = files.filter((f) => f !== '.jig/state.json');
    expect(withoutState.sort()).toEqual(
      ['src/jig/brand.storefront.css', 'src/jig/mode.product.css',
       'src/jig/theme.css', 'jig.config.json'].sort(),
    );
    expect(withoutState).toHaveLength(4);
    // state.json exists too (it has to — it's what makes a safe re-run and
    // `update`'s refresh possible) but is bookkeeping, not a project file.
    expect(files).toContain('.jig/state.json');
  });

  it('copies only the mode(s) actually declared in jig.config.json — not all three', async () => {
    const prompt = async (q: string) => {
      if (q.includes('Surface')) return '/:editorial,/admin/**:operator';
      return '';
    };
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: false, prompt, log: NOOP_LOG });

    expect(existsSync(join(project, 'src', 'jig', 'mode.editorial.css'))).toBe(true);
    expect(existsSync(join(project, 'src', 'jig', 'mode.operator.css'))).toBe(true);
    // 'product' was never declared — must not be copied.
    expect(existsSync(join(project, 'src', 'jig', 'mode.product.css'))).toBe(false);

    const sidecar = JSON.parse(readFileSync(join(project, '.jig', 'state.json'), 'utf8'));
    expect(sidecar.modes.sort()).toEqual(['editorial', 'operator']);
  });
});

/**
 * `jig.config.json` declares where the brand file lives, and `init` ignored it
 * for placement — it honoured the path only when the file ALREADY existed,
 * which is the one case where the declaration does not matter. So the config
 * could name a location but never create one, and every project got
 * `.jig/tokens/` whatever it asked for.
 *
 * The existing guard is still right for WIRING: an import must not point at a
 * file that is not there. But writing the file is how it gets there.
 */
describe('config.brand decides where the brand file is written', () => {
  it('writes the brand file where the config says, creating the directory', async () => {
    mkdirSync(join(project, 'app', 'assets', 'stylesheets'), { recursive: true });
    writeFileSync(join(project, 'app', 'assets', 'stylesheets', 'application.css'), 'body{color:#333}\n');
    writeFileSync(join(project, 'jig.config.json'), JSON.stringify({
      brand: 'app/assets/stylesheets/jig/brand.acme.css',
      surfaces: [{ match: '/', mode: 'product' }],
    }));

    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
                 version: '0.5.0', yes: true, log: () => {} });

    expect(existsSync(join(project, 'app/assets/stylesheets/jig/brand.acme.css')),
      'brand file not written where the config asked').toBe(true);
  });

  it('puts the mode files beside the brand file, not somewhere else', async () => {
    mkdirSync(join(project, 'styles'), { recursive: true });
    writeFileSync(join(project, 'styles', 'global.css'), 'body{color:#333}\n');
    writeFileSync(join(project, 'jig.config.json'), JSON.stringify({
      brand: 'styles/jig/brand.acme.css',
      surfaces: [{ match: '/', mode: 'operator' }],
    }));

    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
                 version: '0.5.0', yes: true, log: () => {} });

    expect(existsSync(join(project, 'styles/jig/mode.operator.css')),
      'mode file did not follow the brand file').toBe(true);
  });

  it('wires the import to the configured location', async () => {
    mkdirSync(join(project, 'styles'), { recursive: true });
    writeFileSync(join(project, 'styles', 'global.css'), 'body{color:#333}\n');
    writeFileSync(join(project, 'jig.config.json'), JSON.stringify({
      brand: 'styles/jig/brand.acme.css',
      surfaces: [{ match: '/', mode: 'product' }],
    }));

    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
                 version: '0.5.0', yes: true, log: () => {} });

    const css = readFileSync(join(project, 'styles', 'global.css'), 'utf8');
    expect(css).toContain('@import "./jig/theme.css";');
    expect(css, 'still climbing out to the dotfolder').not.toContain('.jig/tokens');
    expect(readFileSync(join(project, 'styles', 'jig', 'theme.css'), 'utf8'))
      .toContain('@import "./brand.acme.css";');
  });

  it('falls back to the derived default when the config says nothing', async () => {
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
                 version: '0.5.0', yes: true, log: () => {} });
    // No stylesheet in this fixture, so there is nothing to sit beside.
    expect(existsSync(join(project, 'jig'))).toBe(true);
  });

  it('refuses a path that escapes the project', async () => {
    writeFileSync(join(project, 'jig.config.json'), JSON.stringify({
      brand: '../outside/brand.acme.css',
      surfaces: [{ match: '/', mode: 'product' }],
    }));
    const lines: string[] = [];
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
                 version: '0.5.0', yes: true, log: (l) => lines.push(l) });

    expect(existsSync(join(project, '..', 'outside')), 'wrote outside the project').toBe(false);
    expect(lines.join('\n').toLowerCase()).toMatch(/outside|ignor|refus/);
  });
});

/**
 * Where the token layer goes when the config does not say.
 *
 * `.jig/tokens/` was a location that is right everywhere by being right
 * nowhere: it is a tool dotdir holding product source, and from a stylesheet of
 * any depth the import climbed out of the tree to reach it —
 * `@import "../../../.jig/tokens/brand.acme.css"` in a Rails app.
 *
 * The default is now DERIVED from the project's own layout: a `jig/` directory
 * beside the stylesheet `init` is about to wire. That makes the import
 * `./jig/brand.acme.css` in every ecosystem, including ones nobody thought
 * about while writing this, which is the actual test of framework-agnostic.
 * `jig/` rather than `tokens/` so it cannot collide with a `tokens/` the
 * project already has.
 */
describe('default token location follows the project', () => {
  const initHere = (log: (l: string) => void = () => {}) =>
    init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
           version: '0.6.0', yes: true, log });

  it('lands beside the stylesheet it wires — Rails shape', async () => {
    mkdirSync(join(project, 'app', 'assets', 'stylesheets'), { recursive: true });
    writeFileSync(join(project, 'app/assets/stylesheets/application.css'), 'body{color:#333}\n');
    await initHere();
    expect(existsSync(join(project, 'app/assets/stylesheets/jig')), 'not beside the stylesheet').toBe(true);
    expect(readFileSync(join(project, 'app/assets/stylesheets/application.css'), 'utf8'))
      .toContain('@import "./jig/');
  });

  it('lands beside the stylesheet it wires — src/styles shape', async () => {
    mkdirSync(join(project, 'src', 'styles'), { recursive: true });
    writeFileSync(join(project, 'src/styles/global.css'), 'body{color:#333}\n');
    await initHere();
    expect(existsSync(join(project, 'src/styles/jig'))).toBe(true);
  });

  it('never climbs out of the tree to reach the tokens', async () => {
    mkdirSync(join(project, 'a', 'b', 'c'), { recursive: true });
    writeFileSync(join(project, 'a/b/c/main.css'), 'body{color:#333}\n');
    await initHere();
    expect(readFileSync(join(project, 'a/b/c/main.css'), 'utf8'),
      'the import traverses upward').not.toContain('../');
  });

  it('falls back to a root jig/ when there is no stylesheet to follow', async () => {
    await initHere();
    expect(existsSync(join(project, 'jig')), 'no token directory at all').toBe(true);
    expect(existsSync(join(project, '.jig', 'tokens')), 'still using the dotdir').toBe(false);
  });

  it('states where it put them', async () => {
    mkdirSync(join(project, 'src', 'styles'), { recursive: true });
    writeFileSync(join(project, 'src/styles/global.css'), 'body{color:#333}\n');
    const lines: string[] = [];
    await initHere((l) => lines.push(l));
    expect(lines.join('\n')).toMatch(/src\/styles\/jig/);
  });

  it('keeps an existing .jig/tokens layout where it is, and says how to move it', async () => {
    // Never relocate files on an upgrade: a project may import them from
    // somewhere init did not write, and a silent move breaks that build.
    mkdirSync(join(project, 'src', 'styles'), { recursive: true });
    writeFileSync(join(project, 'src/styles/global.css'), 'body{color:#333}\n');
    await initHere();                                  // new layout
    rmSync(join(project, 'src/styles/jig'), { recursive: true, force: true });
    mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });

    // Simulate a pre-0.6 install: state.json recording files under .jig/tokens/.
    const statePath = join(project, '.jig', 'state.json');
    writeFileSync(statePath, JSON.stringify({
      version: '0.5.0', modes: ['product'],
      files: { '.jig/tokens/brand.legacy.css': 'sha256:x' },
    }));
    writeFileSync(join(project, '.jig/tokens/brand.legacy.css'), ':root{}\n');

    const lines: string[] = [];
    await initHere((l) => lines.push(l));
    expect(existsSync(join(project, '.jig/tokens/brand.legacy.css')), 'legacy file removed').toBe(true);
    expect(lines.join('\n').toLowerCase()).toMatch(/jig\.config\.json/);
  });
});

/**
 * `jig init` without `--yes` needs a terminal to ask its questions. Given
 * anything else — a pipe, a CI step, an agent shelling out without a TTY — it
 * printed the first prompt, read EOF, and exited 0 having written nothing.
 *
 * Verified against published 0.5.0, so this predates the prompts added since.
 * A silent no-op that exits 0 is the worst available outcome: the caller cannot
 * tell it from success, and the next thing they do is act on a token layer that
 * was never created.
 */
describe('init refuses to pretend it asked', () => {
  it('fails loudly rather than doing nothing when there is no terminal', async () => {
    // vitest runs with a non-TTY stdin, which is exactly the case in question.
    await expect(
      init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
             version: '0.6.0', yes: false, log: NOOP_LOG }),
    ).rejects.toThrow(/--yes|terminal|tty/i);
  });

  it('says what to do instead', async () => {
    await expect(
      init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
             version: '0.6.0', yes: false, log: NOOP_LOG }),
    ).rejects.toThrow(/--yes/);
  });

  it('is unaffected when a prompt is supplied', async () => {
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
                                version: '0.6.0', yes: false, prompt: async () => '',
                                log: NOOP_LOG });
    expect(result.brand.action).toBe('written');
  });
});

/**
 * The refusal when there is no terminal and no `--yes`.
 *
 * Nothing covered this path, and the message it printed was wrong about the
 * tool's own behaviour: it ended "(To choose the mode without a terminal,
 * write jig.config.json first — init honours it.)" The guard runs BEFORE any
 * config is read, so a config alone changes nothing — the sentence was true
 * about mode selection and false where it appeared, reading as a third way out
 * when it is a modifier on the first. A cold agent followed it literally, hit
 * the identical error, and allocated a pseudo-terminal with Python's `pty` to
 * get past it.
 */
describe('init without a terminal', () => {
  const withoutTTY = async (fn: () => Promise<unknown>) => {
    const saved = process.stdin.isTTY;
    // Set explicitly rather than trusting the runner: a test whose result
    // depends on how vitest was launched asserts nothing reliable.
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    try { return await fn(); }
    finally { Object.defineProperty(process.stdin, 'isTTY', { value: saved, configurable: true }); }
  };

  const run = (over: Record<string, unknown> = {}) =>
    init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
           version: '0.8.1', log: NOOP_LOG, ...over } as never);

  const config = (mode: string) =>
    writeFileSync(join(project, 'jig.config.json'),
                  JSON.stringify({ surfaces: [{ match: '/', mode }] }));

  it('refuses, and does not offer a config as a way out', async () => {
    const err = await withoutTTY(() => run({ yes: false }).then(() => null, (e: Error) => e));
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toContain('--yes');
    // The specific false promise, in the wording that shipped.
    expect(msg).not.toMatch(/choose the mode without a terminal/i);
    expect(msg).not.toMatch(/write jig\.config\.json first/i);
  });

  it('still refuses when a config IS present — the guard runs before it is read', async () => {
    config('operator');
    const err = await withoutTTY(() => run({ yes: false }).then(() => null, (e: Error) => e));
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('does not replace --yes');
  });

  it('succeeds with --yes, and takes the mode from the config', async () => {
    config('operator');
    const result = await withoutTTY(() => run({ yes: true })) as { surfaces: { mode: string }[] };
    expect(result.surfaces.length).toBeGreaterThan(0);
    expect(result.surfaces.map((s) => s.mode)).toContain('operator');
  });
});
