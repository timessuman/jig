import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectFiles } from '../check/files.js';
import { isReaderText } from '../check/ext.js';
import { readMetadata, isWholeDocument, DESCRIPTION_BUDGET, TITLE_BUDGET } from '../check/metadata.js';

/**
 * `jig seo` — the checks no single file can settle.
 *
 * `check` reads a file at a time, and three of the things that go wrong here are
 * facts about the whole project: a route that says `noindex` and is listed in
 * the sitemap anyway, two pages claiming the same title, a site with no robots
 * or sitemap at all. A crawler reading two answers picks one, and it will not
 * ask which was meant.
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

/** A page's route, as a sitemap would name it: `about/index.html` → `/about`. */
function routeOf(file: string): string {
  const path = file
    .replace(/^(src|app|pages|public|content|routes)\//, '')
    .replace(/(^|\/)(index|page)\.(html?|astro|vue|svelte|[jt]sx?|md|mdx)$/i, '$1')
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
        const path = value.replace(/^https?:\/\/[^/]+/i, '') || '/';
        sitemapRoutes.set(path.replace(/\/$/, '') || '/', file);
      }
      continue;
    }
    if (ROBOTS_FILE.test(file)) { robotsFiles.push(file); continue; }
    if (!isReaderText(file)) continue;

    const found = readMetadata(raw);
    if (!found.declares && !isWholeDocument(raw)) continue;
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

  if (publicSurface && indexable.length > 0) {
    if (sitemapFiles.length === 0) {
      add('.', 'J-124', 'warning', `${indexable.length} indexable page(s) and no sitemap. A crawler then finds what it happens to link to.`);
    } else if (sitemapRoutes.size === 0) {
      add(sitemapFiles[0]!, 'J-127', 'error', 'the sitemap lists no routes. An empty sitemap is not a missing one: it is a claim that the site has nothing.');
    }
    if (robotsFiles.length === 0) {
      add('.', 'J-123', 'note', 'no robots file. Nothing is blocked by its absence, but nothing points at the sitemap either.');
    }
  }

  const titleBudget = pages.filter((p) => p.title && p.title.length > TITLE_BUDGET).length;
  const line =
    `JIG_SEO: pages=${pages.length} indexable=${indexable.length} noindex=${pages.length - indexable.length} ` +
    `sitemap=${sitemapFiles.length > 0 ? sitemapRoutes.size : 'none'} robots=${robotsFiles.length > 0 ? 'yes' : 'no'} ` +
    `overlong=${titleBudget} findings=${findings.length}`;

  return { findings, pages: pages.length, indexable: indexable.length, line };
}

export { DESCRIPTION_BUDGET, TITLE_BUDGET };
