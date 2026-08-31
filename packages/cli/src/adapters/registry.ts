import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { assertSafeRelPath } from './types.js';
import { claude } from './claude.js';
import { codex } from './codex.js';
import { cursor } from './cursor.js';
import { opencode } from './opencode.js';
import { generic } from './generic.js';

const ADAPTERS: Adapter[] = [claude, codex, cursor, opencode, generic];

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
