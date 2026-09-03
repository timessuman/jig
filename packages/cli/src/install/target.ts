import { resolve } from 'node:path';
import { ADAPTERS, getAdapter, referenceDirFor } from '../adapters/registry.js';
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
 * literal path (true for most skill-dir adapters, since e.g. claude's skill
 * directory doesn't vary by scope), `readManifest` at that path reads the
 * identical file under both scopes — there is only one possible
 * destination, so the manifest's own `scope` is safe to trust there, and
 * only there. Any adapter whose project/global `referenceDir` differ
 * (codex; opencode, whose global scope resolves under the XDG config
 * directory instead of `.opencode`) is unambiguous even when the roots
 * coincide, since the two scopes are physically different files.
 *
 * Every adapter supports both scopes as of the harness-table refactor, so
 * this no longer needs to skip any adapter per scope the way it once did.
 */
/**
 * Every Jig install reachable from this project — one per harness. A user can
 * install several (`--agent claude`, then `--agent cursor`), and each has its
 * own manifest under its own reference directory.
 *
 * `update` must refresh all of them. Returning only the first left the others
 * pinned at the version they were installed at, forever, with no signal — a
 * far easier mistake to hit now that five harnesses share one path shape and
 * the README invites per-agent installs.
 */
export function resolveAllInstalled(projectRoot: string, homeDir: string): ResolvedTarget[] {
  const found: ResolvedTarget[] = [];
  const seen = new Set<string>();
  const sameRoot = resolve(projectRoot) === resolve(homeDir);

  for (const adapter of ADAPTERS) {
    const referenceDir = referenceDirFor(adapter, 'project');
    const manifest = readManifest(projectRoot, referenceDir);
    if (manifest && manifest.agent !== adapter.name) {
      // A manifest claiming an agent this build doesn't know must fail loudly
      // rather than be passed over as "some other harness's" — the same C1
      // guard `resolveInstalled` applies.
      getAdapter(manifest.agent);
    }
    if (manifest && manifest.agent === adapter.name) {
      const collides = sameRoot && referenceDirFor(adapter, 'global') === referenceDir;
      const scope: Scope = collides ? manifest.scope : 'project';
      const installRoot = scope === 'global' ? homeDir : projectRoot;
      const key = `${resolve(installRoot)}\u0000${referenceDir}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ installRoot, scope, manifest, referenceDir });
      }
    }
  }

  for (const adapter of ADAPTERS) {
    const referenceDir = referenceDirFor(adapter, 'global');
    const manifest = readManifest(homeDir, referenceDir);
    if (manifest && manifest.agent !== adapter.name) {
      getAdapter(manifest.agent);
    }
    if (manifest && manifest.agent === adapter.name) {
      const key = `${resolve(homeDir)}\u0000${referenceDir}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ installRoot: homeDir, scope: 'global', manifest, referenceDir });
      }
    }
  }

  return found;
}

export function resolveInstalled(projectRoot: string, homeDir: string): ResolvedTarget | null {
  const sameRoot = resolve(projectRoot) === resolve(homeDir);

  for (const adapter of ADAPTERS) {
    const referenceDir = referenceDirFor(adapter, 'project');
    const manifest = readManifest(projectRoot, referenceDir);
    if (!manifest) continue;
    // The manifest must name the adapter whose directory it was found in.
    // Without this, a leftover pre-0.4.0 `.jig/manifest.json` is claimed by
    // codex — whose project referenceDir is `.jig` — and `update` then
    // rebuilds the whole vendored layout at the project root, undoing the
    // migration on the exact upgrade path a real user takes.
    //
    // A manifest naming an agent that is not an adapter AT ALL is a different
    // case: the file is corrupt or hand-edited, and the user needs to be told
    // that rather than "Jig is not installed", which is both wrong and
    // unactionable. `getAdapter` throws with the available names.
    if (manifest.agent !== adapter.name) {
      getAdapter(manifest.agent); // throws `Unknown agent '<x>'` for a bogus name
      continue; // a real adapter, just not this one — keep probing
    }

    const collides = sameRoot && referenceDirFor(adapter, 'global') === referenceDir;
    const scope: Scope = collides ? manifest.scope : 'project';
    const installRoot = scope === 'global' ? homeDir : projectRoot;
    return { installRoot, scope, manifest, referenceDir };
  }

  for (const adapter of ADAPTERS) {
    const referenceDir = referenceDirFor(adapter, 'global');
    const manifest = readManifest(homeDir, referenceDir);
    if (!manifest) continue;
    if (manifest.agent !== adapter.name) {
      getAdapter(manifest.agent);
      continue;
    }
    return { installRoot: homeDir, scope: 'global', manifest, referenceDir };
  }

  return null;
}
