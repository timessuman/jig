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
 * it never collides with the real reference-bundle manifest's checksums,
 * and — critically — it is invisible to `resolveInstalled()`, which only
 * ever probes for an adapter's own `referenceDir(scope)/manifest.json`.
 * Writing anything at one of those exact paths in a project whose skill is
 * actually installed globally would flip `resolveInstalled`'s scope
 * detection from 'global' to 'project' on the next `update`, which is
 * exactly the incoherence this feature exists to fix, not reintroduce.
 *
 * Named `state.json` (not `manifest.json`) since 0.4.0: this is the ONLY
 * file describing Jig's presence in a project at all — install no longer
 * writes into `.jig/` — so it also carries `version` and `modes` (which
 * mode CSS files are in use), not just per-file checksums.
 */
const INIT_MANIFEST_REL = join('.jig', 'state.json');

export interface InitManifest {
  /** The CLI version that last wrote this state — what `update` compares
   *  against to decide whether a refresh is due. */
  version?: string;
  /** The mode(s) actually declared in `jig.config.json` and therefore
   *  copied into `.jig/tokens/<mode>.css`. */
  modes?: string[];
  files: Record<string, string>;
}

export function readInitManifest(projectRoot: string): InitManifest | null {
  const path = join(projectRoot, INIT_MANIFEST_REL);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const { files, version, modes } = raw as { files?: unknown; version?: unknown; modes?: unknown };
    if (typeof files !== 'object' || files === null) return null;
    return {
      files: files as Record<string, string>,
      version: typeof version === 'string' ? version : undefined,
      modes: Array.isArray(modes) && modes.every((m) => typeof m === 'string') ? (modes as string[]) : undefined,
    };
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
