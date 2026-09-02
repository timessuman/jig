import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wholeRepoFiles } from '../check/files.js';
import { CSS_EXTENSIONS, hasExtension } from '../check/ext.js';

export type CssSystem = 'tailwind-v4' | 'tailwind-v3' | 'plain-css' | 'unknown';

const TAILWIND_CONFIG_RE = /^tailwind\.config\.(js|ts|mjs|cjs)$/;
const TAILWIND_V4_IMPORT_RE = /@import\s+["']tailwindcss["']/;
const TAILWIND_V4_THEME_RE = /@theme\b/;

export interface DetectionResult {
  cssSystem: CssSystem;
  /** Repo-relative, forward-slash paths of every `.css`/`.scss`/`.less` file
   *  found (excluding `node_modules`, `dist`, `.git`, `.jig` — see
   *  `wholeRepoFiles`). Empty when the project has no stylesheets at all. */
  cssFiles: string[];
  /** Repo-relative path to a `tailwind.config.*`, when one exists. */
  tailwindConfigFile?: string;
  /** Repo-relative path to the CSS file that carries `@import "tailwindcss"`
   *  or `@theme`, when `cssSystem === 'tailwind-v4'`. This is the
   *  unambiguous wiring target for that case. */
  tailwindV4EntryFile?: string;
  /** Best-effort framework name read off `package.json` dependencies. Purely
   *  informational — nothing downstream branches on it. `undefined` when no
   *  `package.json` is found or nothing recognizable is listed. */
  framework?: string;
}

const FRAMEWORK_DEPS: [dep: string, label: string][] = [
  ['next', 'Next.js'],
  ['nuxt', 'Nuxt'],
  ['@remix-run/react', 'Remix'],
  ['astro', 'Astro'],
  ['svelte', 'Svelte'],
  ['vue', 'Vue'],
  ['react', 'React'],
  ['solid-js', 'Solid'],
];

function detectFramework(projectRoot: string): string | undefined {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [dep, label] of FRAMEWORK_DEPS) {
    if (deps[dep]) return label;
  }
  return undefined;
}

/**
 * Detects the project's CSS system and (best-effort) framework. Never
 * guesses silently — every branch below is reported back on
 * `DetectionResult` so `init` can print exactly what it found and why.
 *
 * Priority, most to least specific:
 *   1. Tailwind v4 — a CSS file with `@import "tailwindcss"` or a `@theme` block.
 *   2. Tailwind v3 — a `tailwind.config.{js,ts,mjs,cjs}` at any depth.
 *   3. Plain CSS — at least one stylesheet, neither of the above.
 *   4. Unknown — no stylesheets and no Tailwind config found at all.
 */
export function detect(projectRoot: string): DetectionResult {
  const allFiles = wholeRepoFiles(projectRoot);
  const cssFiles = allFiles.filter((f) => hasExtension(f, CSS_EXTENSIONS));

  const tailwindConfigFile = allFiles.find((f) => TAILWIND_CONFIG_RE.test(f.split('/').pop() ?? ''));

  let tailwindV4EntryFile: string | undefined;
  for (const f of cssFiles) {
    let source: string;
    try {
      source = readFileSync(join(projectRoot, f), 'utf8');
    } catch {
      continue;
    }
    if (TAILWIND_V4_IMPORT_RE.test(source) || TAILWIND_V4_THEME_RE.test(source)) {
      tailwindV4EntryFile = f;
      break;
    }
  }

  let cssSystem: CssSystem;
  if (tailwindV4EntryFile) cssSystem = 'tailwind-v4';
  else if (tailwindConfigFile) cssSystem = 'tailwind-v3';
  else if (cssFiles.length > 0) cssSystem = 'plain-css';
  else cssSystem = 'unknown';

  return { cssSystem, cssFiles, tailwindConfigFile, tailwindV4EntryFile, framework: detectFramework(projectRoot) };
}
