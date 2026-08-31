import { basename, dirname, join } from 'node:path';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { checksum, isModified, readManifest, writeManifest, type Manifest } from '../install/manifest.js';
import { vendorHeader } from '../install/vendor.js';
import { relKey, type InstallOptions } from './install.js';

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
 * Manifest discovery checks `opts.projectRoot` first, then `opts.homeDir`
 * (Correction 2) — a manifest only ever lives at one of those two roots, and
 * whichever one has it is the install root for the rest of the operation.
 */
export function update(opts: InstallOptions): UpdateResult {
  const projectManifest = readManifest(opts.projectRoot);
  const existing = projectManifest ?? readManifest(opts.homeDir);
  if (!existing) {
    throw new Error(
      `Jig is not installed in ${opts.projectRoot}. Run 'jig install --agent <name>' first.`,
    );
  }

  const installRoot = existing.scope === 'global' ? opts.homeDir : opts.projectRoot;

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

  const indexKey = relKey('.jig', 'rules.index.json');
  if (isModified(installRoot, indexKey, existing)) {
    skipped.push(indexKey);
  } else {
    write(indexKey, readFileSync(join(opts.packageRoot, 'rules.index.json'), 'utf8'));
  }

  // Attribution files are always replaced, regardless of checksum — a stale
  // install or a local edit must never be able to strip attribution.
  for (const key of ALWAYS_REPLACE) {
    write(key, readFileSync(join(opts.packageRoot, basename(key)), 'utf8'));
  }

  const manifest: Manifest = {
    ...existing,
    version: opts.version,
    installedAt: new Date().toISOString(),
    files,
  };
  writeManifest(installRoot, manifest);

  return { updated, skipped, fromVersion: existing.version, toVersion: opts.version };
}
