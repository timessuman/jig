import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { assertSafeRelPath } from './types.js';
import { codex } from './codex.js';
import { SKILL_DIR_ADAPTERS } from './skill-dir.js';

// codex is the one adapter left with a bespoke implementation — AGENTS.md
// is genuinely a different mechanism, not a skill directory. Every other
// harness comes from the SKILL_DIR_HARNESSES table (see skill-dir.ts);
// adding one there is the entire diff for a new harness.
const ADAPTERS: Adapter[] = [codex, ...SKILL_DIR_ADAPTERS];

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
