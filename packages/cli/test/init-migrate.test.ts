import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectLegacyRules,
  describeLegacyReport,
  removableLegacyFiles,
  removeLegacyFiles,
} from '../src/init/migrate.js';
import { checksum } from '../src/install/manifest.js';
import { init } from '../src/commands/init.js';

let project: string;
let home: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-migrate-proj-'));
  home = mkdtempSync(join(tmpdir(), 'jig-migrate-home-'));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

/** Seeds a pre-0.4.0 `.jig/` — rule markdown + rules.index.json + LICENSE +
 *  NOTICE + the old manifest.json, exactly as a version of `install` before
 *  this architecture vendored them, plus the OLD legacy manifest recording
 *  their checksums (so edit-detection has something to compare against). */
function seedLegacyInstall(opts: { editRule?: boolean; withManifest?: boolean } = {}) {
  const jigDir = join(project, '.jig');
  mkdirSync(jigDir, { recursive: true });
  const ruleBody = '### A-01 Rule\n❌ bad\n✅ good\n';
  const indexBody = JSON.stringify([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' }]);
  writeFileSync(join(jigDir, '00-anti-patterns.md'), ruleBody);
  writeFileSync(join(jigDir, 'rules.index.json'), indexBody);
  writeFileSync(join(jigDir, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(jigDir, 'NOTICE'), 'Jig');

  if (opts.withManifest !== false) {
    writeFileSync(
      join(jigDir, 'manifest.json'),
      JSON.stringify({
        version: '0.3.0',
        agent: 'claude',
        scope: 'project',
        installedAt: new Date().toISOString(),
        files: {
          '.jig/00-anti-patterns.md': checksum(ruleBody),
          '.jig/rules.index.json': checksum(indexBody),
        },
      }),
    );
  }

  if (opts.editRule) {
    writeFileSync(join(jigDir, '00-anti-patterns.md'), `${ruleBody}\n### A-99 mine\n`);
  }
}

describe('detectLegacyRules', () => {
  it('reports nothing for a project with no .jig/', () => {
    const report = detectLegacyRules(project);
    expect(report.present).toBe(false);
    expect(report.files).toHaveLength(0);
  });

  it('reports nothing for a project whose .jig/ only holds current-model state (tokens, config)', () => {
    mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
    writeFileSync(join(project, '.jig', 'tokens', 'brand.acme.css'), ':root {}\n');
    writeFileSync(join(project, '.jig', 'state.json'), '{"files":{}}');
    const report = detectLegacyRules(project);
    expect(report.present).toBe(false);
  });

  it('finds the legacy install artifacts and classifies an untouched rule file as removable', () => {
    seedLegacyInstall();
    const report = detectLegacyRules(project);
    expect(report.present).toBe(true);
    const relPaths = report.files.map((f) => f.relPath).sort();
    expect(relPaths).toEqual([
      '.jig/00-anti-patterns.md',
      '.jig/LICENSE',
      '.jig/NOTICE',
      '.jig/manifest.json',
      '.jig/rules.index.json',
    ]);
    const ruleFile = report.files.find((f) => f.relPath === '.jig/00-anti-patterns.md')!;
    expect(ruleFile.modified).toBe(false);
    expect(removableLegacyFiles(report)).toContain('.jig/00-anti-patterns.md');
  });

  it('never marks an edited rule file as removable', () => {
    seedLegacyInstall({ editRule: true });
    const report = detectLegacyRules(project);
    const ruleFile = report.files.find((f) => f.relPath === '.jig/00-anti-patterns.md')!;
    expect(ruleFile.modified).toBe(true);
    expect(removableLegacyFiles(report)).not.toContain('.jig/00-anti-patterns.md');
  });

  it('treats a file with no legacy manifest to verify against as unverifiable, not removable', () => {
    seedLegacyInstall({ withManifest: false });
    const report = detectLegacyRules(project);
    const ruleFile = report.files.find((f) => f.relPath === '.jig/00-anti-patterns.md')!;
    expect(ruleFile.modified).toBe('unknown');
    expect(removableLegacyFiles(report)).toHaveLength(0);
  });

  it('never touches .jig/tokens/ or jig.config.json even when they sit beside legacy install artifacts', () => {
    seedLegacyInstall();
    mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
    writeFileSync(join(project, '.jig', 'tokens', 'brand.acme.css'), ':root {}\n');
    writeFileSync(join(project, 'jig.config.json'), '{}');
    const report = detectLegacyRules(project);
    const relPaths = report.files.map((f) => f.relPath);
    expect(relPaths.some((p) => p.includes('tokens'))).toBe(false);
    expect(relPaths.some((p) => p.includes('jig.config.json'))).toBe(false);
  });
});

describe('describeLegacyReport', () => {
  it('is empty for an absent report', () => {
    expect(describeLegacyReport({ present: false, files: [] })).toEqual([]);
  });

  it('names an edited file explicitly, distinct from the removable list', () => {
    seedLegacyInstall({ editRule: true });
    const report = detectLegacyRules(project);
    const lines = describeLegacyReport(report).join('\n');
    expect(lines).toContain('Edited since install');
    expect(lines).toContain('.jig/00-anti-patterns.md');
  });
});

describe('removeLegacyFiles', () => {
  it('removes exactly the given files and nothing else', () => {
    seedLegacyInstall();
    removeLegacyFiles(project, ['.jig/00-anti-patterns.md']);
    expect(existsSync(join(project, '.jig', '00-anti-patterns.md'))).toBe(false);
    expect(existsSync(join(project, '.jig', 'rules.index.json'))).toBe(true);
  });

  it('is best-effort: a missing file does not throw', () => {
    expect(() => removeLegacyFiles(project, ['.jig/does-not-exist.md'])).not.toThrow();
  });
});

// --- End-to-end through `init()`: report, consent-gated removal, and never
// removing an edited file, exactly as the migration section of the
// skill-first spec requires. ---
describe('init — migration integration', () => {
  const NOOP_LOG = () => {};

  it('reports a legacy install and removes unedited files with consent', async () => {
    seedLegacyInstall();
    const lines: string[] = [];
    const prompt = async (q: string) => (q.includes('Remove these') ? 'y' : '');
    await init({ projectRoot: project, packageRoot: join(process.cwd(), '..', '..'), homeDir: home, version: '0.1.0', yes: false, prompt, log: (l) => lines.push(l) });

    expect(lines.some((l) => l.includes('pre-0.4.0 Jig install'))).toBe(true);
    expect(existsSync(join(project, '.jig', '00-anti-patterns.md'))).toBe(false);
    expect(existsSync(join(project, '.jig', 'rules.index.json'))).toBe(false);
  });

  it('leaves legacy files in place when consent is withheld', async () => {
    seedLegacyInstall();
    const prompt = async (q: string) => (q.includes('Remove these') ? 'n' : '');
    await init({ projectRoot: project, packageRoot: join(process.cwd(), '..', '..'), homeDir: home, version: '0.1.0', yes: false, prompt, log: NOOP_LOG });

    expect(existsSync(join(project, '.jig', '00-anti-patterns.md'))).toBe(true);
  });

  it('never removes an edited legacy rule file even with consent, and reports it by name', async () => {
    seedLegacyInstall({ editRule: true });
    const lines: string[] = [];
    const prompt = async (q: string) => (q.includes('Remove these') ? 'y' : '');
    await init({ projectRoot: project, packageRoot: join(process.cwd(), '..', '..'), homeDir: home, version: '0.1.0', yes: false, prompt, log: (l) => lines.push(l) });

    expect(existsSync(join(project, '.jig', '00-anti-patterns.md'))).toBe(true);
    expect(readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8')).toContain('A-99 mine');
    expect(lines.some((l) => l.includes('Edited since install') )).toBe(true);
    expect(lines.some((l) => l.includes('.jig/00-anti-patterns.md'))).toBe(true);
  });

  it('--yes never deletes anything automatically, but still reports', async () => {
    seedLegacyInstall();
    const lines: string[] = [];
    await init({ projectRoot: project, packageRoot: join(process.cwd(), '..', '..'), homeDir: home, version: '0.1.0', yes: true, log: (l) => lines.push(l) });

    expect(existsSync(join(project, '.jig', '00-anti-patterns.md'))).toBe(true);
    expect(lines.some((l) => l.includes('pre-0.4.0 Jig install'))).toBe(true);
  });
});
