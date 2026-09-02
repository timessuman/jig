import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { install } from '../src/commands/install.js';
import { init } from '../src/commands/init.js';
import { readManifest } from '../src/install/manifest.js';

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
  it('writes the brand file and config into the project even when the rules install is global, and the mode import resolves into $HOME', async () => {
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
    const resolved = resolve(dirname(join(project, 'src', 'app.css')), modeMatch[1]);
    expect(resolved).toBe(join(home, '.jig', 'tokens', 'mode.product.css'));
    expect(existsSync(resolved)).toBe(true);
  });
});
