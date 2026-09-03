import { basename, dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { checksum, isModified, writeManifest, type Manifest } from '../install/manifest.js';
import { resolveInstalled } from '../install/target.js';
import { upsertBlock, vendorHeader } from '../install/vendor.js';
import { getAdapter, skillFilesFor } from '../adapters/registry.js';
import { BLOCK_START } from '../adapters/types.js';
import { buildSkillBody, relKey, type InstallOptions } from './install.js';
import { readInitManifest, writeInitManifest, isInitFileModified } from '../init/state.js';

export interface UpdateResult {
  updated: string[];
  skipped: string[];
  fromVersion: string;
  toVersion: string;
}

const ALWAYS_REPLACE = [relKey('.jig', 'LICENSE'), relKey('.jig', 'NOTICE')];

/**
 * Refreshes a vendored Jig install to `opts.version`, leaving alone any file
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
 * Manifest discovery, and the install-root/scope resolution described above
 * (Correction 2, C3), is delegated to `resolveInstalled` (see
 * `../install/target.ts`) — the same logic `check` uses to find an existing
 * install. The manifest is rewritten at the end with `scope` corrected to
 * the discovered value, self-healing a manifest that lied about it.
 */
export function update(opts: InstallOptions): UpdateResult {
  const resolved = resolveInstalled(opts.projectRoot, opts.homeDir);
  if (!resolved) {
    throw new Error(
      `Jig is not installed in ${opts.projectRoot}. Run 'jig install --agent <name>' first.`,
    );
  }
  const { installRoot, scope: discoveredScope, manifest: existing } = resolved;

  const adapter = getAdapter(existing.agent);
  if (!adapter.supportsScope(discoveredScope)) {
    throw new Error(
      `Jig's manifest at ${installRoot} records agent '${existing.agent}', which does not support ` +
        `${discoveredScope} scope. Re-run 'jig install --agent <name>' to fix it.`,
    );
  }

  const updated: string[] = [];
  const skipped: string[] = [];
  const files: Record<string, string> = { ...existing.files };

  const write = (key: string, content: string) => {
    const abs = join(installRoot, ...key.split('/'));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
    files[key] = checksum(content);
    updated.push(key);
  };

  const rulesDir = join(opts.packageRoot, 'rules');
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    const key = relKey('.jig', file);
    if (isModified(installRoot, key, existing)) {
      skipped.push(key);
      continue;
    }
    write(key, vendorHeader(file, opts.version) + readFileSync(join(rulesDir, file), 'utf8'));
  }

  const tokensDir = join(opts.packageRoot, 'tokens');
  for (const file of readdirSync(tokensDir).filter((f) => f.endsWith('.css')).sort()) {
    const key = relKey('.jig', 'tokens', file);
    if (isModified(installRoot, key, existing)) {
      skipped.push(key);
      continue;
    }
    write(key, vendorHeader(file, opts.version, 'css') + readFileSync(join(tokensDir, file), 'utf8'));
  }

  const indexKey = relKey('.jig', 'rules.index.json');
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
  const skillBody = buildSkillBody(opts.packageRoot, discoveredScope);
  const skillFiles = skillFilesFor(adapter, {
    version: opts.version,
    scope: discoveredScope,
    skillBody,
    commandPrefix: '/jig ',
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
  for (const key of ALWAYS_REPLACE) {
    write(key, readFileSync(join(opts.packageRoot, basename(key)), 'utf8'));
  }

  // C3 companion fix: a global install's mode-file copy inside the
  // *project* tree (`.jig/tokens/mode.<mode>.css`, written by `init` so its
  // `@import` stays project-relative — see init.ts) is tracked in the
  // project's `.jig/init-manifest.json`, not the real manifest at
  // `installRoot`. A global `update` only ever writes to `$HOME`, so
  // without this that copy would silently rot: rules and tokens at `$HOME`
  // move on, the project's copy never does. Refresh it under the exact same
  // rule as everything above — skip when the user edited it, refresh when
  // untouched — reusing `opts.projectRoot` (the directory `update` was
  // actually invoked from) as init.ts does, not `installRoot`.
  //
  // Iterating the package's own tokensDir (rather than hardcoding
  // "mode.*.css") means this generalizes to any package-origin file init
  // ever copies into the project this way. A project-scope install never
  // populates init-manifest with any of these keys — every mode file is
  // already vendored straight into the project tree by `install`/`update`
  // above — so this is a no-op there.
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
      const content = vendorHeader(file, opts.version, 'css') + readFileSync(join(tokensDir, file), 'utf8');
      const abs = join(opts.projectRoot, ...key.split('/'));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, 'utf8');
      initFiles[key] = checksum(content);
      initChanged = true;
      updated.push(key);
    }
    if (initChanged) writeInitManifest(opts.projectRoot, { files: initFiles });
  }

  const manifest: Manifest = {
    ...existing,
    scope: discoveredScope,
    version: opts.version,
    installedAt: new Date().toISOString(),
    files,
  };
  writeManifest(installRoot, manifest);

  return { updated, skipped, fromVersion: existing.version, toVersion: opts.version };
}
