import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checksum, isModified, type Manifest } from '../install/manifest.js';

/**
 * `init` writes two files that are always project-local — the brand file
 * and `jig.config.json` — regardless of whether the *rules* install is
 * project- or global-scoped (see the init task brief's architectural point).
 *
 * That means they cannot be tracked in the rules install's own
 * `.jig/manifest.json`: for a global install that manifest's keys resolve
 * against `$HOME`, not the project root, and the two roots are unrelated.
 * A dedicated, differently-named sidecar file avoids two problems at once:
 * it never collides with the real manifest's checksums, and — critically —
 * it is invisible to `resolveInstalled()`, which only ever looks for
 * `.jig/manifest.json`. Writing anything at that exact path in a project
 * whose rules are actually global would flip `resolveInstalled`'s scope
 * detection from 'global' to 'project' on the next `check`/`update`, which
 * is exactly the incoherence this feature exists to fix, not reintroduce.
 */
const INIT_MANIFEST_REL = join('.jig', 'init-manifest.json');

export interface InitManifest {
  files: Record<string, string>;
}

export function readInitManifest(projectRoot: string): InitManifest | null {
  const path = join(projectRoot, INIT_MANIFEST_REL);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const files = (raw as { files?: unknown }).files;
    if (typeof files !== 'object' || files === null) return null;
    return { files: files as Record<string, string> };
  } catch {
    return null;
  }
}

export function writeInitManifest(projectRoot: string, m: InitManifest): void {
  const path = join(projectRoot, INIT_MANIFEST_REL);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(m, null, 2)}\n`, 'utf8');
}

/**
 * Whether the file recorded at `relPath` (project-root-relative) has been
 * edited since `init` last wrote it. Delegates to the real manifest module's
 * `isModified` — which only ever reads the `files` map off whatever object
 * it's given — rather than reimplementing checksum comparison.
 */
export function isInitFileModified(projectRoot: string, relPath: string, m: InitManifest): boolean {
  const asManifest: Manifest = { version: '', agent: '', scope: 'project', installedAt: '', files: m.files };
  return isModified(projectRoot, relPath, asManifest);
}

export { checksum };
