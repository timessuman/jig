import { describe, it, expect, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyVerdicts } from '../src/commands/verdicts.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * jig-site's header critique counted 15 findings, five of them the owner's
 * recorded rulings: labelled "owner-ruled" in prose, counted all the same, and
 * sent back to make, which could only leave them. And nothing said which of
 * the last round's findings the make round had fixed: the owner read two
 * reports side by side.
 */
const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
const ids = (pass: string) => index.filter((r) => (r.bucket === 'judgment' || r.bucket === 'hybrid') && r.pass === pass).map((r) => ({ id: r.id, verdict: 'ok', reason: `${r.id} holds here` } as Record<string, string>));
const screenIds = ids('screen').map((v) => v.id);

let project: string;
const dir = () => join(project, '.jig', 'critique', 'pricing');
const run = () => verifyVerdicts({ projectRoot: project, surface: 'pricing', packageRoot: repoRoot });
const write = (name: string, body: unknown) => writeFileSync(join(dir(), name), JSON.stringify(body));
const screen = (edit: (v: Array<Record<string, string>>) => void = () => {}) => {
  const v = ids('screen');
  edit(v);
  write('screen.json', { rendered: false, verdicts: v });
};
const set = (v: Array<Record<string, string>>, id: string, fields: Record<string, string>) => Object.assign(v.find((x) => x.id === id)!, fields);
const git = (...args: string[]) => execFileSync('git', args, { cwd: project, stdio: 'ignore' });

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-ruled-'));
  mkdirSync(dir(), { recursive: true });
  mkdirSync(join(project, 'jig'), { recursive: true });
  writeFileSync(join(project, 'jig', 'DECISIONS.md'), '# Decisions\n\n## The theme toggle is icon-only\n\nno words.\n\n## Unresolved\n\nNone named by the owner.\n');
  write('code.json', { verdicts: ids('code') });
  write('decisions.json', { verdicts: [{ decision: 'The theme toggle is icon-only', verdict: 'ok', reason: 'the toggle shows a sun or a moon and no word' }] });
});

describe('a ruled verdict', () => {
  it('cites the decision, and is counted apart from findings', () => {
    screen((v) => {
      set(v, screenIds[0], { verdict: 'ruled', ruling: 'the theme toggle is icon-only', reason: 'the toggle has no visible label; the owner ruled it icon-only' });
      set(v, screenIds[1], { verdict: 'finding', reason: 'the focus ring is clipped at the bottom edge' });
    });
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.line).toMatch(/findings=1 ruled=1$/);
  });

  it('is refused without a ruling, or with one DECISIONS.md does not hold', () => {
    screen((v) => {
      set(v, screenIds[0], { verdict: 'ruled', reason: 'the owner wanted it' });
      set(v, screenIds[1], { verdict: 'ruled', ruling: 'Menus are always open', reason: 'the owner said so once' });
    });
    const errors = run().errors.join('\n');
    expect(errors).toMatch(new RegExp(`${screenIds[0]} is ruled, but names no \`ruling\``));
    expect(errors).toMatch(new RegExp(`${screenIds[1]} cites the ruling "Menus are always open", which is not a heading in DECISIONS.md`));
  });
});

describe('the critique before this one', () => {
  beforeEach(() => {
    git('init', '-q');
    git('config', 'user.email', 't@example.test');
    git('config', 'user.name', 't');
    mkdirSync(join(project, 'src'), { recursive: true });
    page(() => {});
    screen((v) => {
      set(v, screenIds[0], { verdict: 'finding', reason: 'the focus ring is clipped at the bottom edge (page.astro:3)' });
      set(v, screenIds[1], { verdict: 'finding', reason: 'the h2 sits as far from its list as from the one above, src/page.astro:6-7' });
      set(v, screenIds[2], { verdict: 'finding', reason: 'the toggle has no visible label' });
    });
    git('add', '-A');
    git('commit', '-q', '-m', 'first critique');
  });

  const page = (edit: (lines: string[]) => void) => {
    const lines = Array.from({ length: 10 }, (_, i) => `<p>line ${i + 1}</p>`);
    edit(lines);
    writeFileSync(join(project, 'src', 'page.astro'), lines.join('\n') + '\n');
  };

  it('says which findings were fixed, which are open, which are ruled, and which are new', () => {
    page((l) => { l[2] = '<p class="focus-ring-inset">line 3</p>'; });
    screen((v) => {
      set(v, screenIds[1], { verdict: 'finding', reason: 'the h2 still sits as far from its list as from the one above' });
      set(v, screenIds[2], { verdict: 'ruled', ruling: 'The theme toggle is icon-only', reason: 'no visible label, as the owner ruled' });
      set(v, screenIds[3], { verdict: 'finding', reason: 'a word is stranded on the last line at 320px' });
    });
    const p = run().previous!;
    expect(p.fixed).toEqual([screenIds[0]]);
    expect(p.open).toEqual([screenIds[1]]);
    expect(p.ruled).toEqual([screenIds[2]]);
    expect(p.added).toEqual([screenIds[3]]);
  });

  it('compares a committed critique with the one committed before it', () => {
    page((l) => { l[2] = '<p class="focus-ring-inset">line 3</p>'; });
    screen((v) => set(v, screenIds[1], { verdict: 'finding', reason: 'the h2 still sits as far from its list as from the one above' }));
    git('add', '-A');
    git('commit', '-q', '-m', 'second critique');
    const p = run().previous!;
    expect(p.fixed).toEqual([screenIds[0], screenIds[2]]);
    expect(p.open).toEqual([screenIds[1]]);
  });

  /**
   * jig-site's fourth home critique was told seven findings were fixed. Four
   * had flipped because its readers read the same unchanged lines differently.
   */
  it('does not call a finding fixed when the lines it cited did not change', () => {
    page((l) => { l[8] = '<p>line 9, reworded</p>'; });
    screen();
    const p = run().previous!;
    expect(p.unchanged).toEqual([screenIds[0], screenIds[1]]);
    // It cited nothing, so any change to the source counts for it.
    expect(p.fixed).toEqual([screenIds[2]]);
  });

  it('counts a finding that cites nothing as unchanged when no source changed', () => {
    screen();
    const p = run().previous!;
    expect(p.fixed).toEqual([]);
    expect(p.unchanged).toEqual([screenIds[0], screenIds[1], screenIds[2]]);
  });

  it('counts a change to any cited line of a range', () => {
    page((l) => { l[6] = '<p class="mt-l">line 7</p>'; });
    screen();
    const p = run().previous!;
    expect(p.fixed).toContain(screenIds[1]);
    expect(p.unchanged).toContain(screenIds[0]);
  });
});
