import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveInstalled } from '../src/install/target.js';
import { writeManifest, type Manifest } from '../src/install/manifest.js';

let project: string;
let home: string;

const baseManifest = (scope: 'project' | 'global'): Manifest => ({
  version: '0.1.0',
  agent: 'claude',
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
    writeManifest(project, baseManifest('project'));
    const result = resolveInstalled(project, home);
    expect(result?.installRoot).toBe(project);
    expect(result?.scope).toBe('project');
  });

  it('discovers a global-scope install via homeDir', () => {
    writeManifest(home, baseManifest('global'));
    const result = resolveInstalled(project, home);
    expect(result?.installRoot).toBe(home);
    expect(result?.scope).toBe('global');
  });

  it('prefers projectRoot and never trusts the manifest scope field when roots differ (C3)', () => {
    mkdirSync(join(project, '.jig'), { recursive: true });
    writeManifest(project, baseManifest('global')); // lies about scope
    const result = resolveInstalled(project, home);
    expect(result?.installRoot).toBe(project);
    expect(result?.scope).toBe('project'); // discovered location wins, not the field
  });

  it('trusts the manifest scope when projectRoot and homeDir are the same path (C2 regression)', () => {
    writeManifest(home, baseManifest('global'));
    const result = resolveInstalled(home, home);
    expect(result?.installRoot).toBe(home);
    expect(result?.scope).toBe('global');
  });
});
