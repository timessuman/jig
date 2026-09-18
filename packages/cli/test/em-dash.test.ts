import { describe, it, expect } from 'vitest';
import { emDash } from '../src/check/detectors/em-dash.js';
import type { DetectorContext } from '../src/check/types.js';

const run = (raw: string, file = 'page.html') =>
  emDash.run('', file, { ruleId: 'I-118', bucket: 'mechanical', severity: 'warning', tokens: {}, projectParticipates: true, raw } as DetectorContext);

describe('em-dash (I-118)', () => {
  it('reports one in element text, on its line', () => {
    const f = run('<body>\n  <p>Free — forever</p>\n</body>');
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(2);
    expect(f[0].message).toMatch(/em dash in interface text/);
  });

  it('reports one in an attribute a reader hears or sees', () => {
    expect(run('<button aria-label="Delete — permanent">x</button>')).toHaveLength(1);
    expect(run('<img alt="The team — at work">')).toHaveLength(1);
    expect(run('<input placeholder="Search — by name">')).toHaveLength(1);
  });

  it('leaves the en dash alone: a range is not a pause', () => {
    expect(run('<p>2–10 seats, Mon–Fri</p>')).toHaveLength(0);
  });

  // Not interface text: nobody reads a comment, a class name or a script.
  it('ignores scripts, styles, comments and markup that is not prose', () => {
    expect(run('<script>const note = "a — b";</script>')).toHaveLength(0);
    expect(run('<style>/* a — b */ .x { color: red }</style>')).toHaveLength(0);
    expect(run('<!-- a — b -->\n<p>fine</p>')).toHaveLength(0);
    expect(run('<div class="a—b" data-note="x — y"></div>')).toHaveLength(0);
  });

  it('reports each line once, however many dashes it holds', () => {
    expect(run('<p>a — b — c</p>')).toHaveLength(1);
  });

  it('does not read documentation or stylesheets', () => {
    expect(emDash.appliesTo('README.md')).toBe(false);
    expect(emDash.appliesTo('app.css')).toBe(false);
    expect(emDash.appliesTo('page.tsx')).toBe(true);
  });

  it('reads a JSX string as interface text', () => {
    expect(run('export const Banner = () => <p>Free — forever</p>;', 'Banner.tsx')).toHaveLength(1);
  });
});

/**
 * Jig is framework-agnostic, and a copy rule has to be too. The first version
 * of this detector carried its own list of extensions — HTML, JSX, Vue and a
 * few others — so a Razor view, a Liquid template or a Nunjucks page was
 * invisible to it, and markdown, which Astro, Next, Docusaurus, Eleventy and
 * Hugo all render as pages, was excluded outright.
 */
describe('em-dash reaches every place a reader sees text', () => {
  it('reads every template language the suite knows, not a hand-picked few', () => {
    for (const file of ['page.razor', 'page.liquid', 'page.njk', 'page.ejs', 'page.heex', 'page.pug', 'page.haml', 'page.slim', 'page.twig', 'page.astro', 'page.vue']) {
      expect(emDash.appliesTo(file), file).toBe(true);
    }
  });

  it('reads the markdown a framework renders as a page', () => {
    expect(emDash.appliesTo('src/content/docs/getting-started.md')).toBe(true);
    expect(emDash.appliesTo('content/posts/hello.mdx')).toBe(true);
    expect(run('# Pricing\n\nFree — forever.\n', 'src/content/pricing.md')).toHaveLength(1);
  });

  it('leaves repository documents alone: they are written for whoever works here', () => {
    for (const file of ['README.md', 'CHANGELOG.md', 'docs/AGENTS.md', 'CONTRIBUTING.md']) {
      expect(emDash.appliesTo(file), file).toBe(false);
    }
  });

  it('does not read a code sample in markdown as prose', () => {
    expect(run('Text.\n\n```js\nconst a = "x — y";\n```\n\nAnd `a — b` inline.\n', 'page.md')).toHaveLength(0);
    expect(run('See [the docs](https://x.test/a—b) for more.\n', 'page.md')).toHaveLength(0);
  });

  it('reports markdown prose and frontmatter, each line once', () => {
    const f = run('---\ntitle: Pricing — plans\n---\n\nFree — forever, and — again.\n', 'page.md');
    expect(f.map((x) => x.line)).toEqual([2, 5]);
  });
});

describe('em-dash does not read code as copy', () => {
  it('leaves a build script that logs a sentence alone', () => {
    expect(run('console.log("fetch-corpus: wrote 3 files — done");\n', 'scripts/fetch.mjs')).toHaveLength(0);
    expect(run('// a — b\nconst note = "x — y";\n', 'lib/util.ts')).toHaveLength(0);
  });

  it('still reads the markup inside a script file', () => {
    expect(run('render(<p>Free — forever</p>);\n', 'App.tsx')).toHaveLength(1);
    expect(run('const t = html`<p>Free — forever</p>`;\n', 'card.ts')).toHaveLength(1);
  });

  it('reads an indentation template line, but not its code lines', () => {
    expect(run('p Free — forever\n', 'page.pug')).toHaveLength(1);
    expect(run('- const label = "a — b"\n', 'page.pug')).toHaveLength(0);
  });
});

describe('the scan skips the agent harnesses own files', () => {
  it('excludes .claude and its kin, where install vendors Jig itself', async () => {
    const { selectFiles } = await import('../src/check/files.js');
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'jig-scan-'));
    for (const dir of ['.claude/commands', '.cursor', 'src']) mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, '.claude', 'commands', 'jig.md'), 'A rule — with a dash.\n');
    writeFileSync(join(root, '.cursor', 'rules.md'), 'Another — one.\n');
    writeFileSync(join(root, 'src', 'page.md'), 'Real — copy.\n');
    const files = selectFiles(root, true).files;
    expect(files).toContain('src/page.md');
    expect(files.some((f) => f.startsWith('.claude/') || f.startsWith('.cursor/'))).toBe(false);
  });
});
