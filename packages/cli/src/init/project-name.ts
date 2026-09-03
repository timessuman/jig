import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Slug used for `brand.<project>.css` — filename-safe, lowercase, no
 * scope prefix (`@acme/web` → `web`, matching how most people would say the
 * project's name out loud).
 */
function slugify(name: string): string {
  const withoutScope = name.replace(/^@[^/]+\//, '');
  const slug = withoutScope
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'project';
}

/**
 * Prefers `package.json`'s `name`; falls back to the project directory's own
 * basename so a non-JS project still gets a stable, meaningful slug instead
 * of a generic placeholder.
 */
export function deriveProjectSlug(projectRoot: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as { name?: unknown };
    if (typeof pkg.name === 'string' && pkg.name.trim()) return slugify(pkg.name);
  } catch {
    // no package.json, or unparsable — fall through to the directory name
  }
  return slugify(basename(projectRoot));
}
