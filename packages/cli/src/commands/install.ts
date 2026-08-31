import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAdapter, skillFilesFor } from '../adapters/registry.js';
import { checksum, writeManifest, type Manifest, type Scope } from '../install/manifest.js';
import { render, renderCommandTable, type CommandMetadata } from '../template/render.js';
import { upsertBlock, vendorHeader } from '../install/vendor.js';

export { upsertBlock, vendorHeader };

export interface InstallOptions {
  agent: string;
  scope: Scope;
  projectRoot: string;
  packageRoot: string;
  version: string;
  /**
   * The user's home directory. Used as the install root when `scope ===
   * 'global'`; ignored for `scope === 'project'`. `install()` never calls
   * `os.homedir()` itself — callers resolve it (the CLI passes
   * `os.homedir()`; tests pass a temp directory) — so this stays testable
   * without ever touching the real home directory.
   */
  homeDir: string;
}

export interface InstallResult {
  written: string[];
  skipped: string[];
}

const ASK_INSTRUCTION =
  'Ask the user directly in chat, one question at a time, and wait for an answer before continuing.';

/**
 * Joins path segments with forward slashes, regardless of platform. Manifest
 * keys must be POSIX-style so a manifest committed on one platform matches
 * lookups on another (see Correction 2 in the task-8 brief) — filesystem
 * writes still go through `path.join`, which is platform-correct for disk
 * access.
 */
function relKey(...parts: string[]): string {
  return parts.join('/');
}

function writeFile(root: string, key: string, content: string, files: Record<string, string>) {
  const abs = join(root, ...key.split('/'));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  files[key] = checksum(content);
}

export function buildSkillBody(packageRoot: string): string {
  const template = readFileSync(join(packageRoot, 'templates', 'SKILL.md.tmpl'), 'utf8');
  const metadata = JSON.parse(
    readFileSync(join(packageRoot, 'templates', 'command-metadata.json'), 'utf8'),
  ) as CommandMetadata;
  return render(template, {
    command_prefix: '/jig ',
    scripts_path: 'npx jig-ui',
    ask_instruction: ASK_INSTRUCTION,
    available_commands: renderCommandTable(metadata),
    config_file: 'jig.config.json',
  });
}

interface PlannedFile {
  key: string;
  content: string;
}

export function install(opts: InstallOptions): InstallResult {
  const adapter = getAdapter(opts.agent);
  if (!adapter.supportsScope(opts.scope)) {
    throw new Error(`Adapter '${adapter.name}' does not support ${opts.scope} scope.`);
  }

  // `global` scope installs to the user's home directory, not the project
  // root the CLI happened to be invoked from. `homeDir` is supplied by the
  // caller rather than resolved here via `os.homedir()`, so this function
  // stays testable against a temp directory standing in for $HOME.
  const installRoot = opts.scope === 'global' ? opts.homeDir : opts.projectRoot;

  // ---- Phase 1: gather. Read every source and render every output file's
  // content into memory first. Nothing is written to disk in this phase —
  // the only filesystem reads besides the package's own assets are of an
  // *existing* target file, done to feed `upsertBlock`. This way a missing
  // or unreadable source asset (a bad NOTICE, a permission error, an unsafe
  // adapter relPath rejected by `skillFilesFor`) becomes a clean no-op
  // instead of a partial install with files on disk but no manifest to
  // describe them. This is not full write-transaction rollback — a failure
  // partway through Phase 2's actual writes can still leave a partial
  // install — but it converts the common failure mode (a bad input) into a
  // safe one. ----
  const planned: PlannedFile[] = [];

  const rulesDir = join(opts.packageRoot, 'rules');
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    const body = readFileSync(join(rulesDir, file), 'utf8');
    planned.push({ key: relKey('.jig', file), content: vendorHeader(file, opts.version) + body });
  }

  for (const [src, key] of [
    ['rules.index.json', relKey('.jig', 'rules.index.json')],
    ['LICENSE', relKey('.jig', 'LICENSE')],
    ['NOTICE', relKey('.jig', 'NOTICE')],
  ] as const) {
    planned.push({ key, content: readFileSync(join(opts.packageRoot, src), 'utf8') });
  }

  const skillBody = buildSkillBody(opts.packageRoot);
  const skillFiles = skillFilesFor(adapter, {
    version: opts.version,
    scope: opts.scope,
    skillBody,
    commandPrefix: '/jig ',
  });
  for (const file of skillFiles) {
    const key = file.relPath;
    const abs = join(installRoot, ...key.split('/'));
    const isBlockFile = file.content.includes('<!-- jig:start -->');
    const content = isBlockFile && existsSync(abs)
      ? upsertBlock(readFileSync(abs, 'utf8'), file.content)
      : file.content;
    planned.push({ key, content });
  }

  // ---- Phase 2: commit. Every input above was read successfully, so it is
  // now safe to start writing. ----
  const files: Record<string, string> = {};
  const written: string[] = [];
  for (const { key, content } of planned) {
    writeFile(installRoot, key, content, files);
    written.push(key);
  }

  const manifest: Manifest = {
    version: opts.version,
    agent: opts.agent,
    scope: opts.scope,
    installedAt: new Date().toISOString(),
    files,
  };
  writeManifest(installRoot, manifest);
  written.push(relKey('.jig', 'manifest.json'));

  return { written, skipped: [] };
}
