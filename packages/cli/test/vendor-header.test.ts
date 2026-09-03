import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { install } from '../src/commands/install.js';
import { getAdapter } from '../src/adapters/registry.js';

/**
 * Every vendored file carries an attribution header. Before 0.4.0 that header
 * hardcoded `.jig/LICENSE` and `.jig/NOTICE`, which was true when install
 * vendored everything into the project's `.jig/`. The harness-skills layout
 * moved the bundle to `<harness>/skills/jig/`, and the header kept pointing at
 * a path that no longer exists — an install baseline noticed it and left it
 * alone as "cosmetic, upstream".
 *
 * It is attribution, so a path that resolves to nothing is the one kind of
 * error worth failing a test over: it points a reader at the licence terms.
 */
let project: string;
let pkg: string;
let home: string;

const claudeDir = getAdapter('claude').referenceDir('project');

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  home = mkdtempSync(join(tmpdir(), 'jig-home-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  mkdirSync(join(pkg, 'references', 'commands'), { recursive: true });
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n');
  writeFileSync(join(pkg, 'rules.index.json'), JSON.stringify([]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'), 'Rules at {{rules_path}}.');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'), JSON.stringify({}));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig');
  writeFileSync(join(pkg, 'references', 'commands', 'init.md'), '# init\n');
});

afterEach(() => {
  for (const d of [project, pkg, home]) rmSync(d, { recursive: true, force: true });
});

/** Every path a header claims a reader can find the licence at. */
function citedLicencePaths(body: string): string[] {
  const header = body.slice(0, body.indexOf('-->') + 3);
  return [...header.matchAll(/(?:^|[\s(])([\w./-]*(?:LICENSE|NOTICE))\b/g)].map((m) => m[1]);
}

describe('the vendored attribution header', () => {
  it('cites a licence path that actually exists in the install', () => {
    install({
      agent: 'claude',
      scope: 'project',
      projectRoot: project,
      packageRoot: pkg,
      version: '0.4.0',
      homeDir: home,
    });

    const bundle = join(project, claudeDir);
    const files = readdirSync(join(bundle, 'rules')).map((f) => join(bundle, 'rules', f));
    files.push(join(bundle, 'commands', 'init.md'));

    for (const file of files) {
      const cited = citedLicencePaths(readFileSync(file, 'utf8'));
      expect(cited.length, `${relative(project, file)} cites no licence at all`).toBeGreaterThan(0);
      for (const path of cited) {
        // Resolve the citation the way a reader would: relative to the file
        // that makes the claim.
        const resolved = join(file, '..', path);
        expect(
          statSync(resolved, { throwIfNoEntry: false }),
          `${relative(project, file)} cites '${path}', which does not exist`,
        ).toBeDefined();
      }
    }
  });
});
