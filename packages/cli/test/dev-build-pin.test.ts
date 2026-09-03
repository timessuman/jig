import { describe, it, expect } from 'vitest';
import { isPublishedBuild } from '../src/paths.js';

/**
 * The skill pins the CLI it tells agents to run: `npx jig-ui@<version>`, where
 * `<version>` is whatever ran `install`.
 *
 * That pin is only guaranteed resolvable when the CLI itself came from npm —
 * in which case the version is published by definition. Run from a source
 * checkout (a clone, `npm link`, pre-release verification), the version may not
 * be published at all, and the skill then tells every agent to run something
 * that 404s. Silently: nothing checks, and the failure only appears later, in
 * the agent's terminal, as a package that does not exist.
 *
 * This is exactly what happened during 0.4.0's own baselines — two runs
 * reported the CLI "refused to run" and fell back to working by hand.
 *
 * The pin is unchanged either way; a dev build's skill file should look like a
 * real one. What changes is that install says so.
 */
describe('detecting a published build', () => {
  it('treats a package installed under node_modules as published', () => {
    expect(isPublishedBuild('/home/u/proj/node_modules/jig-ui')).toBe(true);
    expect(isPublishedBuild('/tmp/npx-cache/node_modules/jig-ui')).toBe(true);
    // Nested, as npm hoists and pnpm nests.
    expect(isPublishedBuild('/a/node_modules/.pnpm/jig-ui@0.4.0/node_modules/jig-ui')).toBe(true);
  });

  it('treats a source checkout as unpublished', () => {
    expect(isPublishedBuild('/home/u/projects/squint/packages/cli')).toBe(false);
    expect(isPublishedBuild('/home/u/src/jig')).toBe(false);
  });

  it('is not fooled by a directory merely named like the marker', () => {
    // `node_modules` must be a path segment, not a substring of one — a project
    // at `~/my-node_modules-experiment` is a checkout, not an install.
    expect(isPublishedBuild('/home/u/my-node_modules-experiment/cli')).toBe(false);
    expect(isPublishedBuild('/home/u/node_modules_backup/jig-ui')).toBe(false);
  });

  it('handles Windows separators', () => {
    expect(isPublishedBuild('C:\\proj\\node_modules\\jig-ui')).toBe(true);
    expect(isPublishedBuild('C:\\proj\\packages\\cli')).toBe(false);
  });
});
