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
  // Server-rendered markup. Every one of these is HTML with a template syntax
  // threaded through it, so its `<style>` blocks and `style` attributes are the
  // same constructs already handled — the template tags sit outside the style
  // regions and are blanked with the rest of the markup.
  '.asp', '.aspx', '.ascx', '.master',       // Classic ASP, ASP.NET
  '.cshtml', '.vbhtml', '.razor',            // Razor
  '.jsp', '.jspx',                           // Java
  '.eex', '.heex', '.leex',                  // Phoenix
  '.ejs', '.njk', '.liquid', '.mustache',    // Node/Jinja-family engines
  '.vm', '.ftl',                             // Velocity, FreeMarker
  '.jinja', '.jinja2', '.j2',                // Jinja
  // Indentation-delimited templates. These carry no HTML-shaped constructs at
  // all — their style regions are found by their own block markers and
  // attribute syntax instead. See `INDENTED_SYNTAXES` in styles.ts.
  '.pug', '.jade', '.haml', '.slim',
];

export function isStyleBearing(file: string): boolean {
  return hasExtension(file, CSS_EXTENSIONS) || hasExtension(file, STYLE_HOST_EXTENSIONS);
}

/** Markdown, which every static-site framework renders as pages: Astro's
 *  `src/content`, Next's MDX routes, Docusaurus, Eleventy, Hugo, Jekyll. */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdx'];

/** A repository document rather than a page: README, CHANGELOG, AGENTS,
 *  CONTRIBUTING, LICENSE, and their kin. The convention is the same in every
 *  ecosystem — an all-caps basename — so this needs no list to maintain and no
 *  framework to recognise. A page is `getting-started.md`, never `NOTES.md`. */
const REPO_DOCUMENTS = new Set([
  'readme', 'changelog', 'contributing', 'license', 'licence', 'notice',
  'code_of_conduct', 'security', 'support', 'governance', 'maintainers',
  'authors', 'agents', 'claude', 'gemini', 'copilot-instructions',
]);

export function isRepoDocument(file: string): boolean {
  const base = file.split('/').pop() ?? file;
  const name = base.replace(/\.[^.]+$/, '');
  // By name wherever it sits: a README is a README in any directory.
  if (REPO_DOCUMENTS.has(name.toLowerCase())) return true;
  // Otherwise capitals mean "document" only beside the lockfile. A docs site's
  // `docs/FAQ.md` is a page like any other, and was being skipped.
  return !file.includes('/') && /^[A-Z0-9][A-Z0-9._-]*$/.test(name);
}

/**
 * Whether this file carries text a reader of the built product sees.
 *
 * Wider than `isStyleBearing`, and deliberately so: a copy rule has to reach
 * the markdown a framework renders as a page, which carries no styles at all.
 * Narrower at the other end: a README is written for whoever works on the
 * repository, and the copy rules are not about that.
 */
export function isReaderText(file: string): boolean {
  if (hasExtension(file, MARKDOWN_EXTENSIONS)) return !isRepoDocument(file);
  return hasExtension(file, STYLE_HOST_EXTENSIONS);
}
