/** Extensions that are wholly CSS. A file with one of these is handed to the
 * detectors as-is. */
export const CSS_EXTENSIONS = ['.css', '.scss', '.less'];

export function hasExtension(file: string, exts: readonly string[]): boolean {
  const lower = file.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

/**
 * Whether the detector suite reads this file at all: a plain stylesheet, or a
 * host language whose style regions are extracted first (see ./styles.ts).
 *
 * Detectors use this rather than `CSS_EXTENSIONS` directly, so adding a host
 * language is one entry in `STYLE_HOST_EXTENSIONS` and reaches all of them.
 */
export const STYLE_HOST_EXTENSIONS = [
  '.html', '.htm', '.vue', '.svelte', '.astro',
  '.jsx', '.tsx', '.js', '.ts', '.mjs', '.cjs', '.mts', '.cts',
  '.php', '.erb', '.twig', '.hbs', '.mdx',
];

export function isStyleBearing(file: string): boolean {
  return hasExtension(file, CSS_EXTENSIONS) || hasExtension(file, STYLE_HOST_EXTENSIONS);
}
