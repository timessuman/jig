import { resolve } from 'node:path';
import { ADAPTERS } from '../adapters/registry.js';
import { readManifest, type Manifest, type Scope } from './manifest.js';

export interface ResolvedTarget {
  installRoot: string; // project root, or the home directory for a global install
  scope: Scope;
  manifest: Manifest;
  /** Directory (relative to `installRoot`) holding this install's skill
   *  reference material and its own `manifest.json` — i.e. whichever
   *  adapter's `referenceDir(scope)` this manifest was actually found at. */
  referenceDir: string;
}

/**
 * Finds an existing Jig install by probing every adapter's
 * `referenceDir(scope)` under `projectRoot` (project scope) first, then
 * under `homeDir` (global scope) — since 0.4.0 there is no single
 * well-known manifest path any more (each adapter keeps its reference
 * material, and `manifest.json` alongside it, in its own location; see
 * `adapters/types.ts`).
 *
 * The DISCOVERED location determines the scope — never the manifest's own
 * `scope` field, which is repo-committed and therefore untrusted input
 * (`manifest.json` can live inside a shared, version-controlled repository,
 * so a manifest claiming `scope: "global"` while physically sitting at the
 * project root must not be able to redirect callers out to `$HOME`).
 *
 * Exception: when `projectRoot` and `homeDir` resolve to the same path
 * (e.g. `cd ~ && jig update`, or a dotfiles repo rooted at `~/.git`) AND the
 * matched adapter's project- and global-scope `referenceDir` are the same
 * literal path (true for claude/opencode's whole-file adapters when the two
 * roots coincide, since e.g. claude's skill directory doesn't vary by
 * scope), `readManifest` at that path reads the identical file under both
 * scopes — there is only one possible destination, so the manifest's own
 * `scope` is safe to trust there, and only there. Any adapter whose
 * project/global `referenceDir` differ (codex, opencode) is unambiguous
 * even when the roots coincide, since the two scopes are physically
 * different files.
 */
export function resolveInstalled(projectRoot: string, homeDir: string): ResolvedTarget | null {
  const sameRoot = resolve(projectRoot) === resolve(homeDir);

  for (const adapter of ADAPTERS) {
    if (!adapter.supportsScope('project')) continue;
    const referenceDir = adapter.referenceDir('project');
    const manifest = readManifest(projectRoot, referenceDir);
    if (!manifest) continue;

    const collides = sameRoot && adapter.supportsScope('global') && adapter.referenceDir('global') === referenceDir;
    const scope: Scope = collides ? manifest.scope : 'project';
    const installRoot = scope === 'global' ? homeDir : projectRoot;
    return { installRoot, scope, manifest, referenceDir };
  }

  for (const adapter of ADAPTERS) {
    if (!adapter.supportsScope('global')) continue;
    const referenceDir = adapter.referenceDir('global');
    const manifest = readManifest(homeDir, referenceDir);
    if (!manifest) continue;
    return { installRoot: homeDir, scope: 'global', manifest, referenceDir };
  }

  return null;
}
