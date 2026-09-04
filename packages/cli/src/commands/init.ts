import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { detect, type DetectionResult } from '../init/detect.js';
import {
  detectLegacyRules,
  describeLegacyReport,
  detectLegacyCursorRules,
  describeLegacyCursorReport,
  removableLegacyFiles,
  removeLegacyFiles,
  type LegacyReport,
} from '../init/migrate.js';
import { isIgnored } from '../init/gitignore.js';
import { deriveBrandColor, type ColorProposal } from '../init/derive.js';
import { validateBrandColor, type ValidationResult } from '../init/validate.js';
import { renderBrandFile, brandFileName } from '../init/brand-file.js';
import { relativeImportPath } from '../init/import-path.js';
import { deriveProjectSlug } from '../init/project-name.js';
import { readInitManifest, writeInitManifest, isInitFileModified, checksum } from '../init/state.js';
import { vendorHeader } from '../install/vendor.js';
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
  wiring: { target: string | null; status: 'wired' | 'rewired' | 'already-present' | 'print-only'; snippet: string };
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

/** M3: validates the integer h/s/l that will actually land in the written
 *  file — `renderBrandFile` (`init/brand-file.ts`) rounds every component to
 *  the nearest integer, while `derive.ts` proposes values rounded only to
 *  one decimal place. Validating the finer-grained value could in principle
 *  pass (or fail) right at the 4.5:1 boundary while the rounded value
 *  actually written does the opposite. */
function validateRounded(p: { h: number; s: number; l: number }): ValidationResult {
  return validateBrandColor(Math.round(p.h), Math.round(p.s), Math.round(p.l));
}

export function describeValidation(v: ValidationResult): string[] {
  const lines: string[] = [];
  // Both modes are reported, always. The brand file ships a dark block, so a
  // colour that clears the floor in light and fails in dark is a colour that
  // fails — and printing only the light number is how that went unnoticed.
  const modes = `light ${v.lightWorstRatio.toFixed(2)}:1, dark ${v.darkWorstRatio.toFixed(2)}:1`;
  if (v.passesContrast) {
    lines.push(
      `  contrast OK — ${modes} (floor 4.5:1; light is ${v.ratioVsRaised.toFixed(2)} vs ` +
        `--color-bg-raised and ${v.ratioVsFill.toFixed(2)} vs --color-fill)`,
    );
  } else {
    const failing = v.lightWorstRatio < v.darkWorstRatio ? 'light' : 'dark';
    lines.push(
      `  contrast FAILS in ${failing} mode — worst is ${v.worstRatio.toFixed(2)}:1 ` +
        `against the 4.5:1 floor (${modes})`,
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

function isValidSurfaceArray(v: unknown): v is Surface[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as Partial<Surface>).match === 'string' &&
        MODES.includes((s as Partial<Surface>).mode as Mode),
    )
  );
}

/**
 * I2: whatever is actually on disk at `configAbsPath` right now is
 * authoritative for wiring — regardless of whether this run just wrote it,
 * merged it, or left an existing one alone entirely untouched. Without this,
 * a kept/skipped config (correctly left intact) gets contradicted by the
 * stylesheet edit init makes right after, using the freshly-derived
 * brand/surfaces instead of what the config file actually says.
 *
 * `brand` is only trusted when it resolves to a real file — an unresolvable
 * path (typo, deleted file) falls back rather than wiring an import to
 * nothing. `surfaces` is only trusted when it is a well-formed, non-empty
 * array of `{match, mode}` pairs (see M8: a malformed/typo'd surfaces array
 * is logged as a known follow-up, not hardened further here — this is the
 * one guard needed so it can't silently produce `surfaces[0] === undefined`).
 */
function loadEffectiveConfig(
  projectRoot: string,
  configAbsPath: string,
  fallbackBrand: string,
  fallbackSurfaces: Surface[],
): { brand: string; surfaces: Surface[] } {
  if (!existsSync(configAbsPath)) return { brand: fallbackBrand, surfaces: fallbackSurfaces };
  try {
    const parsed = JSON.parse(readFileSync(configAbsPath, 'utf8')) as { brand?: unknown; surfaces?: unknown };
    const brandCandidate = typeof parsed.brand === 'string' && parsed.brand ? parsed.brand : undefined;
    const brandResolves = brandCandidate ? existsSync(join(projectRoot, ...brandCandidate.split('/'))) : false;
    return {
      brand: brandResolves ? brandCandidate! : fallbackBrand,
      surfaces: isValidSurfaceArray(parsed.surfaces) ? parsed.surfaces : fallbackSurfaces,
    };
  } catch {
    return { brand: fallbackBrand, surfaces: fallbackSurfaces };
  }
}

/** I4: a `*.module.css`/`*.module.scss` file is scoped per-component by its
 *  build tooling — a `:root`-level token import written into one is dead on
 *  arrival everywhere except that one component. Excluded here so it can
 *  never be the lone stylesheet `findWireTarget` treats as unambiguous. */
function isCssModule(path: string): boolean {
  return /\.module\.(css|scss)$/i.test(path);
}

function findWireTarget(d: DetectionResult): string | null {
  if (d.cssSystem === 'tailwind-v4' && d.tailwindV4EntryFile) return d.tailwindV4EntryFile;
  const candidates = d.cssFiles.filter((f) => !isCssModule(f));
  if (candidates.length === 1) return candidates[0];
  return null;
}

/** Matches an `@import` of any of the three mode files, regardless of the
 *  relative path prefix in front of it — this is what lets C2's rewiring
 *  find "the" mode import to compare/replace without caring how it got
 *  there (wired by this version of init, an older one, or hand-written). */
const MODE_IMPORT_RE = new RegExp(`@import\\s+["']([^"']*/)?mode\\.(${MODES.join('|')})\\.css["'];?\\r?\\n?`);

/** `@charset` is only honoured at byte 0 of a stylesheet (I3) — displaced
 *  even by one character it is silently ignored, changing decoding for a
 *  file that declares a non-UTF-8 encoding. Any insertion at "the top of
 *  the file" must land after it, not before. */
const CHARSET_RE = /^@charset\s+["'][^"']*["'];\r?\n?/;

function insertAfterCharset(content: string, insertion: string): string {
  const m = CHARSET_RE.exec(content);
  const charsetLen = m ? m[0].length : 0;
  return content.slice(0, charsetLen) + insertion + content.slice(charsetLen);
}

interface WireOutcome {
  status: 'wired' | 'rewired' | 'already-present';
  detail?: string;
}

/**
 * Wires (or rewires) the brand + mode `@import`s into `absPath`.
 *
 * C2: brand and mode presence are checked independently. Testing only the
 * brand import (as this used to) means changing the config's mode, or a
 * user hand-deleting just the mode line, both read as `already-present` —
 * a false success that leaves the stylesheet and the config permanently
 * disagreeing. When the brand import is present but the mode import is
 * either missing or names a different mode, only that one line is
 * rewritten in place; the brand import and everything else in the file is
 * left untouched.
 */
function wireImport(absPath: string, brandImport: string, modeImport: string, mode: string): WireOutcome {
  const content = existsSync(absPath) ? readFileSync(absPath, 'utf8') : '';
  const brandImportLine = `@import "${brandImport}";`;
  const modeImportLine = `@import "${modeImport}";`;
  const brandPresent = content.includes(brandImportLine);
  const existingModeMatch = MODE_IMPORT_RE.exec(content);

  if (brandPresent) {
    if (existingModeMatch && existingModeMatch[0].trim() === modeImportLine) {
      return { status: 'already-present' };
    }
    if (existingModeMatch) {
      const previousMode = existingModeMatch[2];
      const next =
        content.slice(0, existingModeMatch.index) +
        `${modeImportLine}\n` +
        content.slice(existingModeMatch.index + existingModeMatch[0].length);
      writeFileSync(absPath, next, 'utf8');
      return { status: 'rewired', detail: `rewired mode: ${previousMode} → ${mode}` };
    }
    // Brand import present, mode import missing entirely — insert one right after it.
    const brandIdx = content.indexOf(brandImportLine);
    let insertAt = brandIdx + brandImportLine.length;
    if (content[insertAt] === '\r') insertAt++;
    if (content[insertAt] === '\n') insertAt++;
    const next = content.slice(0, insertAt) + modeImportLine + '\n' + content.slice(insertAt);
    writeFileSync(absPath, next, 'utf8');
    return { status: 'rewired', detail: `added missing mode import: ${mode}` };
  }

  const lines = `${brandImportLine}\n${modeImportLine}\n`;
  const tailwindImportMatch = /@import\s+["']tailwindcss["'];?\r?\n?/.exec(content);
  let next: string;
  if (tailwindImportMatch) {
    const idx = tailwindImportMatch.index + tailwindImportMatch[0].length;
    next = content.slice(0, idx) + lines + content.slice(idx);
  } else {
    next = insertAfterCharset(content, content ? `${lines}\n` : lines);
  }
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, next, 'utf8');
  return { status: 'wired' };
}

/**
 * Sets a project up to actually use Jig: derives a brand colour from what
 * already exists (or falls back to the unbranded default), validates it
 * against `brand.default.css`'s own stated contract, writes
 * `.jig/tokens/brand.<project>.css` (plus a `.jig/tokens/<mode>.css` copy
 * per mode the config declares) and `jig.config.json`, wires or prints the
 * `@import`, and runs a baseline `check`.
 *
 * Does NOT require a prior `jig install` — since 0.4.0 nothing `init` writes
 * depends on an install being present (the mode files it copies come
 * straight from `opts.packageRoot`, and `check`'s baseline run reads its
 * rules from there too). Running `install` first is still the documented
 * flow (it is what gets the skill/rules in front of the agent at all), but
 * `init` no longer errors out if you run it first.
 */
export async function init(opts: InitOptions): Promise<InitResult> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const prompt = opts.prompt ?? defaultPrompt;

  // ---- 0. Migration: report + consent-gated removal, shared by every
  // legacy layout `init` knows about (a pre-0.4.0 project with rule files
  // vendored directly into .jig/, and a pre-harness-table Cursor install at
  // .cursor/rules/jig.mdc — see ../init/migrate.ts). Never removes a file
  // the user has edited, and never removes anything without consent. ----
  const migrateLegacy = async (report: LegacyReport, describe: (r: LegacyReport) => string[]) => {
    if (!report.present) return;
    for (const line of describe(report)) log(line);
    const removable = removableLegacyFiles(report);
    if (removable.length === 0) return;
    if (opts.yes) {
      log('  Re-run without --yes to be prompted for removal, or delete them yourself.');
      return;
    }
    const answer = (
      await prompt(`  Remove these ${removable.length} unedited legacy file(s)? [y/N]: `)
    ).toLowerCase();
    if (answer === 'y' || answer === 'yes') {
      removeLegacyFiles(opts.projectRoot, removable);
      log(`  Removed ${removable.length} file(s).`);
    } else {
      log('  Left them in place.');
    }
  };

  await migrateLegacy(detectLegacyRules(opts.projectRoot), describeLegacyReport);
  // Cursor moved from .cursor/rules/jig.mdc to .cursor/skills/jig/SKILL.md
  // (the shared <harness>/skills/<name>/ convention) — a breaking change
  // for anyone who already installed Cursor support, so it gets the same
  // report-and-offer treatment as the .jig/ migration above.
  await migrateLegacy(detectLegacyCursorRules(opts.projectRoot), describeLegacyCursorReport);

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
  let validation = validateRounded(proposal);
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
      if (normalized === 'n' || normalized === 'no') break; // the post-loop contract check below offers the passing alternative, if one exists — see I1
      const comps = extractColorComponents(answer, {});
      if (!comps) {
        log(`  Could not parse '${answer}' as a colour — keeping the proposal.`);
        break;
      }
      proposal = { h: comps.hsl.h, s: comps.hsl.s, l: comps.hsl.l, source: 'default', detail: `user-provided: ${answer}` };
      validation = validateRounded(proposal);
      log(`Brand colour: hsl(${proposal.h} ${proposal.s}% ${proposal.l}%)`);
      for (const line of describeValidation(validation)) log(line);
    }

    const surfaceAnswer = await prompt(
      `Surface → mode mapping. Enter to accept '/' → product, or 'match:mode,match:mode' ` +
        `(modes: ${MODES.join('/')}): `,
    );
    surfaces = parseSurfaces(surfaceAnswer, DEFAULT_SURFACES);
    // M8: `parseSurfaces` falls back to `DEFAULT_SURFACES` (by reference) on
    // any malformed entry — a single typo'd mode name anywhere in the list
    // silently discards the whole answer with no signal. A non-empty answer
    // that produced the exact `DEFAULT_SURFACES` reference back only
    // happens via that fallback branch (the parsed-successfully path always
    // returns a freshly built array), so this check is reliable without
    // parseSurfaces needing to report failure explicitly.
    if (surfaceAnswer.trim() && surfaces === DEFAULT_SURFACES) {
      log(
        `  Could not parse '${surfaceAnswer}' as 'match:mode,match:mode' (modes: ${MODES.join('/')}) — ` +
          `using the default ('/' → product) instead.`,
      );
    }
  }

  // Tiebreaker 5: ship the plainer thing and surface the question. `--yes`
  // takes the default surface map without inferring anything, and
  // `01-modes.md` rule 1 then makes that config authoritative over inference —
  // so the default is not a neutral placeholder, it binds every agent that
  // reads the project afterwards. Two baseline runs on an `ops-console`
  // project read every signal as `operator`, found `product` here, and
  // correctly deferred to it; one noted "the density difference is expensive
  // to reverse". The brand colour already states its default and why; the mode
  // is the more consequential of the two and said nothing.
  if (opts.yes) {
    log(
      `Surface → mode: ${surfaces.map((s) => `'${s.match}' → ${s.mode}`).join(', ')} — the default, ` +
        `not inferred from this project. Mode sets density, type scale and control sizes, and it ` +
        `wins over an agent's own inference, so change it in jig.config.json if another mode fits ` +
        `(${MODES.join('/')}).`,
    );
  }

  // I1: there must be no path that writes a colour failing the contract the
  // generated brand file itself states. `--yes` used to write `proposal`
  // verbatim even when `validation.passesContrast` was false, discarding
  // the passing alternative it had already computed; interactively,
  // answering `n` (or exhausting the override attempts) had the same
  // effect. Applying the snap once, here, after every path that can produce
  // a final `proposal` — derived, `--yes`, accepted, rejected, or
  // hex-overridden — covers all of them uniformly.
  if (!validation.passesContrast && validation.nearestPassingLightness !== undefined) {
    const originalL = proposal.l;
    proposal = { ...proposal, l: validation.nearestPassingLightness };
    validation = validateRounded(proposal);
    log(
      `\nBrand colour adjusted to clear the 4.5:1 contrast floor: l:${originalL}% → l:${proposal.l}% ` +
        '(hue/saturation unchanged).',
    );
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

  // ---- I2: what actually governs wiring ----
  // Read back whatever is now on disk at `configAbsPath` — written, merged,
  // or (kept/skipped) untouched — rather than trusting the `surfaces` /
  // `brandRelPath` locals. This is what stops a correctly-preserved
  // existing config from being contradicted by the stylesheet edit below.
  const effectiveConfig = loadEffectiveConfig(opts.projectRoot, configAbsPath, brandRelPath, surfaces);
  const primaryMode = effectiveConfig.surfaces[0]?.mode ?? 'product';
  const wiringBrandAbsPath = join(opts.projectRoot, ...effectiveConfig.brand.split('/'));

  // A mode file is a build input — its `@import` is an edge in a build
  // graph that must resolve locally, on every machine that builds this
  // project, forever (a rule markdown file has no such requirement: it is
  // read once by an agent that already has its own copy from the skill
  // install). So, unlike the rules, a mode's CSS genuinely is copied —
  // deliberately, not an oversight: 0.2.1 changed `--warning-l` and
  // `--success-l` to fix a real contrast failure below the 4.5:1 floor.
  // Inlining those values into the project's own stylesheet, rather than
  // keeping a checksummed copy `update` can refresh, would mean every
  // project keeps shipping the failing colours forever, with no way for
  // `update` to know a fix is even available. One copy per mode the config
  // actually declares — never all three — tracked in the init sidecar
  // (`.jig/state.json`) under the same edit-preserving rules as the brand
  // file and config, and refreshed alongside them by `commands/update.ts`.
  const declaredModes = [...new Set(effectiveConfig.surfaces.map((s) => s.mode))];
  const modeAbsPaths: Record<string, string> = {};
  for (const mode of declaredModes) {
    const modeFileName = `mode.${mode}.css`;
    const modeAbsPath = join(opts.projectRoot, '.jig', 'tokens', modeFileName);
    modeAbsPaths[mode] = modeAbsPath;
    const modeRelPath = relKey('.jig', 'tokens', modeFileName);
    const modeState = fileState(opts.projectRoot, modeAbsPath, modeRelPath, initManifest);
    let modeAction: FileAction = 'written';
    if (modeState.existsOnDisk && !modeState.tracked) modeAction = 'skipped-untracked';
    else if (modeState.modified) modeAction = 'skipped-edited';

    if (modeAction === 'written') {
      const modeSourceRaw = readFileSync(join(opts.packageRoot, 'tokens', modeFileName), 'utf8');
      const content = vendorHeader(modeFileName, opts.version, 'css', null) + modeSourceRaw;
      mkdirSync(dirname(modeAbsPath), { recursive: true });
      writeFileSync(modeAbsPath, content, 'utf8');
      files[modeRelPath] = checksum(content);
    } else {
      log(`  ${modeRelPath} exists and is not jig-tracked (or has been edited) — leaving it alone (re-run 'jig update' to refresh it).`);
    }
  }
  const modeAbsPath = modeAbsPaths[primaryMode]!;

  writeInitManifest(opts.projectRoot, { version: opts.version, modes: declaredModes, files });

  // ---- Wire or print the import ----
  const wireTarget = findWireTarget(detection);

  let wiring: InitResult['wiring'];
  if (wireTarget) {
    const targetAbsDir = dirname(join(opts.projectRoot, wireTarget));
    const brandImport = relativeImportPath(targetAbsDir, wiringBrandAbsPath);
    const modeImport = relativeImportPath(targetAbsDir, modeAbsPath);
    const snippet = `@import "${brandImport}";\n@import "${modeImport}";`;
    // I8: an unwritable stylesheet (permissions, read-only mount, ...) must
    // not abort the run — fall back to the print-only snippet and still run
    // the baseline below, the same as the "ambiguous target" case.
    try {
      const outcome = wireImport(join(opts.projectRoot, wireTarget), brandImport, modeImport, primaryMode);
      wiring = { target: wireTarget, status: outcome.status, snippet };
      const verb = outcome.status === 'wired' ? 'Wired' : outcome.status === 'rewired' ? 'Rewired' : 'Already present in';
      log(`\n${verb} ${wireTarget}:`);
      if (outcome.detail) log(`  ${outcome.detail}`);
      log(`  ${snippet.split('\n').join('\n  ')}`);
    } catch (err) {
      wiring = { target: null, status: 'print-only', snippet };
      log(`\nCould not write to ${wireTarget}: ${(err as Error).message}`);
      log('Add this near the top of your global stylesheet instead (adjust the path to wherever you paste it):');
      log(`  ${snippet.split('\n').join('\n  ')}`);
    }
  } else {
    const brandImport = relativeImportPath(opts.projectRoot, wiringBrandAbsPath);
    const modeImport = relativeImportPath(opts.projectRoot, modeAbsPath);
    const snippet = `@import "${brandImport}";\n@import "${modeImport}";`;
    wiring = { target: null, status: 'print-only', snippet };
    log('\nCould not find a single unambiguous stylesheet to wire the import into.');

    // A CSS `@import` resolves relative to the file it sits in, so a snippet
    // written from the project root is wrong by exactly the depth of wherever
    // it gets pasted — and "adjust the path" left the user to work that out.
    // The candidate stylesheets are already known here, so print a
    // ready-to-paste block for each rather than one that is right nowhere in
    // particular.
    const pasteTargets = detection.cssFiles.filter((f) => !isCssModule(f));
    if (pasteTargets.length > 0) {
      log('Paste the block for whichever of these is your global stylesheet:');
      for (const target of pasteTargets) {
        const dir = dirname(join(opts.projectRoot, target));
        const forTarget =
          `@import "${relativeImportPath(dir, wiringBrandAbsPath)}";\n` +
          `@import "${relativeImportPath(dir, modeAbsPath)}";`;
        log(`\n  ${target}:`);
        log(`    ${forTarget.split('\n').join('\n    ')}`);
      }
    } else {
      log(
        'Add this near the top of your global stylesheet. A CSS @import resolves ' +
          'relative to the file it sits in, so these project-root paths need a ../ ' +
          'per directory of depth:',
      );
      log(`  ${snippet.split('\n').join('\n  ')}`);
    }
  }

  // `.jig/` holds the token files a teammate's build and a CI `jig check` both
  // depend on. Gitignored, the system silently does not exist for anyone who
  // did not run `init` themselves — the stylesheet `@import`s dangle, and the
  // first sign is a broken build on someone else's machine. Say so here, where
  // the files have just been written and the fix is one line in .gitignore.
  if (isIgnored(opts.projectRoot, '.jig')) {
    log(
      '\n  WARNING: .jig/ is gitignored, but it holds this project\'s tokens — ' +
        'the files your stylesheet @imports. Committed, teammates and CI get the ' +
        'same design system; ignored, their builds break on a missing import. ' +
        'Remove the .jig/ rule from .gitignore, or commit the directory explicitly.',
    );
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
    // I2: report the surfaces that actually govern wiring (effectiveConfig),
    // not the freshly-derived/prompted `surfaces` local — the two differ
    // exactly when an existing config was kept, and this field should
    // describe what happened, not what would have happened on a fresh write.
    surfaces: effectiveConfig.surfaces,
    brand: { relPath: brandRelPath, action: brandAction },
    config: { relPath: configRelPath, action: configAction },
    wiring,
    baseline: { report: baselineResult.report, findingsCount: baselineResult.findings.length },
  };
}
