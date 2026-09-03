import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getPackageRoot } from '../src/paths.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * Validates the ACTUAL published tarball contents rather than trusting
 * `package.json`'s `prepack`/`files` configuration. `npm pack --dry-run
 * --json` runs the real `prepack` lifecycle script (build included) and
 * reports exactly what would ship — this is the only way to catch a
 * `prepack` that stages assets but never builds `dist/`, which would leave
 * `bin.jig` pointing at a file that does not exist in the published package
 * (see finding C1).
 *
 * `npm`'s own build-tool subprocesses (tsup, the stage-assets script) log to
 * the same stdout stream ahead of npm's JSON payload, so the JSON is
 * extracted from the last line that is exactly `[` onward rather than
 * parsing the whole stream.
 */
function packDryRunFiles(): string[] {
  // Derived from the package location, not `process.cwd()`, so the pack runs
  // against this package whether vitest was invoked from the workspace or the
  // repo root — from the wrong directory it packs the wrong thing, or nothing.
  const raw = execSync('npm pack --dry-run --json', {
    cwd: getPackageRoot(),
    encoding: 'utf8',
  });
  const lines = raw.split('\n');
  const startIdx = lines.map((l) => l.trim()).lastIndexOf('[');
  if (startIdx === -1) {
    throw new Error(`Could not locate JSON payload in npm pack output:\n${raw}`);
  }
  const json = lines.slice(startIdx).join('\n');
  const parsed = JSON.parse(json) as Array<{ files: Array<{ path: string }> }>;
  return parsed[0].files.map((f) => f.path);
}

describe('published tarball (C1)', () => {
  // Building via tsup + staging assets takes longer than vitest's default
  // test timeout.
  const files = packDryRunFiles();

  it('ships every asset the CLI stages, so none can be added to only one list', () => {
    // `stage-assets.mjs` copies assets into the package at prepack; `files` in
    // package.json decides what npm then puts in the tarball. Adding to one and
    // not the other is silent: the code that reads the asset is correct, the
    // asset simply is not there — the same defect class as a tarball with no
    // `dist/`. `references/` was added to neither when the reference tree
    // landed, so an install would have written no references at all, and the
    // walker returns an empty list for a directory that is not there rather
    // than complaining.
    const staged = readFileSync(join(getPackageRoot(), 'scripts/stage-assets.mjs'), 'utf8');
    const listed = staged.match(/const ASSETS = \[([^\]]*)\]/);
    expect(listed, 'could not read the ASSETS list — this guard has drifted').toBeTruthy();
    const assets = [...listed![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(assets.length).toBeGreaterThan(3);

    const packaged: string[] = JSON.parse(
      readFileSync(join(getPackageRoot(), 'package.json'), 'utf8'),
    ).files;
    for (const asset of assets) {
      expect(packaged, `'${asset}' is staged at prepack but absent from package.json files`).toContain(
        asset,
      );
    }

    // And what exists in the repo must actually land in the tarball.
    for (const asset of assets) {
      if (!existsSync(join(repoRoot, asset))) continue;
      expect(
        files.some((f) => f === asset || f.startsWith(`${asset}/`)),
        `'${asset}' exists in the repo and is staged, but nothing from it is in the tarball`,
      ).toBe(true);
    }
  });

  it('includes the CLI entrypoint dist/index.js', () => {
    expect(files).toContain('dist/index.js');
  });

  it('includes the vendored rules directory', () => {
    expect(files.some((f) => f.startsWith('rules/'))).toBe(true);
  });

  it('includes the templates directory', () => {
    expect(files.some((f) => f.startsWith('templates/'))).toBe(true);
  });

  it('includes rules.index.json', () => {
    expect(files).toContain('rules.index.json');
  });

  it('includes LICENSE and NOTICE', () => {
    expect(files).toContain('LICENSE');
    expect(files).toContain('NOTICE');
  });
}, 30000);
