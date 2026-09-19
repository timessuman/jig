import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectFiles } from '../check/files.js';
import { readMetadata, isWholeDocument, DESCRIPTION_BUDGET, TITLE_BUDGET } from '../check/metadata.js';

/**
 * `jig seo` — the checks no single file can settle.
 *
 * `check` reads a file at a time, and the things that go wrong here are facts
 * about the whole project: a route that says `noindex` and is listed in the
 * sitemap anyway, two pages claiming the same title, a sitemap a crawler cannot
 * use. A crawler reading two answers picks one, and it will not ask which was
 * meant.
 *
 * Every finding names the rule that says so. Whether a site has a sitemap or a
 * robots file at all is reported as a count, not a finding: no rule asks for
 * either, and a project with no origin yet cannot honestly write a sitemap
 * (`J-124`).
 *
 * Framework-agnostic by construction: it reads whatever declares metadata —
 * `<meta>`, a `metadata` export, `useSeoMeta`, a `meta` export, front matter —
 * and the sitemap however it is produced, XML on disk or a route that builds it.
 */
export interface SeoFinding {
  file: string;
  message: string;
  severity: 'error' | 'warning' | 'note';
  ruleId: string;
}

export interface SeoResult {
  findings: SeoFinding[];
  pages: number;
  indexable: number;
  line: string;
}

const SITEMAP_FILE = /(^|\/)sitemap(-index)?\.(xml|ts|js|mjs|tsx|jsx|rb|php|py)$/i;
const ROBOTS_FILE = /(^|\/)robots\.(txt|ts|js|mjs|tsx|jsx)$/i;
const ROUTE_IN_SITEMAP = /(?:<loc>\s*([^<\s]+)\s*<\/loc>)|(?:url\s*:\s*["'`]([^"'`]+)["'`])/gi;

// A test, a fixture or a story mentions `<title>` to check it, not to ship it.
const TEST_FILE = /(^|\/)(test|tests|__tests__|spec|e2e|fixtures?|stories)\/|\.(test|spec|stories)\.[a-z]+$/i;
// Where a framework keeps its routes: Astro and Next `pages/`, Nuxt `pages/`
// and `app/pages/`, Remix `app/routes/`, SvelteKit `src/routes/`.
const ROUTE_DIR = /(?:^|\/)(?:src\/|app\/)?(?:pages|routes)\/(.+)$/;
// A server template that carries a whole document is a page wherever it sits,
// unless it sits with the parts other pages are assembled from.
const TEMPLATE = /\.(html?|php|erb|njk|hbs|handlebars|liquid|ejs|twig|jinja2?|j2|mustache)$/i;
const PARTS_DIR = /(^|\/)_?(layouts?|components?|partials?|includes?)\//i;
const ENDPOINT = /export\s+(?:const|async\s+function|function)\s+(?:GET|POST|PUT|PATCH|DELETE|ALL)\b/;

/**
 * Whether a file is a page a crawler can reach, rather than a file that
 * mentions one. Mentioning `<title>` is not enough: a build script checking the
 * output, a test, a layout and a data module all do, and counting them made a
 * three-route site report five pages, none of them its home page.
 */
export function isPage(file: string, raw: string): boolean {
  if (TEST_FILE.test(file)) return false;
  // Next's app router: the page is the file named `page`, and its neighbours
  // (`layout`, `loading`, `route`) are not.
  if (/(^|\/)app\/(.+\/)?page\.(tsx|jsx|ts|js|mdx|md)$/.test(file)) return true;
  const route = ROUTE_DIR.exec(file);
  if (route) {
    const rest = route[1]!;
    const name = rest.split('/').pop()!;
    // SvelteKit names every route file with a `+`; only `+page.svelte` renders.
    if (name.startsWith('+')) return name === '+page.svelte';
    // An endpoint, and a framework's own shell (`_app`, `_document`, `_layout`).
    if (/(^|\/)api\//.test(rest) || name.startsWith('_')) return false;
    // `rss.xml.ts`, `[id].txt.ts`: an endpoint named for what it serves.
    if (/\.[a-z]+\.[cm]?[jt]s$/i.test(name)) return false;
    if (/\.[cm]?[jt]s$/i.test(name)) return /export\s+default\b/.test(raw) && !ENDPOINT.test(raw);
    return /\.(astro|html?|mdx?|vue|svelte|[jt]sx)$/i.test(name);
  }
  return TEMPLATE.test(file) && !PARTS_DIR.test(file) && isWholeDocument(raw);
}

/** A page's route, as a sitemap would name it: `src/pages/about.astro` → `/about`. */
function routeOf(file: string): string {
  const path = file
    .replace(/^(?:src\/pages|app\/pages|app\/routes|src\/routes|pages|routes|app|src|public|content)\//, '')
    .replace(/(^|\/)(index|\+?page)\.(html?|astro|vue|svelte|[jt]sx?|md|mdx)$/i, '$1')
    .replace(/\.(html?|astro|vue|svelte|[jt]sx?|md|mdx)$/i, '')
    .replace(/\/$/, '');
  return `/${path}`.replace(/\/+/g, '/');
}

export function seo(opts: { projectRoot: string; mode?: string }): SeoResult {
  const root = opts.projectRoot;
  const files = selectFiles(root, true).files;
  const findings: SeoFinding[] = [];
  const add = (file: string, ruleId: string, severity: SeoFinding['severity'], message: string) =>
    findings.push({ file, ruleId, severity, message });

  const pages: Array<{ file: string; route: string; title?: string; noindex: boolean }> = [];
  let sitemapFiles: string[] = [];
  let robotsFiles: string[] = [];
  const sitemapRoutes = new Map<string, string>();
  // `<loc>` values that are paths. The format asks for a full URL, and a crawler
  // drops an entry that is not one.
  const pathLocs: Array<{ file: string; loc: string }> = [];

  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(join(root, file), 'utf8');
    } catch {
      continue;
    }
    if (SITEMAP_FILE.test(file)) {
      sitemapFiles.push(file);
      for (const match of raw.matchAll(ROUTE_IN_SITEMAP)) {
        const value = (match[1] ?? match[2] ?? '').trim();
        if (!value) continue;
        if (match[1] && !/^https?:\/\//i.test(value)) pathLocs.push({ file, loc: value });
        const path = value.replace(/^https?:\/\/[^/]+/i, '') || '/';
        sitemapRoutes.set(path.replace(/\/$/, '') || '/', file);
      }
      continue;
    }
    if (ROBOTS_FILE.test(file)) { robotsFiles.push(file); continue; }
    if (!isPage(file, raw)) continue;

    const found = readMetadata(raw);
    // One title in the file is the page's. Two means one of them is a fallback
    // for a record that was not there, and which ships is a runtime question.
    const settled = found.titles.length === 1 && !found.computedTitle ? found.titles[0]!.value : undefined;
    pages.push({ file, route: routeOf(file), title: settled, noindex: found.noindex });
  }

  // A route that says noindex, listed as indexable in the same project.
  for (const page of pages.filter((p) => p.noindex)) {
    const listed = sitemapRoutes.get(page.route) ?? sitemapRoutes.get(`${page.route}/`);
    if (listed) {
      add(listed, 'J-124', 'error', `the sitemap lists ${page.route}, and ${page.file} says noindex. One answer per route: a crawler reading two picks one.`);
    }
  }

  // An entry a crawler cannot use is an entry for no page at all.
  if (pathLocs.length > 0) {
    const shown = pathLocs.slice(0, 3).map((p) => p.loc).join(', ');
    add(pathLocs[0]!.file, 'J-124', 'error', `${pathLocs.length} sitemap entr${pathLocs.length === 1 ? 'y is a path' : 'ies are paths'} (${shown}), not a full URL. A crawler drops them; with no origin yet, no sitemap is the honest one.`);
  }

  // The same title on two routes: one of them will not be the one that ranks.
  const byTitle = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.title || page.noindex) continue;
    byTitle.set(page.title, [...(byTitle.get(page.title) ?? []), page.file]);
  }
  for (const [title, where] of byTitle) {
    if (where.length > 1) {
      add(where[1]!, 'J-121', 'warning', `"${title}" is the title of ${where.length} pages (${where.join(', ')}). A result page showing the same line twice tells a reader nothing about either.`);
    }
  }

  const indexable = pages.filter((p) => !p.noindex);
  const publicSurface = opts.mode !== 'product' && opts.mode !== 'operator';

  if (publicSurface && indexable.length > 0 && sitemapFiles.length > 0 && sitemapRoutes.size === 0) {
    add(sitemapFiles[0]!, 'J-127', 'error', 'the sitemap lists no routes. An empty sitemap is not a missing one: it is a claim that the site has nothing.');
  }

  const titleBudget = pages.filter((p) => p.title && p.title.length > TITLE_BUDGET).length;
  const line =
    `JIG_SEO: pages=${pages.length} indexable=${indexable.length} noindex=${pages.length - indexable.length} ` +
    `sitemap=${sitemapFiles.length > 0 ? sitemapRoutes.size : 'none'} robots=${robotsFiles.length > 0 ? 'yes' : 'no'} ` +
    `overlong=${titleBudget} findings=${findings.length}`;

  return { findings, pages: pages.length, indexable: indexable.length, line };
}

export { DESCRIPTION_BUDGET, TITLE_BUDGET };
