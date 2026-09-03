import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../src/commands/install.js';
import { update } from '../src/commands/update.js';
import { ADAPTERS, getAdapter } from '../src/adapters/registry.js';
import { detectLegacyRules } from '../src/init/migrate.js';

/**
 * `.jig/` in a project belongs to the project: the brand file, the mode copies,
 * `state.json`. That separation is the whole point of 0.4.0 — Jig's own
 * material lives beside the skill, once, and is never vendored into a repo.
 *
 * Codex was the one harness that did not get it. Having no skill-directory
 * convention (its instruction file is a plain `AGENTS.md`), its project-scope
 * `referenceDir` was `.jig` — so install plus init left 13 files there, Jig's
 * rules and manifest interleaved with the project's tokens and state.
 *
 * Two concrete harms, beyond the untidiness:
 *
 * 1. `detectLegacyRules` scans `.jig/` for install artifacts and offers to
 *    remove them. Under the old layout those artifacts were a *live* Codex
 *    install, so the migration path could offer to delete the install the user
 *    just made.
 * 2. One directory holding two manifests is what let a stale
 *    `.jig/manifest.json` hijack `update` and resurrect the vendored layout.
 *
 * Codex's global scope already used `.codex/.jig`. Project scope now mirrors it.
 */
let project: string;
let pkg: string;
let home: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  home = mkdtempSync(join(tmpdir(), 'jig-home-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n');
  writeFileSync(join(pkg, 'rules.index.json'), JSON.stringify([]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'), 'Rules at {{rules_path}}.');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'), JSON.stringify({}));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig');
});

afterEach(() => {
  for (const d of [project, pkg, home]) rmSync(d, { recursive: true, force: true });
});

describe("no harness claims the project's own .jig/", () => {
  it('gives no adapter a project referenceDir of .jig', () => {
    for (const adapter of ADAPTERS) {
      expect(
        adapter.referenceDir('project'),
        `'${adapter.name}' would write its bundle into the project's own .jig/`,
      ).not.toBe('.jig');
    }
  });

  it('mirrors codex global scope at project scope', () => {
    const codex = getAdapter('codex');
    expect(codex.referenceDir('global')).toBe('.codex/.jig');
    expect(codex.referenceDir('project')).toBe('.codex/.jig');
  });

  it('writes nothing into .jig/ on a codex project install', () => {
    install({
      agent: 'codex',
      scope: 'project',
      projectRoot: project,
      packageRoot: pkg,
      version: '0.4.0',
      homeDir: home,
    });

    expect(existsSync(join(project, 'AGENTS.md')), 'AGENTS.md should still be written').toBe(true);
    expect(
      existsSync(join(project, '.jig')),
      `.jig/ contains ${existsSync(join(project, '.jig')) ? readdirSync(join(project, '.jig')).join(', ') : ''}`,
    ).toBe(false);
    expect(existsSync(join(project, '.codex', '.jig', 'rules', '00-anti-patterns.md'))).toBe(true);
  });

  it('does not let the legacy scanner mistake a live install for legacy files', () => {
    // Before the move, a fresh codex project install put rules and a manifest
    // in `.jig/` — exactly what `detectLegacyRules` looks for — so `init` could
    // offer to remove the install that had just been made.
    install({
      agent: 'codex',
      scope: 'project',
      projectRoot: project,
      packageRoot: pkg,
      version: '0.4.0',
      homeDir: home,
    });
    expect(detectLegacyRules(project).present).toBe(false);
  });
});

describe('upgrading from the pre-0.4.0 vendored layout', () => {
  it("tells an upgrading user their .jig/ bundle is why 'not installed' appears", () => {
    // Anyone upgrading from the vendored layout — every harness before 0.4.0,
    // and codex project installs up to this change — has a bundle in `.jig/`
    // that nothing probes any more. `update` correctly finds no install, but
    // "Jig is not installed" reads as nonsense to someone who installed it and
    // can see the files. Name what was found so the message is actionable.
    mkdirSync(join(project, '.jig', 'rules'), { recursive: true });
    writeFileSync(join(project, '.jig', 'rules', '00-anti-patterns.md'), 'old\n');
    writeFileSync(
      join(project, '.jig', 'manifest.json'),
      JSON.stringify({
        version: '0.3.0', agent: 'codex', scope: 'project',
        installedAt: '2026-01-01T00:00:00.000Z', files: {},
      }),
    );

    let message = '';
    try {
      update({
        agent: 'codex', scope: 'project', projectRoot: project,
        packageRoot: pkg, version: '0.4.0', homeDir: home,
      });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message, 'update should still refuse').toMatch(/not installed/i);
    expect(message, 'but it must name the legacy bundle it found').toMatch(/\.jig/);
  });
});
