import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check } from '../src/commands/check.js';

/**
 * Some surfaces render outside the cascade, and a literal is the only thing
 * that works there. An OG card serialised into an SVG `foreignObject` carries
 * no stylesheet; a PDF drawn through a React renderer never sees CSS at all.
 * Every colour in those files must be a hex copied from the token layer by
 * hand.
 *
 * Jig had no way to say so, so those files were in violation permanently. That
 * is not a nuisance, it is an adoption blocker: a check that cannot be made to
 * pass is a check people turn off, and turning it off loses the other 99% of
 * the codebase with it.
 *
 * The exemption is deliberately visible. `check` reports how many files it
 * skipped, because an exemption list is the kind of thing that grows quietly
 * until it covers the codebase, and the only defence is that it is stated
 * every single run.
 */
let project: string;
let home: string;

const bad = '.a {\n  color: #767676;\n  padding: 13px;\n}\n';

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-exempt-'));
  home = mkdtempSync(join(tmpdir(), 'jig-exempt-home-'));
  mkdirSync(join(project, 'src'), { recursive: true });
  mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
  // A token layer, so H-47 is live.
  writeFileSync(join(project, '.jig', 'tokens', 'brand.t.css'), ':root { --color-text-strong: #000; }\n');
  writeFileSync(join(project, 'src', 'app.css'), '@import "../.jig/tokens/brand.t.css";\n' + bad);
  writeFileSync(join(project, 'src', 'og-card.css'), '@import "../.jig/tokens/brand.t.css";\n' + bad);
});
afterEach(() => {
  for (const d of [project, home]) rmSync(d, { recursive: true, force: true });
});

const run = () => check({ projectRoot: project, homeDir: home, version: '0.5.0', all: true, ci: false });

describe('jig.config.json can exempt a file', () => {
  it('reports both files when nothing is exempt', () => {
    const files = new Set(run().findings.map((f) => f.file));
    expect(files.has('src/app.css')).toBe(true);
    expect(files.has('src/og-card.css')).toBe(true);
  });

  it('stops reporting an exempt file', () => {
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['src/og-card.css'] }));
    const files = new Set(run().findings.map((f) => f.file));
    expect(files.has('src/og-card.css'), 'exempt file still reported').toBe(false);
    expect(files.has('src/app.css'), 'exemption leaked to another file').toBe(true);
  });

  it('accepts a glob, since these come in families', () => {
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['src/*-card.css'] }));
    expect(new Set(run().findings.map((f) => f.file)).has('src/og-card.css')).toBe(false);
  });

  it('says out loud how many files it skipped', () => {
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['src/og-card.css'] }));
    expect(run().report, 'a silent exemption is one that grows').toMatch(/1 file.*exempt|exempt.*1 file/i);
  });

  it('names the exempt files in the report, not just the count', () => {
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['src/og-card.css'] }));
    expect(run().report).toContain('src/og-card.css');
  });

  it('ignores an exemption that matches nothing, rather than failing', () => {
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['src/does-not-exist.css'] }));
    expect(() => run()).not.toThrow();
  });

  it('cannot exempt a path outside the project', () => {
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['../../**'] }));
    expect(new Set(run().findings.map((f) => f.file)).has('src/app.css'),
      'an escaping glob silenced the project').toBe(true);
  });
});

/**
 * An over-broad pattern is the failure mode of an exemption list, and it does
 * not announce itself: `check` simply gets quieter, and quieter looks like
 * progress. `**\/*-card.tsx` written to excuse one OG card also excuses
 * `doc-card.tsx`, `pricing-card.tsx` and every other real component that
 * happens to end that way.
 *
 * The report is the only defence, and it was not good enough. It named files,
 * truncated at five, and never named the PATTERN — which is the one thing you
 * need to see in order to recognise the mistake. So it degraded exactly when it
 * mattered most: the broader the glob, the less the output told you.
 */
describe('an over-broad exemption is visible', () => {
  const manyCards = () => {
    for (const n of ['og', 'doc', 'pricing', 'profile', 'team', 'blog']) {
      writeFileSync(join(project, 'src', `${n}-card.css`),
        '@import "../.jig/tokens/brand.t.css";\n' + bad);
    }
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['src/*-card.css'] }));
  };

  it('names the pattern, not only the files', () => {
    manyCards();
    expect(run().report, 'the report never names the glob that did this')
      .toContain('src/*-card.css');
  });

  it('says how many files each pattern excused', () => {
    manyCards();
    expect(run().report).toMatch(/src\/\*-card\.css[^\n]*6/);
  });

  it('calls out a pattern that is excusing a lot of files', () => {
    manyCards();
    expect(run().report.toLowerCase()).toMatch(/broad|review|likely/);
  });

  it('stays quiet about a single exact path, which is the normal case', () => {
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['src/og-card.css'] }));
    const report = run().report;
    expect(report).toContain('src/og-card.css');
    expect(report.toLowerCase(), 'nagged about a one-file exemption').not.toMatch(/too broad/);
  });

  it('reports a pattern that matches nothing, so a typo is visible', () => {
    writeFileSync(join(project, 'jig.config.json'),
      JSON.stringify({ exempt: ['src/og-crad.css'] }));
    expect(run().report).toMatch(/src\/og-crad\.css[^\n]*(0|nothing|no file)/i);
  });
});
