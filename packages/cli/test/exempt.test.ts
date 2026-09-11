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
