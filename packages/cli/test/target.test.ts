import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveInstalled } from '../src/install/target.js';
import { writeManifest, type Manifest } from '../src/install/manifest.js';
import { getAdapter } from '../src/adapters/registry.js';

let project: string;
let home: string;

// claude's referenceDir is `.claude/skills/jig` regardless of scope — the
// interesting collision case for the sameRoot/C2 regression tests below.
const claudeDir = getAdapter('claude').referenceDir('project');
// opencode's referenceDir DIFFERS by scope (`.opencode` vs
// `.config/opencode`), so it's the interesting case for showing sameRoot does
// NOT by itself create ambiguity. codex used to serve this role, back when its
// project scope was a bare `.jig`; it now mirrors its own global path.
const splitProjectDir = getAdapter('opencode').referenceDir('project');
const splitGlobalDir = getAdapter('opencode').referenceDir('global');

const baseManifest = (scope: 'project' | 'global', agent = 'claude'): Manifest => ({
  version: '0.1.0',
  agent,
  scope,
  installedAt: new Date().toISOString(),
  files: {},
});

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-target-proj-'));
  home = mkdtempSync(join(tmpdir(), 'jig-target-home-'));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

describe('resolveInstalled', () => {
  it('returns null when no manifest exists at either root', () => {
    expect(resolveInstalled(project, home)).toBeNull();
  });

  it('discovers a project-scope install via projectRoot', () => {
    writeManifest(project, baseManifest('project'), claudeDir);
    const result = resolveInstalled(project, home);
    expect(result?.installRoot).toBe(project);
    expect(result?.scope).toBe('project');
    expect(result?.referenceDir).toBe(claudeDir);
  });

  it('discovers a global-scope install via homeDir', () => {
    writeManifest(home, baseManifest('global', 'opencode'), splitGlobalDir);
    const result = resolveInstalled(project, home);
    expect(result?.installRoot).toBe(home);
    expect(result?.scope).toBe('global');
    expect(result?.referenceDir).toBe(splitGlobalDir);
  });

  it('prefers projectRoot and never trusts the manifest scope field when roots differ (C3)', () => {
    mkdirSync(join(project, claudeDir), { recursive: true });
    writeManifest(project, baseManifest('global'), claudeDir); // lies about scope
    const result = resolveInstalled(project, home);
    expect(result?.installRoot).toBe(project);
    expect(result?.scope).toBe('project'); // discovered location wins, not the field
  });

  it('trusts the manifest scope when projectRoot and homeDir are the same path and the adapter dir collides (C2 regression)', () => {
    // claude's referenceDir is the same literal path for both scopes, so at
    // homeDir === projectRoot this one file really is indistinguishable
    // between scopes on location alone — the manifest's own field decides.
    writeManifest(home, baseManifest('global'), claudeDir);
    const result = resolveInstalled(home, home);
    expect(result?.installRoot).toBe(home);
    expect(result?.scope).toBe('global');
  });

  it('does not need the scope-field trust even when roots coincide, for an adapter whose scopes use different paths', () => {
    // opencode's project (`.opencode/skills/jig`) and global
    // (`.config/opencode/skills/jig`) reference dirs differ, so even with
    // projectRoot === homeDir there is no collision — a manifest found under
    // the project-shaped path is unambiguously project-scoped regardless of
    // what it claims.
    writeManifest(home, baseManifest('global', 'opencode'), splitProjectDir);
    const result = resolveInstalled(home, home);
    expect(result?.scope).toBe('project');
  });
});

describe('a legacy .jig/manifest.json is claimed by nobody', () => {
  // This used to need a guard: codex's project referenceDir was a bare `.jig`,
  // exactly where the pre-0.4.0 layout put its manifest, so probing by
  // directory let a leftover be read as a codex install — and `update` then
  // rebuilt the whole vendored layout at the project root, undoing the
  // migration on the exact upgrade path a real user takes.
  //
  // Codex now uses `.codex/.jig` at both scopes, so no adapter probes `.jig`
  // at all and the collision cannot occur. The guard stays because it is the
  // property that matters, not the mechanism that currently provides it.
  it('ignores a .jig/manifest.json that names a different adapter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jig-legacy-'));
    mkdirSync(join(dir, '.jig'), { recursive: true });
    writeFileSync(
      join(dir, '.jig', 'manifest.json'),
      JSON.stringify({
        version: '0.3.0', agent: 'claude', scope: 'project',
        installedAt: '2026-01-01T00:00:00.000Z', files: {},
      }),
    );
    // codex would otherwise claim it, because the directory matches.
    expect(resolveInstalled(dir, join(dir, 'home'))).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it('still reports a manifest naming an agent that is not an adapter at all', () => {
    // Written where an adapter actually probes, so the C1 guard is reached:
    // a manifest naming an unknown agent must fail loudly rather than be
    // passed over as "some other harness's".
    const dir = mkdtempSync(join(tmpdir(), 'jig-bogus-'));
    mkdirSync(join(dir, claudeDir), { recursive: true });
    writeFileSync(
      join(dir, claudeDir, 'manifest.json'),
      JSON.stringify({
        version: '0.3.0', agent: 'not-a-real-agent', scope: 'project',
        installedAt: '2026-01-01T00:00:00.000Z', files: {},
      }),
    );
    expect(() => resolveInstalled(dir, join(dir, 'home'))).toThrow(/Unknown agent/i);
    rmSync(dir, { recursive: true, force: true });
  });
});
