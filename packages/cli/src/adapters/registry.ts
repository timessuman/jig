import type { Adapter } from './types.js';
import { claude } from './claude.js';

const ADAPTERS: Adapter[] = [claude];

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

export { ADAPTERS };
export type { Adapter, AdapterContext, RenderedFile } from './types.js';
