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
    if (existsSync(join(current, ASSET_MARKER))) return sourceOf(current);
    if (current === root) {
      throw new Error(
        `assetRoot(): could not find an ancestor of "${startDir}" containing "${ASSET_MARKER}"`,
      );
    }
    current = dirname(current);
  }
}

/**
 * In a checkout, the repository's own assets, not the copies `prepack` staged
 * beside `packages/cli` for the last publish.
 *
 * Those copies are gitignored and stay behind after a release, and nothing
 * refreshes them until the next `npm pack`. A rule added since was missing
 * from them: the first test run after each corpus change failed 14 tests with
 * "I-148 is not a rule or spec in this corpus", until `tarball.test.ts` ran
 * `npm pack --dry-run`, re-staged them mid-run, and the next run passed. A
 * CLI run from the checkout read the stale rules the same way. An installed
 * package has no repository above it, so it keeps its own copies.
 */
function sourceOf(found: string): string {
  if (isPublishedBuild(found)) return found;
  const repo = join(found, '..', '..');
  return existsSync(join(repo, ASSET_MARKER)) && existsSync(join(repo, 'packages', 'cli', 'package.json')) ? repo : found;
}

/**
 * Whether `packageRoot` is an npm-installed copy of this package rather than a
 * source checkout.
 *
 * The skill file pins the CLI agents are told to run to the version that wrote
 * it. That pin resolves only if the version is on npm — guaranteed when this
 * CLI came from npm, and not otherwise. Run from a clone, an `npm link`, or a
 * pre-release verification build, the skill can name a version that does not
 * exist, and nothing notices until an agent tries to run it. Both of 0.4.0's
 * own review baselines hit precisely that.
 *
 * `node_modules` is matched as a path segment, not a substring: a project at
 * `~/my-node_modules-experiment` is a checkout, not an install.
 */
export function isPublishedBuild(packageRoot: string): boolean {
  return packageRoot.split(/[\\/]/).includes('node_modules');
}

/**
 * A version carrying `-dev` (`0.21.0-dev.1`) is a local build that is never
 * published: a fix tried on a real project before it is released.
 *
 * The skill, the command file and the Stop hook name the CLI they run as
 * `npx jig-ui@<version>`, and npm has no such version. The hook would fail,
 * and a gate that fails lets the agent stop: the project would run unchecked
 * while looking checked. A dev build installed with `npm i -g <tarball>` also
 * sits in `node_modules`, so where it lives cannot tell it apart. Its version
 * can.
 */
export function isDevVersion(version: string | undefined): boolean {
  return !!version && /-dev(\.|$)/.test(version);
}

/** How the skill, the command file and the Stop hook run this CLI. */
export function cliInvocation(version: string | undefined): string {
  if (!version) return 'npx jig-ui';
  return isDevVersion(version) ? 'jig' : `npx jig-ui@${version}`;
}

/** Jig's Stop hook, whichever way it runs the CLI. */
export const JIG_GATE_HOOK = /(?:\bjig-ui@[^\s"]+|^jig) gate\b/;

