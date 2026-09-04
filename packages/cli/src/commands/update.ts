import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { checksum, isModified, writeManifest, type Manifest, type Scope } from '../install/manifest.js';
import { resolveAllInstalled, type ResolvedTarget } from '../install/target.js';
import { licencePathFor, upsertBlock, vendorHeader } from '../install/vendor.js';
import { referenceFiles } from '../install/references.js';
import { matchLineEndings } from '../install/line-endings.js';
import { getAdapter, skillFilesFor } from '../adapters/registry.js';
import { BLOCK_START } from '../adapters/types.js';
import { buildCommandBody, buildSkillBody, relKey, rulesPathFor, type InstallOptions } from './install.js';
import { readInitManifest, writeInitManifest, isInitFileModified } from '../init/state.js';
import { detectLegacyRules } from '../init/migrate.js';

export interface UpdateResult {
  updated: string[];
  skipped: string[];
  fromVersion: string;
  toVersion: string;
  /**
   * One entry per harness refreshed, in the order they were found. A project
   * can hold several installs (claude + cursor + gemini), and each carries its
   * own version — so callers that only read the flat `fromVersion` above see
   * the first target's, and should print this list when it holds more than one.
   */
  targets: UpdatedTarget[];
}

export interface UpdatedTarget {
  agent: string;
  scope: Scope;
  referenceDir: string;
  fromVersion: string;
}

/**
 * Refreshes every vendored Jig install to `opts.version`, leaving alone any file
 * the user has edited (per its recorded checksum) so in-place rule edits
 * survive an update.
 *
 * Scope is NOT taken from `opts.scope` — the existing manifest is the
 * source of truth for where Jig was installed and under which scope, so a
 * global install stays a global install across updates regardless of how
 * this function is called. `opts.agent` / `opts.scope` exist only to satisfy
 * the shared `InstallOptions` shape and are otherwise unused here; the CLI
 * passes placeholders for them and lets this function discover the real
 * values from the manifest (see Correction 1 in the task-9 brief).
 *
 * Manifest discovery, and the install-root/scope/referenceDir resolution
 * described above (Correction 2, C3), is delegated to `resolveAllInstalled`
 * (see `../install/target.ts`) — which returns EVERY harness installed for
 * this project, not just the first. Each is refreshed by `updateTarget`, and
 * its manifest rewritten at the end with `scope` corrected to the discovered
 * value, self-healing a manifest that lied about it.
 */
export function update(opts: InstallOptions): UpdateResult {
  const resolved = resolveAllInstalled(opts.projectRoot, opts.homeDir);
  if (resolved.length === 0) {
    // "Jig is not installed" reads as nonsense to someone upgrading from the
    // pre-0.4.0 vendored layout: they did install it, and the files are right
    // there in `.jig/`. Nothing probes that directory any more — it is the
    // project's own now — so name what was found rather than leaving them to
    // guess why the CLI cannot see an install they can.
    const legacy = detectLegacyRules(opts.projectRoot);
    const hint = legacy.present
      ? ` A pre-0.4.0 bundle is still in .jig/ (${legacy.files.length} file(s)); since 0.4.0 the ` +
        `skill and its rules live beside your agent's skill file instead, so that copy is no ` +
        `longer read. Re-run install, then 'jig init' will report the leftovers — it never removes ` +
        `a file you have edited.`
      : '';
    throw new Error(
      `Jig is not installed in ${opts.projectRoot}. Run 'jig install --agent <name>' first.${hint}`,
    );
  }

  const updated: string[] = [];
  const skipped: string[] = [];
  const targets: UpdatedTarget[] = [];

  // Every install found gets refreshed, not just the first. Installing two
  // harnesses in one project is a supported, documented flow, and refreshing
  // only one of them left the rest pinned at their install version with no
  // signal that they had been passed over.
  for (const target of resolved) {
    const one = updateTarget(opts, target);
    updated.push(...one.updated);
    skipped.push(...one.skipped);
    targets.push({
      agent: target.manifest.agent,
      scope: target.scope,
      referenceDir: target.referenceDir,
      fromVersion: target.manifest.version,
    });
  }

  // Project-tree files written by `init` belong to the project, not to any one
  // harness, so they are refreshed once here rather than inside the per-target
  // loop — otherwise a two-harness project would rewrite and re-report them
  // once per harness.
  const initResult = updateInitFiles(opts);
  updated.push(...initResult.updated);
  skipped.push(...initResult.skipped);

  return {
    updated,
    skipped,
    fromVersion: resolved[0].manifest.version,
    toVersion: opts.version,
    targets,
  };
}

function updateTarget(
  opts: InstallOptions,
  resolved: ResolvedTarget,
): { updated: string[]; skipped: string[] } {
  const { installRoot, scope: discoveredScope, manifest: existing, referenceDir } = resolved;

  const adapter = getAdapter(existing.agent);

  const updated: string[] = [];
  const skipped: string[] = [];
  const files: Record<string, string> = { ...existing.files };

  const write = (key: string, content: string) => {
    const abs = join(installRoot, ...key.split('/'));
    mkdirSync(dirname(abs), { recursive: true });
    // Preserve whatever endings the file already uses — see install/line-endings.ts.
    const existing = existsSync(abs) ? readFileSync(abs, 'utf8') : undefined;
    const toWrite = matchLineEndings(content, existing);
    writeFileSync(abs, toWrite, 'utf8');
    files[key] = checksum(toWrite);
    updated.push(key);
  };

  // The reference bundle: rules + the index that describes them. Refreshed
  // in place at `referenceDir` (beside the skill file), skipping anything
  // the user has edited since — the same rule `install` applies.
  const rulesDir = join(opts.packageRoot, 'rules');
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    const key = relKey(referenceDir, 'rules', file);
    if (isModified(installRoot, key, existing)) {
      skipped.push(key);
      continue;
    }
    write(key, vendorHeader(file, opts.version, 'html', licencePathFor(`rules/${file}`)) + readFileSync(join(rulesDir, file), 'utf8'));
  }

  for (const ref of referenceFiles(opts.packageRoot)) {
    const key = relKey(referenceDir, ...ref.relPath.split('/'));
    if (isModified(installRoot, key, existing)) {
      skipped.push(key);
      continue;
    }
    write(key, vendorHeader(ref.relPath, opts.version, 'html', licencePathFor(ref.relPath)) + ref.content);
  }

  const indexKey = relKey(referenceDir, 'rules.index.json');
  if (isModified(installRoot, indexKey, existing)) {
    skipped.push(indexKey);
  } else {
    write(indexKey, readFileSync(join(opts.packageRoot, 'rules.index.json'), 'utf8'));
  }

  // The adapter's skill/instruction file (`.claude/skills/jig/SKILL.md`,
  // `AGENTS.md`, `.cursor/rules/jig.mdc`, ...) is manifest-tracked too, and
  // must be refreshed just like the rules — otherwise a user ends up with
  // new rules and a skill file frozen at install time, with no signal.
  // Agent comes from the existing manifest (Correction 1); scope comes from
  // `discoveredScope`, not `existing.scope` (C3), so the render context
  // matches where this update is actually writing.
  const rulesPath = rulesPathFor(referenceDir, discoveredScope);
  const skillBody = buildSkillBody(opts.packageRoot, rulesPath, opts.version);
  const { body: commandBody, subcommands } = buildCommandBody(
    opts.packageRoot,
    rulesPath,
    opts.version,
    adapter.argsPlaceholder ?? '$ARGUMENTS',
  );
  const command = { commandBody, subcommands };
  const skillFiles = skillFilesFor(adapter, {
    version: opts.version,
    scope: discoveredScope,
    skillBody,
    commandPrefix: '/jig ',
    ...command,
  });

  for (const file of skillFiles) {
    const key = file.relPath;
    // Whether a target is "whole-file" (claude, cursor, opencode — entirely
    // Jig's) or "marker-based" (codex, generic AGENTS.md — co-owned with the
    // user's own content outside the markers) is read off the rendered
    // content itself, the same way `install` decides it, rather than
    // hardcoded by adapter name, so a future adapter falls into the right
    // bucket automatically.
    const isBlockFile = file.content.includes(BLOCK_START);

    if (isBlockFile) {
      // Marker-based targets: ANY edit anywhere in the file makes
      // `isModified` true, since the user's own content lives outside the
      // markers. Applying the whole-file skip rule here would mean a codex
      // or generic user never receives another skill update after their
      // first edit — the common case, since they were told to keep their
      // own house rules in that file. So always upsert the block in place
      // (preserving surrounding content) and re-checksum the whole file.
      const abs = join(installRoot, ...key.split('/'));
      const current = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
      write(key, upsertBlock(current, file.content));
      continue;
    }

    // Whole-file targets: treat exactly like a rule file.
    if (isModified(installRoot, key, existing)) {
      skipped.push(key);
      continue;
    }
    write(key, file.content);
  }

  // Attribution files are always replaced, regardless of checksum — a stale
  // install or a local edit must never be able to strip attribution.
  for (const src of ['LICENSE', 'NOTICE'] as const) {
    write(relKey(referenceDir, src), readFileSync(join(opts.packageRoot, src), 'utf8'));
  }

  const manifest: Manifest = {
    ...existing,
    scope: discoveredScope,
    version: opts.version,
    installedAt: new Date().toISOString(),
    files,
  };
  writeManifest(installRoot, manifest, referenceDir);

  return { updated, skipped };
}

/**
 * A global install's mode-file copies inside the *project* tree
 * (`.jig/tokens/<mode>.css`, written by `init` so their `@import`s stay
 * project-relative — see init.ts) are tracked in the project's own
 * `.jig/state.json`, not the reference-bundle manifest at `installRoot`.
 * `updateTarget` only ever writes to `installRoot`, so without this those
 * copies would silently rot: rules move on, the project's copies never
 * do. Refresh under the exact same rule as everything there — skip when
 * the user edited it, refresh when untouched — reusing `opts.projectRoot`
 * (the directory `update` was actually invoked from), not `installRoot`.
 *
 * These files belong to the project, not to any one harness, so this runs
 * once per `update` rather than inside the per-harness loop — otherwise a
 * two-harness project would rewrite and re-report them once per harness.
 *
 * Iterating the package's own tokensDir (rather than hardcoding
 * "mode.*.css") means this generalizes to any package-origin file init
 * ever copies into the project this way. Only keys `init` actually wrote
 * are tracked in state.json (i.e. only the modes a project declared), so
 * this naturally scopes itself to what's really in use — a project that
 * never ran `init` has no state.json and this is a no-op.
 */
function updateInitFiles(opts: InstallOptions): { updated: string[]; skipped: string[] } {
  const updated: string[] = [];
  const skipped: string[] = [];
  const tokensDir = join(opts.packageRoot, 'tokens');
  const initManifest = readInitManifest(opts.projectRoot);
  if (initManifest) {
    const initFiles = { ...initManifest.files };
    let initChanged = false;
    for (const file of readdirSync(tokensDir).filter((f) => f.endsWith('.css')).sort()) {
      const key = relKey('.jig', 'tokens', file);
      if (!(key in initManifest.files)) continue;
      if (isInitFileModified(opts.projectRoot, key, initManifest)) {
        skipped.push(key);
        continue;
      }
      const content = vendorHeader(file, opts.version, 'css', null) + readFileSync(join(tokensDir, file), 'utf8');
      const abs = join(opts.projectRoot, ...key.split('/'));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, 'utf8');
      initFiles[key] = checksum(content);
      initChanged = true;
      updated.push(key);
    }
    if (initChanged) writeInitManifest(opts.projectRoot, { ...initManifest, version: opts.version, files: initFiles });
  }
  return { updated, skipped };
}
