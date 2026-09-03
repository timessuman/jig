import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAdapter, skillFilesFor } from '../adapters/registry.js';
import { referenceFiles } from './../install/references.js';
import { BLOCK_START } from '../adapters/types.js';
import {
  checksum,
  isModified,
  readManifest,
  writeManifest,
  type Manifest,
  type Scope,
} from '../install/manifest.js';
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
  /**
   * Set, with nothing written, when this would be a project-scope install
   * for an agent that already has a global one — installing anyway would
   * leave two `jig` skills for the same harness with contradicting rule
   * paths, which is the exact failure this architecture exists to prevent.
   */
  warning?: string;
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
export function relKey(...parts: string[]): string {
  return parts.join('/');
}

function writeFile(root: string, key: string, content: string, files: Record<string, string>) {
  const abs = join(root, ...key.split('/'));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  files[key] = checksum(content);
}

/**
 * Renders the shared body of an adapter's skill/instruction file.
 *
 * `rulesPath` is the fully-resolved location — already anchored for the
 * scope this install targets (`~/`-prefixed for global, bare for project;
 * see `install()`) — of the `rules/` directory beside wherever this
 * adapter's own skill file lands. It replaces every `{{rules_path}}` in the
 * template; getting it wrong is finding C2 — a skill file that points an
 * agent at a `rules/` directory that does not exist from wherever the agent
 * actually reads the file.
 */
export function buildSkillBody(packageRoot: string, rulesPath: string): string {
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
    rules_path: rulesPath,
  });
}

/**
 * The `rules_path` template variable: where the adapter's reference bundle's
 * `rules/` directory actually lands, expressed so it resolves regardless of
 * the agent's working directory when it later reads the skill file — bare
 * (project-root-relative) for a project-scope install, `~/`-anchored
 * (home-relative) for a global one. Shared by `install` and `update` so a
 * refreshed skill file's rule paths stay in lockstep with a fresh install's.
 */
export function rulesPathFor(referenceDir: string, scope: Scope): string {
  return scope === 'global' ? `~/${referenceDir}/rules` : `${referenceDir}/rules`;
}

interface PlannedFile {
  key: string;
  content: string;
  /**
   * Whether this file participates in the "don't clobber a local edit"
   * check (finding I1). LICENSE/NOTICE are never checkable — attribution is
   * always replaced, matching `update`'s `ALWAYS_REPLACE` list. A
   * block-based skill/instruction file (`agentsBlock` output, detected via
   * `BLOCK_START`) is also never checkable: its content above already went
   * through `upsertBlock` against whatever is on disk, so the user's own
   * content survives regardless, the same way `update` always upserts a
   * block file rather than skip-checking it.
   */
  checkable: boolean;
}

export function install(opts: InstallOptions): InstallResult {
  const adapter = getAdapter(opts.agent);

  // A project install when this agent is already installed globally would
  // leave two `jig` skills registered with the same harness, with rule
  // paths that point at two different places — exactly the incoherence this
  // architecture exists to prevent. Refuse rather than silently creating a
  // second, contradictory skill; the user can update the global install
  // instead, or pick a different agent for this project.
  if (opts.scope === 'project') {
    const globalReferenceDir = adapter.referenceDir('global');
    let globalManifest: Manifest | null;
    try {
      globalManifest = readManifest(opts.homeDir, globalReferenceDir);
    } catch {
      globalManifest = null;
    }
    if (globalManifest) {
      return {
        written: [],
        skipped: [],
        warning:
          `Jig is already installed globally for '${opts.agent}' (${globalReferenceDir} under your home ` +
          `directory). Installing again at project scope would leave two contradicting '${opts.agent}' skills. ` +
          `Run 'jig update' to refresh the global install instead, or choose a different --agent for this project.`,
      };
    }
  }

  // `global` scope installs to the user's home directory, not the project
  // root the CLI happened to be invoked from. `homeDir` is supplied by the
  // caller rather than resolved here via `os.homedir()`, so this function
  // stays testable against a temp directory standing in for $HOME.
  const installRoot = opts.scope === 'global' ? opts.homeDir : opts.projectRoot;
  const referenceDir = adapter.referenceDir(opts.scope);

  // A manifest from a prior install at this root, if present, is what makes
  // a *re*-install skip a file the user has since edited (finding I1) — the
  // exact rule `update` already applies. No manifest means this is a fresh
  // install: there is nothing to skip. A manifest that fails validation
  // (see `readManifest`) is treated the same as no manifest, so a corrupted
  // manifest can always be repaired by re-running install — the very fix
  // `readManifest`'s own error message points the user at — rather than
  // install() itself refusing to run.
  let existingManifest: Manifest | null;
  try {
    existingManifest = readManifest(installRoot, referenceDir);
  } catch {
    existingManifest = null;
  }

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

  // The reference bundle: rules, the index that describes them, and
  // attribution. Lives beside the skill file at `referenceDir` — never in
  // the project's own `.jig/`, which since 0.4.0 install never touches at
  // all. Tokens are NOT part of this bundle: they are Jig's property (the
  // default brand, all three mode files) and no one reads them from here —
  // `init` copies only the modes a project actually declares, straight from
  // the package, into the project's own `.jig/tokens/`.
  const rulesDir = join(opts.packageRoot, 'rules');
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    const body = readFileSync(join(rulesDir, file), 'utf8');
    planned.push({
      key: relKey(referenceDir, 'rules', file),
      content: vendorHeader(file, opts.version) + body,
      checkable: true,
    });
  }
  // References — `references/**` in the package — ship beside the rules for the
  // same reason the rules do: an agent reads them. Their subdirectory shape is
  // preserved, so `references/commands/init.md` installs as
  // `<referenceDir>/commands/init.md`.
  for (const ref of referenceFiles(opts.packageRoot)) {
    planned.push({
      key: relKey(referenceDir, ...ref.relPath.split('/')),
      content: vendorHeader(ref.relPath, opts.version) + ref.content,
      checkable: true,
    });
  }
  planned.push({
    key: relKey(referenceDir, 'rules.index.json'),
    content: readFileSync(join(opts.packageRoot, 'rules.index.json'), 'utf8'),
    checkable: true,
  });
  for (const src of ['LICENSE', 'NOTICE'] as const) {
    planned.push({
      key: relKey(referenceDir, src),
      content: readFileSync(join(opts.packageRoot, src), 'utf8'),
      checkable: false,
    });
  }

  const rulesPath = rulesPathFor(referenceDir, opts.scope);
  const skillBody = buildSkillBody(opts.packageRoot, rulesPath);
  const skillFiles = skillFilesFor(adapter, {
    version: opts.version,
    scope: opts.scope,
    skillBody,
    commandPrefix: '/jig ',
  });
  for (const file of skillFiles) {
    const key = file.relPath;
    const abs = join(installRoot, ...key.split('/'));
    const isBlockFile = file.content.includes(BLOCK_START);
    const content = isBlockFile && existsSync(abs)
      ? upsertBlock(readFileSync(abs, 'utf8'), file.content)
      : file.content;
    planned.push({ key, content, checkable: !isBlockFile });
  }

  // ---- Phase 2: commit. Every input above was read successfully, so it is
  // now safe to start writing. A checkable file that the user has edited
  // since the prior install (per the existing manifest's recorded checksum)
  // is left alone rather than clobbered — the vendor header on every
  // vendored file promises exactly this. Its previously recorded checksum
  // is carried forward unchanged in the new manifest, so it stays flagged
  // as user-modified (and therefore keeps being skipped) until the user's
  // content happens to match a vendored version again. ----
  const files: Record<string, string> = {};
  const written: string[] = [];
  const skipped: string[] = [];
  for (const { key, content, checkable } of planned) {
    if (existingManifest && checkable && isModified(installRoot, key, existingManifest)) {
      skipped.push(key);
      const recorded = existingManifest.files[key];
      if (recorded) files[key] = recorded;
      continue;
    }
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
  writeManifest(installRoot, manifest, referenceDir);
  written.push(relKey(referenceDir, 'manifest.json'));

  return { written, skipped };
}
