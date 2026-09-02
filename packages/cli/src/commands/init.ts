import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveInstalled } from '../install/target.js';
import { detect, type DetectionResult } from '../init/detect.js';
import { deriveBrandColor, type ColorProposal } from '../init/derive.js';
import { validateBrandColor, type ValidationResult } from '../init/validate.js';
import { renderBrandFile, brandFileName } from '../init/brand-file.js';
import { relativeImportPath } from '../init/import-path.js';
import { deriveProjectSlug } from '../init/project-name.js';
import { readInitManifest, writeInitManifest, isInitFileModified, checksum } from '../init/state.js';
import { relKey } from './install.js';
import { check } from './check.js';
import { extractColorComponents } from '../check/color.js';

const MODES = ['editorial', 'product', 'operator'] as const;
type Mode = (typeof MODES)[number];

export interface Surface {
  match: string;
  mode: Mode;
}

const DEFAULT_SURFACES: Surface[] = [{ match: '/', mode: 'product' }];

export interface InitOptions {
  projectRoot: string;
  packageRoot: string;
  homeDir: string;
  version: string;
  /** Non-interactive: derive everything, accept the proposal, ask nothing. */
  yes: boolean;
  /** Asks one question and returns the trimmed answer. Defaults to a real
   *  `readline/promises` prompt against stdin/stdout — injectable so this
   *  command is testable without a real TTY. Never called when `yes`. */
  prompt?: (question: string) => Promise<string>;
  /** Status line sink. Defaults to `console.log`. Injectable for tests. */
  log?: (line: string) => void;
}

type FileAction = 'written' | 'skipped-untracked' | 'skipped-edited' | 'kept' | 'merged';

export interface InitResult {
  detection: DetectionResult;
  proposal: ColorProposal;
  validation: ValidationResult;
  finalColor: { h: number; s: number; l: number };
  surfaces: Surface[];
  brand: { relPath: string; action: FileAction };
  config: { relPath: string; action: FileAction };
  wiring: { target: string | null; status: 'wired' | 'already-present' | 'print-only'; snippet: string };
  baseline: { report: string; findingsCount: number };
}

async function defaultPrompt(question: string): Promise<string> {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export function describeValidation(v: ValidationResult): string[] {
  const lines: string[] = [];
  if (v.passesContrast) {
    lines.push(
      `  contrast OK — ${v.ratioVsRaised.toFixed(2)}:1 vs --color-bg-raised, ${v.ratioVsFill.toFixed(2)}:1 vs --color-fill (floor 4.5:1)`,
    );
  } else {
    lines.push(
      `  contrast FAILS — worst is ${v.worstRatio.toFixed(2)}:1 against the 4.5:1 floor ` +
        `(${v.ratioVsRaised.toFixed(2)}:1 vs --color-bg-raised, ${v.ratioVsFill.toFixed(2)}:1 vs --color-fill)`,
    );
    if (v.nearestPassingLightness !== undefined) {
      lines.push(`  nearest passing lightness at the same hue/saturation: ${v.nearestPassingLightness}%`);
    }
  }
  if (v.violetBand) {
    lines.push(
      '  A-01: this hue falls in the violet/indigo band — the unspecified-default hue. Confirm this was a deliberate choice.',
    );
  }
  if (v.systemCollision) {
    lines.push(
      `  E-64: this hue reads as ${v.systemCollision} — a system colour. Do not use it for interactive elements ` +
        '(links, buttons); keep it decorative.',
    );
  }
  return lines;
}

export function parseSurfaces(answer: string, fallback: Surface[]): Surface[] {
  const trimmed = answer.trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  const parsed: Surface[] = [];
  for (const part of parts) {
    const idx = part.lastIndexOf(':');
    if (idx === -1) return fallback;
    const match = part.slice(0, idx).trim();
    const mode = part.slice(idx + 1).trim() as Mode;
    if (!match || !MODES.includes(mode)) return fallback;
    parsed.push({ match, mode });
  }
  return parsed.length > 0 ? parsed : fallback;
}

interface FileState {
  existsOnDisk: boolean;
  tracked: boolean;
  modified: boolean;
}

function fileState(projectRoot: string, absPath: string, relPath: string, initManifest: ReturnType<typeof readInitManifest>): FileState {
  const existsOnDisk = existsSync(absPath);
  const tracked = !!initManifest && relPath in initManifest.files;
  const modified = tracked && isInitFileModified(projectRoot, relPath, initManifest!);
  return { existsOnDisk, tracked, modified };
}

function findWireTarget(d: DetectionResult): string | null {
  if (d.cssSystem === 'tailwind-v4' && d.tailwindV4EntryFile) return d.tailwindV4EntryFile;
  if (d.cssFiles.length === 1) return d.cssFiles[0];
  return null;
}

function wireImport(absPath: string, brandImport: string, modeImport: string): 'wired' | 'already-present' {
  const content = existsSync(absPath) ? readFileSync(absPath, 'utf8') : '';
  const importLine = `@import "${brandImport}";`;
  if (content.includes(importLine)) return 'already-present';

  const lines = `@import "${brandImport}";\n@import "${modeImport}";\n`;
  const tailwindImportMatch = /@import\s+["']tailwindcss["'];?\r?\n?/.exec(content);
  let next: string;
  if (tailwindImportMatch) {
    const idx = tailwindImportMatch.index + tailwindImportMatch[0].length;
    next = content.slice(0, idx) + lines + content.slice(idx);
  } else {
    next = content ? `${lines}\n${content}` : lines;
  }
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, next, 'utf8');
  return 'wired';
}

/**
 * Sets a project up to actually use Jig: derives a brand colour from what
 * already exists (or falls back to the unbranded default), validates it
 * against `brand.default.css`'s own stated contract, writes
 * `.jig/tokens/brand.<project>.css` and `jig.config.json`, wires or prints
 * the `@import`, and runs a baseline `check`.
 *
 * Requires an existing install (`resolveInstalled`) — the brand file's
 * `@import` and the baseline check both depend on the vendored mode files
 * and rules already being present.
 */
export async function init(opts: InitOptions): Promise<InitResult> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const prompt = opts.prompt ?? defaultPrompt;

  const resolved = resolveInstalled(opts.projectRoot, opts.homeDir);
  if (!resolved) {
    throw new Error(`Jig is not installed in ${opts.projectRoot}. Run 'jig install --agent <name>' first.`);
  }

  // ---- 1. Detect ----
  const detection = detect(opts.projectRoot);
  log(`Detected: ${detection.cssSystem}${detection.framework ? ` (${detection.framework})` : ''}`);
  if (detection.cssFiles.length === 0) {
    log('  No stylesheets found.');
  } else {
    log(`  ${detection.cssFiles.length} stylesheet(s) found.`);
  }

  // ---- 2 & 3. Derive + validate ----
  let proposal = deriveBrandColor(opts.projectRoot, detection.cssFiles, detection.tailwindConfigFile);
  let validation = validateBrandColor(proposal.h, proposal.s, proposal.l);
  log(`Proposed brand colour: hsl(${proposal.h} ${proposal.s}% ${proposal.l}%) — ${proposal.detail}`);
  for (const line of describeValidation(validation)) log(line);

  // ---- 4. Ask only what cannot be derived ----
  let surfaces = DEFAULT_SURFACES;
  if (!opts.yes) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const answer = await prompt(
        `Use this brand colour? [Y/n, or paste a hex to override]: `,
      );
      const normalized = answer.toLowerCase();
      if (normalized === '' || normalized === 'y' || normalized === 'yes') break;
      if (normalized === 'n' || normalized === 'no') break; // proceed with the derived proposal anyway — nothing else to fall back to interactively
      const comps = extractColorComponents(answer, {});
      if (!comps) {
        log(`  Could not parse '${answer}' as a colour — keeping the proposal.`);
        break;
      }
      proposal = { h: comps.hsl.h, s: comps.hsl.s, l: comps.hsl.l, source: 'default', detail: `user-provided: ${answer}` };
      validation = validateBrandColor(proposal.h, proposal.s, proposal.l);
      log(`Brand colour: hsl(${proposal.h} ${proposal.s}% ${proposal.l}%)`);
      for (const line of describeValidation(validation)) log(line);
    }

    const surfaceAnswer = await prompt(
      `Surface → mode mapping. Enter to accept '/' → product, or 'match:mode,match:mode' ` +
        `(modes: ${MODES.join('/')}): `,
    );
    surfaces = parseSurfaces(surfaceAnswer, DEFAULT_SURFACES);
  }

  const finalColor = { h: proposal.h, s: proposal.s, l: proposal.l };

  // ---- 5. Write ----
  const projectSlug = deriveProjectSlug(opts.projectRoot);
  const brandRelPath = relKey('.jig', 'tokens', brandFileName(projectSlug));
  const brandAbsPath = join(opts.projectRoot, '.jig', 'tokens', brandFileName(projectSlug));
  const configRelPath = 'jig.config.json';
  const configAbsPath = join(opts.projectRoot, configRelPath);

  const initManifest = readInitManifest(opts.projectRoot);
  const files: Record<string, string> = { ...(initManifest?.files ?? {}) };

  const brandState = fileState(opts.projectRoot, brandAbsPath, brandRelPath, initManifest);
  const configState = fileState(opts.projectRoot, configAbsPath, configRelPath, initManifest);

  let brandAction: FileAction = 'written';
  if (brandState.existsOnDisk && !brandState.tracked) brandAction = 'skipped-untracked';
  else if (brandState.modified) brandAction = 'skipped-edited';

  let configAction: FileAction = 'written';
  if (configState.existsOnDisk && !configState.tracked) configAction = 'skipped-untracked';
  else if (configState.modified) configAction = 'skipped-edited';

  if (!opts.yes && (brandAction !== 'written' || configAction !== 'written')) {
    if (brandAction !== 'written') {
      log(`\n${brandRelPath} already exists and was not created by 'jig init' (or has been edited).`);
      const answer = (await prompt(`  [k]eep it, or [r]efresh it with the freshly derived colour? [k/r]: `)).toLowerCase();
      brandAction = answer.startsWith('r') ? 'written' : 'kept';
    }
    if (configAction !== 'written') {
      log(`\n${configRelPath} already exists and was not created by 'jig init' (or has been edited).`);
      const answer = (
        await prompt(`  [k]eep it, [r]efresh it, or [m]erge (keep your surfaces, only fix a missing brand path)? [k/r/m]: `)
      ).toLowerCase();
      configAction = answer.startsWith('r') ? 'written' : answer.startsWith('m') ? 'merged' : 'kept';
    }
  } else {
    if (brandAction !== 'written') log(`  ${brandRelPath} exists and is not jig-tracked — leaving it alone (re-run without --yes to refresh).`);
    if (configAction !== 'written') log(`  ${configRelPath} exists and is not jig-tracked — leaving it alone (re-run without --yes to refresh).`);
  }

  if (brandAction === 'written') {
    const defaultCssRaw = readFileSync(join(opts.packageRoot, 'tokens', 'brand.default.css'), 'utf8');
    const content = renderBrandFile(defaultCssRaw, projectSlug, opts.version, proposal);
    mkdirSync(dirname(brandAbsPath), { recursive: true });
    writeFileSync(brandAbsPath, content, 'utf8');
    files[brandRelPath] = checksum(content);
  }

  if (configAction === 'written') {
    const config = { brand: brandRelPath, surfaces };
    const content = `${JSON.stringify(config, null, 2)}\n`;
    writeFileSync(configAbsPath, content, 'utf8');
    files[configRelPath] = checksum(content);
  } else if (configAction === 'merged') {
    let existing: { brand?: unknown; surfaces?: unknown } = {};
    try {
      existing = JSON.parse(readFileSync(configAbsPath, 'utf8'));
    } catch {
      existing = {};
    }
    const existingBrand = typeof existing.brand === 'string' ? existing.brand : undefined;
    const brandStillResolves = existingBrand ? existsSync(join(opts.projectRoot, ...existingBrand.split('/'))) : false;
    const merged = {
      brand: brandStillResolves ? existingBrand : brandRelPath,
      surfaces: Array.isArray(existing.surfaces) && existing.surfaces.length > 0 ? existing.surfaces : surfaces,
    };
    const content = `${JSON.stringify(merged, null, 2)}\n`;
    writeFileSync(configAbsPath, content, 'utf8');
    files[configRelPath] = checksum(content);
  }

  writeInitManifest(opts.projectRoot, { files });

  // ---- Wire or print the import ----
  const primaryMode = surfaces[0]?.mode ?? 'product';
  const modeAbsPath = join(resolved.installRoot, '.jig', 'tokens', `mode.${primaryMode}.css`);
  const wireTarget = findWireTarget(detection);

  let wiring: InitResult['wiring'];
  if (wireTarget) {
    const targetAbsDir = dirname(join(opts.projectRoot, wireTarget));
    const brandImport = relativeImportPath(targetAbsDir, brandAbsPath);
    const modeImport = relativeImportPath(targetAbsDir, modeAbsPath);
    const status = wireImport(join(opts.projectRoot, wireTarget), brandImport, modeImport);
    wiring = { target: wireTarget, status, snippet: `@import "${brandImport}";\n@import "${modeImport}";` };
    log(`\n${status === 'wired' ? 'Wired' : 'Already present in'} ${wireTarget}:`);
    log(`  ${wiring.snippet.split('\n').join('\n  ')}`);
  } else {
    const brandImport = relativeImportPath(opts.projectRoot, brandAbsPath);
    const modeImport = relativeImportPath(opts.projectRoot, modeAbsPath);
    const snippet = `@import "${brandImport}";\n@import "${modeImport}";`;
    wiring = { target: null, status: 'print-only', snippet };
    log(
      `\nCould not find a single unambiguous stylesheet to wire the import into. Add this near the top of your ` +
        `global stylesheet (paths shown relative to the project root — adjust to wherever you paste them):`,
    );
    log(`  ${snippet.split('\n').join('\n  ')}`);
  }

  // ---- 6. Baseline ----
  const baselineResult = check({ projectRoot: opts.projectRoot, homeDir: opts.homeDir, version: opts.version, all: true, ci: false });
  log('\nBaseline:');
  log(baselineResult.report);

  return {
    detection,
    proposal,
    validation,
    finalColor,
    surfaces,
    brand: { relPath: brandRelPath, action: brandAction },
    config: { relPath: configRelPath, action: configAction },
    wiring,
    baseline: { report: baselineResult.report, findingsCount: baselineResult.findings.length },
  };
}
