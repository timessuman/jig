import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type Scope = 'project' | 'global';

export interface Manifest {
  version: string;
  agent: string;
  scope: Scope;
  installedAt: string;
  files: Record<string, string>;
}

const MANIFEST_REL = join('.jig', 'manifest.json');

export function checksum(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

export function readManifest(projectRoot: string): Manifest | null {
  const path = join(projectRoot, MANIFEST_REL);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

export function writeManifest(projectRoot: string, m: Manifest): void {
  const path = join(projectRoot, MANIFEST_REL);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(m, null, 2)}\n`, 'utf8');
}

export function isModified(projectRoot: string, relPath: string, m: Manifest): boolean {
  const recorded = m.files[relPath];
  if (!recorded) return false;
  const abs = join(projectRoot, relPath);
  if (!existsSync(abs)) return false;
  return checksum(readFileSync(abs, 'utf8')) !== recorded;
}
