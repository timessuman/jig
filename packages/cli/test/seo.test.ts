import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { seo } from '../src/commands/seo.js';
import { readFileSync } from 'node:fs';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * The things that go wrong here are facts about a project, not a file: a route
 * that says noindex and is listed in the sitemap anyway, two pages claiming one
 * title, a sitemap a crawler cannot use.
 */
let root: string;
const write = (path: string, body: string) => {
  mkdirSync(join(root, dirname(path)), { recursive: true });
  writeFileSync(join(root, path), body);
};
const page = (title: string, extra = '') =>
  `<!doctype html><html><head><title>${title}</title><meta name="description" content="d">${extra}</head><body><main>x</main></body></html>`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-seo-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
});

describe('jig seo', () => {
  it('reports a route that says noindex and is listed as indexable', () => {
    write('admin.html', page('Admin', '<meta name="robots" content="noindex">'));
    write('sitemap.xml', '<urlset><url><loc>https://x.test/admin</loc></url></urlset>');
    const f = seo({ projectRoot: root }).findings;
    expect(f.some((x) => x.ruleId === 'J-124' && /lists \/admin/.test(x.message))).toBe(true);
  });

  it('reports two pages claiming the same title', () => {
    write('a.html', page('Pricing'));
    write('b.html', page('Pricing'));
    write('sitemap.xml', '<urlset><url><loc>https://x.test/a</loc></url></urlset>');
    expect(seo({ projectRoot: root }).findings.some((x) => /is the title of 2 pages/.test(x.message))).toBe(true);
  });

  // A title built from a value is a runtime question, and the literal beside it
  // is a fallback. Two such pages are not two pages with one title.
  it('leaves computed titles out of the comparison', () => {
    write('app/a/page.tsx', "export const metadata = { title: post.title };\nexport function notFound() { return { title: 'Not found' }; }");
    write('app/b/page.tsx', "export const metadata = { title: study.title };\nexport function notFound() { return { title: 'Not found' }; }");
    const r = seo({ projectRoot: root });
    expect(r.pages).toBe(2);
    expect(r.findings.filter((x) => /title of 2 pages/.test(x.message))).toEqual([]);
  });

  // No rule asks for a sitemap or a robots file, and a project with no origin
  // yet cannot write an honest sitemap. Their absence is counted, not reported.
  it('reports no finding for a site with no sitemap and no robots file', () => {
    write('index.html', page('Home'));
    const r = seo({ projectRoot: root });
    expect(r.findings).toEqual([]);
    expect(r.line).toMatch(/sitemap=none robots=no/);
  });

  it('reports a sitemap that lists nothing', () => {
    write('index.html', page('Home'));
    write('sitemap.xml', '<urlset></urlset>');
    expect(seo({ projectRoot: root }).findings.some((x) => x.ruleId === 'J-127' && /lists no routes/.test(x.message))).toBe(true);
  });

  // The format asks for a full URL in every `<loc>`. A path is what an agent
  // with no origin writes to have a sitemap at all, and a crawler drops it.
  it('reports sitemap entries written as paths', () => {
    write('index.html', page('Home'));
    write('sitemap.xml', '<urlset><url><loc>/</loc></url><url><loc>/about</loc></url></urlset>');
    const f = seo({ projectRoot: root }).findings;
    expect(f.some((x) => x.ruleId === 'J-124' && /2 sitemap entries are paths \(\/, \/about\)/.test(x.message))).toBe(true);
  });

  it('matches a framework route to its sitemap entry', () => {
    write('src/pages/admin.astro', '---\n---\n<Base title="Admin"><meta name="robots" content="noindex"></Base>');
    write('sitemap.xml', '<urlset><url><loc>https://x.test/admin</loc></url></urlset>');
    expect(seo({ projectRoot: root }).findings.some((x) => x.ruleId === 'J-124' && /lists \/admin/.test(x.message))).toBe(true);
  });

  it('asks nothing of a project that is all signed-in surfaces', () => {
    write('dashboard.html', page('Dashboard', '<meta name="robots" content="noindex">'));
    const r = seo({ projectRoot: root, mode: 'product' });
    expect(r.findings).toEqual([]);
    expect(r.line).toMatch(/pages=1 indexable=0 noindex=1/);
  });

  it('counts what it read, in one line', () => {
    write('index.html', page('Home'));
    write('robots.txt', 'User-agent: *\nAllow: /\n');
    write('sitemap.xml', '<urlset><url><loc>https://x.test/</loc></url></urlset>');
    expect(seo({ projectRoot: root }).line).toMatch(/JIG_SEO: pages=1 indexable=1 noindex=0 sitemap=1 robots=yes overlong=0 findings=0/);
  });
});

// Mentioning `<title>` does not make a file a page. A static site of one home
// page and one dynamic route reported five pages: a build script, a test, a data
// module, a layout and the route, and not the home page.
describe('what seo counts as a page', () => {
  it('counts routes, not files that mention metadata', () => {
    write('scripts/verify-dist.mjs', 'const t = /<title>([^<]*)<\\/title>/; const m = /<meta name="description"/;');
    write('test/prose.test.ts', "expect(html).toContain('<title>x</title>');");
    write('src/content/prose.ts', "export const head = (t: string) => `<title>${t}</title><meta name=\"description\">`;");
    write('src/layouts/BaseLayout.astro', '<html><head><title>{title}</title><meta name="description" content={d}></head><body><slot /></body></html>');
    write('src/pages/index.astro', '---\nimport Base from "../layouts/BaseLayout.astro";\n---\n<Base title="Home" />');
    write('src/pages/rules/[id].astro', '---\n---\n<Base title={entry.title} />');
    write('src/pages/rules/[id].txt.ts', 'export const GET = () => new Response("x");');
    const r = seo({ projectRoot: root });
    expect(r.pages).toBe(2);
    expect(r.line).toMatch(/pages=2 indexable=2/);
  });

  it('knows each framework\'s page file from its neighbours', () => {
    write('app/page.tsx', 'export default function Home() { return <main />; }');
    write('app/layout.tsx', '<html><head><title>x</title></head><body /></html>');
    write('src/routes/about/+page.svelte', '<svelte:head><title>About</title></svelte:head>');
    write('src/routes/about/+page.ts', 'export const load = () => ({});');
    write('pages/blog.js', 'export default function Blog() { return null; }');
    write('pages/_app.js', 'export default function App() { return null; }');
    write('pages/api/hello.js', 'export default function handler() {}');
    write('pages/rss.xml.js', 'export const GET = () => new Response("x");');
    write('templates/about.html', page('About'));
    write('templates/partials/head.html', page('Head'));
    expect(seo({ projectRoot: root }).pages).toBe(4);
  });
});

// `seo` is an audit, not a step in the loop: a project with no decisions yet
// still has a sitemap that either contradicts its pages or does not.
describe('seo is not gated on anything', () => {
  it('runs in a project with no DECISIONS.md, no spec and no config', () => {
    write('index.html', page('Home'));
    const r = seo({ projectRoot: root });
    expect(r.pages).toBe(1);
    expect(r.line).toMatch(/JIG_SEO:/);
  });

  it('is named among the commands that run without decisions', () => {
    const tmpl = readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');
    expect(tmpl).toMatch(/`install`, `init`, `check`, `explain`, `seo`, `probe`\s*\n?and `verdicts` all run without it/);
    expect(tmpl).toMatch(/It needs no `DECISIONS\.md`/);
  });
});
