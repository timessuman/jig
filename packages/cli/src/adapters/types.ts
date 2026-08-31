import type { Scope } from '../install/manifest.js';

export interface RenderedFile {
  relPath: string;
  content: string;
}

export interface AdapterContext {
  version: string;
  scope: Scope;
  skillBody: string;
  commandPrefix: string;
}

export interface Adapter {
  name: string;
  displayName: string;
  supportsScope(scope: Scope): boolean;
  skillFiles(ctx: AdapterContext): RenderedFile[];
}

export const SKILL_DESCRIPTION =
  'Design system rules for generating and reviewing UI. Load before building any interface.';
