import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import type { Scope } from '../install/manifest.js';
import { assertSafeRelPath } from './types.js';
import { codex } from './codex.js';
import { SKILL_DIR_ADAPTERS } from './skill-dir.js';

// codex is the one adapter left with a bespoke implementation — AGENTS.md
// is genuinely a different mechanism, not a skill directory. Every other
// harness comes from the SKILL_DIR_HARNESSES table (see skill-dir.ts);
// adding one there is the entire diff for a new harness.
const ADAPTERS: Adapter[] = [codex, ...SKILL_DIR_ADAPTERS];

/**
 * An adapter's reference directory, asserted safe to join against a project or
 * home root before it is returned.
 *
 * `referenceDir` is as table-derived as `skillFiles` — since the harness-table
 * refactor a single bad `dir` entry (`'../evil'`) sends every write for that
 * harness outside the tree. `install` happened to survive it because it gathers
 * all files before writing anything, but `update` wrote its whole reference
 * bundle and only then hit the guard on the skill file. Route every write-path
 * lookup through here so no write can precede the check.
 */
export function referenceDirFor(adapter: Adapter, scope: Scope): string {
  const dir = adapter.referenceDir(scope);
  assertSafeRelPath(dir, adapter.name);
  return dir;
}

// The shipped table is fixed at build time, so a bad entry is a bug that should
// surface immediately rather than at whichever command first writes with it.
for (const adapter of ADAPTERS) {
  for (const scope of ['project', 'global'] as const) {
    assertSafeRelPath(adapter.referenceDir(scope), adapter.name);
  }
}

export function adapterNames(): string[] {
  return ADAPTERS.map((a) => a.name);
}

export function getAdapter(name: string): Adapter {
  const found = ADAPTERS.find((a) => a.name === name);
  if (!found) {
    throw new Error(`Unknown agent '${name}'. Available: ${adapterNames().join(', ')}`);
  }
  return found;
}

/**
 * Calls `adapter.skillFiles(ctx)` and asserts every returned file's `relPath` is safe
 * (see `assertSafeRelPath`) before returning them. Prefer this over calling
 * `adapter.skillFiles` directly wherever the result is written to disk.
 */
export function skillFilesFor(adapter: Adapter, ctx: AdapterContext): RenderedFile[] {
  const files = adapter.skillFiles(ctx);
  for (const file of files) {
    assertSafeRelPath(file.relPath, adapter.name);
  }
  return files;
}

export { ADAPTERS };
export type { Adapter, AdapterContext, RenderedFile } from './types.js';
