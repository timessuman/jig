/**
 * Where a page's metadata lives, per framework.
 *
 * Nobody writes `<meta name="description">` any more except in a plain document
 * and a server-rendered template. Everywhere else it is a `metadata` export, a
 * `useSeoMeta` call, a `<svelte:head>` block, a `meta` export or front matter,
 * and a page may inherit all of it from a layout. So absence is only decidable
 * for a document that carries its own `<head>`; everywhere else this reads the
 * values it can see and leaves "missing" to the render (see probe/check.ts).
 */
export interface MetadataStrings {
  title?: { value: string; index: number };
  description?: { value: string; index: number };
  /** Every title string in the file. A route that returns one title for a
   *  record and another when the record is missing declares two, and which one
   *  ships is a runtime question — so a file with more than one is not evidence
   *  of anything a reader will see. */
  titles: Array<{ value: string; index: number }>;
  /** Whether a title exists at all, computed or written. A layout's
   *  `<title>{title}</title>` is a title; it is simply not a value this can
   *  read, and absence and value are different questions. */
  hasTitle: boolean;
  hasDescription: boolean;
  /** Any construct that declares metadata at all, framework included. */
  declares: boolean;
  /** A title built from a value rather than written: `title: post.title`. The
   *  literal strings in such a file are fallbacks, and what ships is a runtime
   *  question — so the file cannot be compared with another. */
  computedTitle: boolean;
  /** Any form of "do not index this". */
  noindex: boolean;
}

const QUOTED = `(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`)`;

/** `<title>x</title>` and `<meta name="description" content="x">`. */
const HTML_TITLE = /<title[^>]*>([\s\S]*?)<\/title\s*>/i;
const HTML_DESCRIPTION = /<meta[^>]+name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i;
const HTML_DESCRIPTION_REVERSED = /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i;

/** Next (`export const metadata`), Nuxt (`useSeoMeta`), Remix/React Router
 *  (`meta`), SvelteKit (`<svelte:head>`), Astro and Hugo/Jekyll front matter. */
const KEYED_TITLE = new RegExp(`(?:^|[\\s{,])(?:title|ogTitle|og:title)\\s*:\\s*${QUOTED}`, 'm');
const KEYED_TITLE_ALL = new RegExp(`(?:^|[\\s{,])(?:title|ogTitle|og:title)\\s*:\\s*${QUOTED}`, 'gm');
const HTML_TITLE_ALL = /<title[^>]*>([\s\S]*?)<\/title\s*>/gi;
const KEYED_DESCRIPTION = new RegExp(`(?:^|[\\s{,])(?:description|ogDescription|og:description)\\s*:\\s*${QUOTED}`, 'm');
const COMPUTED_TITLE = /(?:^|[\s{,])(?:title|ogTitle)\s*:\s*(?!["'`])[A-Za-z_$][\w$.?[\]()]*|(?:^|[\s{,])(?:title|ogTitle)\s*:\s*`[^`]*\$\{/m;
const ANY_TITLE = /<title[\s>]|(?:^|[\s{,])(?:title|ogTitle)\s*:|['"]title['"]\s*[,:]|titleTemplate/im;
const ANY_DESCRIPTION = /name\s*=\s*["']description["']|(?:^|[\s{,])(?:description|ogDescription)\s*:|['"]description['"]\s*[,:]/im;
const DECLARES = /export\s+(?:const|async\s+function|function)\s+(?:metadata|generateMetadata|meta)\b|useSeoMeta\s*\(|useHead\s*\(|defineRouteMeta\s*\(|<svelte:head|<Head\b|next\/head|react-helmet|<title[^>]*>|<meta\b/i;

/** `noindex` in any of the forms a framework offers. */
const NOINDEX = [
  /<meta[^>]+name\s*=\s*["']robots["'][^>]*content\s*=\s*["'][^"']*noindex/i,
  /robots\s*:\s*{[^}]*index\s*:\s*false/i,
  /robots\s*:\s*["'][^"']*noindex/i,
  /["']noindex["']/i,
  /X-Robots-Tag[^\n]*noindex/i,
  /noindex\s*:\s*true/i,
];

function firstGroup(match: RegExpMatchArray | null): { value: string; index: number } | undefined {
  if (!match) return undefined;
  const value = (match[1] ?? match[2] ?? match[3] ?? '').trim();
  if (!value) return undefined;
  return { value, index: match.index ?? 0 };
}

export function readMetadata(source: string): MetadataStrings {
  const htmlTitle = firstGroup(HTML_TITLE.exec(source));
  const title = htmlTitle ?? firstGroup(KEYED_TITLE.exec(source));
  const description =
    firstGroup(HTML_DESCRIPTION.exec(source)) ??
    firstGroup(HTML_DESCRIPTION_REVERSED.exec(source)) ??
    firstGroup(KEYED_DESCRIPTION.exec(source));
  const titles: Array<{ value: string; index: number }> = [];
  for (const re of [HTML_TITLE_ALL, KEYED_TITLE_ALL]) {
    for (const match of source.matchAll(re)) {
      const found = firstGroup(match);
      if (found && !/^\{|\$\{/.test(found.value)) titles.push(found);
    }
  }
  return {
    titles,
    title: title && !/^\{|\$\{/.test(title.value) ? title : undefined,
    description: description && !/^\{|\$\{/.test(description.value) ? description : undefined,
    hasTitle: ANY_TITLE.test(source),
    hasDescription: ANY_DESCRIPTION.test(source),
    declares: DECLARES.test(source),
    computedTitle: COMPUTED_TITLE.test(source),
    noindex: NOINDEX.some((re) => re.test(source)),
  };
}

/** A file that carries its own `<head>`: the one place absence is decidable. */
export function isWholeDocument(source: string): boolean {
  return /<html[\s>]/i.test(source) && /<head[\s>]/i.test(source);
}

export const TITLE_BUDGET = 60;
export const DESCRIPTION_BUDGET = 155;
