import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKERS = ['package.json', '.git', 'jig.config.json'];

export function findProjectRoot(startDir: string): string {
  let current = startDir;
  const { root } = parse(startDir);
  while (true) {
    if (MARKERS.some((m) => existsSync(join(current, m)))) return current;
    if (current === root) return startDir;
    current = dirname(current);
  }
}

export function getPackageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..');
}

const ASSET_MARKER = 'rules.index.json';

/**
 * Locates the root directory that holds the bundled assets (`rules/`,
 * `tokens/`, `templates/`, and `rules.index.json`).
 *
 * In development (monorepo) this walks up from `packages/cli` to the repo
 * root. In a package installed from npm, `prepack` stages copies of those
 * assets inside `packages/cli` itself, so this resolves to the package root.
 *
 * @param startDir Directory to start the search from. Defaults to the CLI
 *   package directory (the directory returned by `getPackageRoot()`).
 */
export function assetRoot(startDir: string = getPackageRoot()): string {
  let current = startDir;
  const { root } = parse(startDir);
  while (true) {
    if (existsSync(join(current, ASSET_MARKER))) return current;
    if (current === root) {
      throw new Error(
        `assetRoot(): could not find an ancestor of "${startDir}" containing "${ASSET_MARKER}"`,
      );
    }
    current = dirname(current);
  }
}
