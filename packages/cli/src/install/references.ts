import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

/**
 * The reference files a build ships: `references/**` in the package, copied
 * verbatim beside the skill file.
 *
 * Rules say what good UI is; references say how to *use* the system — the
 * judgment half of a command, and what to do when two rules appear to disagree.
 * Both are agent-read material, so both live beside `SKILL.md`.
 *
 * The tree is walked rather than listed, so adding a reference is a file drop
 * with no code change — the same property the harness table has. Only `.md`
 * files are shipped: everything here is read by an agent, and a stray file in
 * the directory should not silently become part of a user's install.
 */
export interface ReferenceFile {
  /** Path relative to `references/`, POSIX-separated — e.g. `commands/init.md`. */
  relPath: string;
  content: string;
}

export function referenceFiles(packageRoot: string): ReferenceFile[] {
  const root = join(packageRoot, 'references');
  if (!existsSync(root)) return [];

  const found: ReferenceFile[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const child = join(dir, entry.name);
      const rel = prefix ? posix.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(child, rel);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        found.push({ relPath: rel, content: readFileSync(child, 'utf8') });
      }
    }
  };
  walk(root, '');
  return found;
}
