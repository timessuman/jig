import { resolve } from 'node:path';
import { readManifest, type Manifest, type Scope } from './manifest.js';

export interface ResolvedTarget {
  installRoot: string; // where .jig/ lives
  scope: Scope;
  manifest: Manifest;
}

/**
 * Finds an existing Jig install. Looks for a manifest at `projectRoot`
 * first, then `homeDir`.
 *
 * The DISCOVERED location determines the scope — never the manifest's own
 * `scope` field, which is repo-committed and therefore untrusted input
 * (`manifest.json` can live inside a shared, version-controlled repository,
 * so a manifest claiming `scope: "global"` while physically sitting at the
 * project root must not be able to redirect callers out to `$HOME`).
 *
 * Exception: when `projectRoot` and `homeDir` resolve to the same path
 * (e.g. `cd ~ && jig update`, or a dotfiles repo rooted at `~/.git`),
 * `readManifest(projectRoot)` and `readManifest(homeDir)` read the identical
 * file. There is only one possible destination when the two roots coincide,
 * so the manifest's own `scope` is safe to trust there, and only there.
 */
export function resolveInstalled(projectRoot: string, homeDir: string): ResolvedTarget | null {
  const projectManifest = readManifest(projectRoot);
  const existing = projectManifest ?? readManifest(homeDir);
  if (!existing) return null;

  const sameRoot = resolve(projectRoot) === resolve(homeDir);
  const scope: Scope = !projectManifest ? 'global' : sameRoot ? existing.scope : 'project';
  const installRoot = scope === 'global' ? homeDir : projectRoot;

  return { installRoot, scope, manifest: existing };
}
