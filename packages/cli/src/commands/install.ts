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

export function install(opts: InstallOptions): InstallResult {
  const adapter = getAdapter(opts.agent);
  if (!adapter.supportsScope(opts.scope)) {
    throw new Error(`Adapter '${adapter.name}' does not support ${opts.scope} scope.`);
  }

  const files: Record<string, string> = {};
  const written: string[] = [];

  const rulesDir = join(opts.packageRoot, 'rules');
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    const body = readFileSync(join(rulesDir, file), 'utf8');
    const key = relKey('.jig', file);
    writeFile(opts.projectRoot, key, vendorHeader(file, opts.version) + body, files);
    written.push(key);
  }

  for (const [src, key] of [
    ['rules.index.json', relKey('.jig', 'rules.index.json')],
    ['LICENSE', relKey('.jig', 'LICENSE')],
    ['NOTICE', relKey('.jig', 'NOTICE')],
  ] as const) {
    writeFile(opts.projectRoot, key, readFileSync(join(opts.packageRoot, src), 'utf8'), files);
    written.push(key);
  }

  const skillBody = buildSkillBody(opts.packageRoot);
  for (const file of skillFilesFor(adapter, {
    version: opts.version,
    scope: opts.scope,
    skillBody,
    commandPrefix: '/jig ',
  })) {
    // Adapter relPaths are already POSIX-style (see AdapterContext docs), so they
    // double as manifest keys as-is.
    const key = file.relPath;
    const abs = join(opts.projectRoot, ...key.split('/'));
    const isBlockFile = file.content.includes('<!-- jig:start -->');
    const content = isBlockFile && existsSync(abs)
      ? upsertBlock(readFileSync(abs, 'utf8'), file.content)
      : file.content;
    writeFile(opts.projectRoot, key, content, files);
    written.push(key);
  }

  const manifest: Manifest = {
    version: opts.version,
    agent: opts.agent,
    scope: opts.scope,
    installedAt: new Date().toISOString(),
    files,
  };
  writeManifest(opts.projectRoot, manifest);
  written.push(relKey('.jig', 'manifest.json'));

  return { written, skipped: [] };
}
