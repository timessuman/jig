import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every asset staged at prepack must be gitignored inside the package.
 *
 * `scripts/stage-assets.mjs` copies files from the repo root into
 * `packages/cli/` so `npm pack` can see them. They are copies, and
 * `packages/cli/.gitignore` says so in as many words — but that file is a
 * hand-maintained list, and adding an entry to `ASSETS` without adding it there
 * commits a build artifact. That is exactly what happened when `CHANGELOG.md`
 * was added to fix a separate finding: staged, unignored, committed.
 *
 * The tarball guard already forces `ASSETS` and `files` to change together.
 * This is the third corner of the same triangle.
 */
const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, '..');

const assets = (): string[] => {
  const src = readFileSync(join(cliRoot, 'scripts', 'stage-assets.mjs'), 'utf8');
  const m = /const ASSETS = \[([^\]]+)\]/.exec(src);
  expect(m, 'could not read the ASSETS list — this guard has drifted').toBeTruthy();
  return m![1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
};

describe('staged assets are not committed as source', () => {
  it('gitignores every asset stage-assets.mjs copies in', () => {
    const ignored = readFileSync(join(cliRoot, '.gitignore'), 'utf8')
      .split('\n')
      .map((l) => l.trim().replace(/^\//, '').replace(/\/$/, ''))
      .filter((l) => l && !l.startsWith('#'));

    for (const asset of assets()) {
      expect(
        ignored,
        `'${asset}' is staged at prepack but not in packages/cli/.gitignore — ` +
          `a copy of it will be committed as though it were source`,
      ).toContain(asset);
    }
  });

  it('reads a non-empty asset list, so the check cannot pass vacuously', () => {
    expect(assets().length).toBeGreaterThan(5);
  });
});
