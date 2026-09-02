import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { install } from '../src/commands/install.js';
import { init } from '../src/commands/init.js';
import { readManifest } from '../src/install/manifest.js';
import { deriveBrandColor } from '../src/init/derive.js';
import { validateBrandColor } from '../src/init/validate.js';

// The real vendored assets (rules/, tokens/, templates/, rules.index.json)
// live at the repo root. Using them — rather than a synthetic fixture, as
// install.test.ts does — is deliberate here: init's brand-file rendering and
// contrast validation are meaningless against a fake brand.default.css, and
// the whole point of the safety/integration tests is that they exercise the
// real contract.
const repoRoot = join(process.cwd(), '..', '..');

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

  it('writes the brand file at .jig/tokens/brand.<project>.css with the derived h/s/l and the vendor header', async () => {
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.brand.action).toBe('written');
    expect(result.brand.relPath).toBe('.jig/tokens/brand.storefront.css');
    const abs = join(project, '.jig', 'tokens', 'brand.storefront.css');
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
    expect(config.brand).toBe('.jig/tokens/brand.storefront.css');
    expect(config.brand).not.toContain('\\');
    expect(config.surfaces).toEqual([{ match: '/', mode: 'product' }]);
  });

  it('records both written files in the init sidecar manifest with forward-slash keys and real checksums', async () => {
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const sidecar = JSON.parse(readFileSync(join(project, '.jig', 'init-manifest.json'), 'utf8'));
    expect(sidecar.files['.jig/tokens/brand.storefront.css']).toMatch(/^sha256:/);
    expect(sidecar.files['jig.config.json']).toMatch(/^sha256:/);
    for (const key of Object.keys(sidecar.files)) expect(key).not.toContain('\\');
  });

  it('does not touch the real install manifest', async () => {
    const before = readManifest(project)!;
    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const after = readManifest(project)!;
    expect(after.files).toEqual(before.files);
  });

  it('wires the @import into the single unambiguous stylesheet, and the generated path resolves to the real brand file', async () => {
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(result.wiring.target).toBe('src/app.css');
    expect(result.wiring.status).toBe('wired');
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    const importMatch = /@import "([^"]+brand\.storefront\.css)";/.exec(cssContent);
    expect(importMatch).not.toBeNull();

    const resolved = resolve(dirname(join(project, 'src', 'app.css')), importMatch![1]);
    expect(resolved).toBe(join(project, '.jig', 'tokens', 'brand.storefront.css'));
    expect(existsSync(resolved)).toBe(true);

    const modeMatch = /@import "([^"]+mode\.product\.css)";/.exec(cssContent);
    expect(modeMatch).not.toBeNull();
    const modeResolved = resolve(dirname(join(project, 'src', 'app.css')), modeMatch![1]);
    expect(modeResolved).toBe(join(project, '.jig', 'tokens', 'mode.product.css'));
    expect(existsSync(modeResolved)).toBe(true);
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
    const brandLine = result.wiring.snippet.split('\n').find((l) => l.includes('brand.storefront.css'))!;
    const m = /@import "([^"]+)"/.exec(brandLine)!;
    const resolved = resolve(project, m[1]);
    expect(resolved).toBe(join(project, '.jig', 'tokens', 'brand.storefront.css'));

    // Neither stylesheet was silently edited.
    expect(readFileSync(join(project, 'src', 'app.css'), 'utf8')).not.toContain('@import');
    expect(readFileSync(join(project, 'src', 'other.css'), 'utf8')).not.toContain('@import');
  });

  it('runs a baseline check and reports a finding count', async () => {
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(typeof result.baseline.findingsCount).toBe('number');
    expect(result.baseline.report).toContain('rules,');
  });

  it('falls back to the directory name for the brand slug when there is no package.json', async () => {
    rmSync(join(project, 'package.json'));
    const result = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const base = project.split('/').pop()!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    expect(result.brand.relPath).toBe(`.jig/tokens/brand.${base}.css`);
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
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    expect(cssContent).toContain('brand.custom.css');
    expect(cssContent).toContain('mode.editorial.css');
    expect(cssContent).not.toContain('mode.product.css');
    expect(cssContent).not.toContain('brand.storefront.css');
  });

  // C2: changing the config's mode (here: a hand-edit after the first run)
  // used to leave `wireImport` reporting `already-present` forever, because
  // only the brand import was ever checked.
  it('C2: changing the config mode on a later run rewires the CSS mode import in place', async () => {
    const first = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(first.wiring.status).toBe('wired');

    const configPath = join(project, 'jig.config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.surfaces = [{ match: '/', mode: 'editorial' }];
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const second = await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });

    expect(second.config.action).toBe('skipped-edited');
    expect(second.wiring.status).toBe('rewired');
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    expect(cssContent).toContain('mode.editorial.css');
    expect(cssContent).not.toContain('mode.product.css');
    // The brand import itself was left alone — still present exactly once.
    const brandMatches = cssContent.match(/@import "[^"]*brand\.storefront\.css"/g) ?? [];
    expect(brandMatches).toHaveLength(1);
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

  it('throws a clear error naming jig install when Jig is not installed', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'jig-init-bare-'));
    try {
      await expect(
        init({ projectRoot: bare, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG }),
      ).rejects.toThrow(/jig install/i);
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

    expect(existsSync(join(project, '.jig', 'tokens', 'brand.globalapp.css'))).toBe(true);
    expect(existsSync(join(project, 'jig.config.json'))).toBe(true);
    // The real rules manifest lives in $HOME, untouched by init's own writes.
    expect(existsSync(join(home, '.jig', 'manifest.json'))).toBe(true);
    // init's sidecar lives in the project, and must never collide with a
    // real .jig/manifest.json there (which would corrupt scope detection).
    expect(existsSync(join(project, '.jig', 'manifest.json'))).toBe(false);
    expect(existsSync(join(project, '.jig', 'init-manifest.json'))).toBe(true);

    expect(result.wiring.status).toBe('wired');
    const cssContent = readFileSync(join(project, 'src', 'app.css'), 'utf8');
    const modeMatch = /@import "([^"]+mode\.product\.css)";/.exec(cssContent)!;
    // C3: a global install's mode file is copied into the *project's own*
    // .jig/tokens/, and the @import is project-relative — never pointing at
    // $HOME, which would resolve only on the machine that ran `init`.
    const resolved = resolve(dirname(join(project, 'src', 'app.css')), modeMatch[1]);
    expect(resolved).toBe(join(project, '.jig', 'tokens', 'mode.product.css'));
    expect(existsSync(resolved)).toBe(true);
    expect(resolved.startsWith(home)).toBe(false);

    // The copy is tracked in the init sidecar manifest, so a later `jig
    // update` can refresh it (see the companion fix in commands/update.ts).
    const sidecar = JSON.parse(readFileSync(join(project, '.jig', 'init-manifest.json'), 'utf8'));
    expect(sidecar.files['.jig/tokens/mode.product.css']).toMatch(/^sha256:/);
  });

  it('does not clobber a hand-edited copy of the mode file on a second run', async () => {
    install({ agent: 'claude', scope: 'global', projectRoot: project, packageRoot: repoRoot, version: '0.1.0', homeDir: home });
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', 'app.css'), ':root { --brand-color: #0F766E; }\n');

    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    const modePath = join(project, '.jig', 'tokens', 'mode.product.css');
    const edited = `${readFileSync(modePath, 'utf8')}\n:root { --my-own-var: 1; }\n`;
    writeFileSync(modePath, edited);

    await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home, version: '0.1.0', yes: true, log: NOOP_LOG });
    expect(readFileSync(modePath, 'utf8')).toBe(edited);
  });
});
