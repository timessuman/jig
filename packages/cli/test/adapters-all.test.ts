import { describe, it, expect } from 'vitest';
import { ADAPTERS, getAdapter, skillFilesFor } from '../src/adapters/registry.js';
import { SKILL_DIR_HARNESSES } from '../src/adapters/skill-dir.js';
import type { Adapter } from '../src/adapters/types.js';

const ctx = { version: '0.1.0', scope: 'project' as const, skillBody: 'BODY', commandPrefix: '/jig ' };
const globalCtx = { ...ctx, scope: 'global' as const };

describe('every adapter', () => {
  it('registers all six targets', () => {
    expect(ADAPTERS.map((a) => a.name).sort())
      .toEqual(['claude', 'codex', 'cursor', 'gemini', 'generic', 'opencode']);
  });

  for (const a of ADAPTERS) {
    it(`${a.name} produces at least one file containing the skill body`, () => {
      const files = a.skillFiles(ctx);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.content.includes('BODY'))).toBe(true);
    });

    it(`${a.name} produces only relative paths`, () => {
      for (const scopeCtx of [ctx, globalCtx]) {
        for (const f of a.skillFiles(scopeCtx)) {
          expect(f.relPath.startsWith('/')).toBe(false);
          expect(f.relPath).not.toContain('..');
        }
      }
    });
  }
});

describe('AGENTS.md adapters', () => {
  // codex is the one adapter left writing AGENTS.md — generic moved onto
  // the shared <harness>/skills/<name>/ convention (`.agents/skills/jig/`)
  // along with every other harness in SKILL_DIR_HARNESSES.
  it('codex wraps content in jig markers', () => {
    const [file] = getAdapter('codex').skillFiles(ctx);
    expect(file.relPath).toBe('AGENTS.md');
    expect(file.content).toContain('<!-- jig:start -->');
    expect(file.content).toContain('<!-- jig:end -->');
  });
});

// --- Table-driven harnesses: <dir>/skills/jig/SKILL.md in both scopes,
// identical shape apart from the directory (and, for opencode only, its
// documented global-scope override — see skill-dir.ts). Adding a row to
// SKILL_DIR_HARNESSES is the entire diff for a new harness; this suite
// iterates the table itself rather than hardcoding each name, so it
// automatically covers whatever harnesses are actually registered. ---
describe('skill-dir harnesses (table-driven)', () => {
  for (const h of SKILL_DIR_HARNESSES) {
    const adapter = getAdapter(h.name);

    it(`${h.name} writes SKILL.md under ${h.dir}/skills/jig at project scope`, () => {
      const [file] = adapter.skillFiles(ctx);
      expect(file.relPath).toBe(`${h.dir}/skills/jig/SKILL.md`);
      expect(adapter.referenceDir('project')).toBe(`${h.dir}/skills/jig`);
    });

    it(`${h.name} writes SKILL.md under its global directory at global scope`, () => {
      const globalDir = h.globalDir ?? h.dir;
      const [file] = adapter.skillFiles(globalCtx);
      expect(file.relPath).toBe(`${globalDir}/skills/jig/SKILL.md`);
      expect(adapter.referenceDir('global')).toBe(`${globalDir}/skills/jig`);
    });

    it(`${h.name} emits name + description frontmatter (the shape gstack's own .cursor/skills and .opencode/skills SKILL.md files use)`, () => {
      const [file] = adapter.skillFiles(ctx);
      expect(file.content).toMatch(/^---\n/);
      expect(file.content).toMatch(/^name: jig$/m);
      expect(file.content).toMatch(/^description: ".*"$/m);
    });
  }

  it('claude is the one harness with its own extra frontmatter field (user-invocable)', () => {
    const [file] = getAdapter('claude').skillFiles(ctx);
    expect(file.content).toMatch(/^user-invocable: true$/m);
  });

  it('cursor does NOT carry the old .mdc-era alwaysApply field', () => {
    const [file] = getAdapter('cursor').skillFiles(ctx);
    expect(file.content).not.toMatch(/alwaysApply/);
  });
});

// --- Prove the table design: a harness that follows the convention is one
// row, not a new file. `gemini` was added to SKILL_DIR_HARNESSES exactly
// like `claude`/`cursor`/`opencode`/`generic` — no other adapter code
// changed to support it. ---
describe('adding a harness is one table row (gemini)', () => {
  it('gemini is registered and produces a working adapter', () => {
    expect(ADAPTERS.map((a) => a.name)).toContain('gemini');
    const adapter = getAdapter('gemini');
    const [project] = adapter.skillFiles(ctx);
    expect(project.relPath).toBe('.gemini/skills/jig/SKILL.md');
    const [global] = adapter.skillFiles(globalCtx);
    expect(global.relPath).toBe('.gemini/skills/jig/SKILL.md');
  });
});

describe('cursor adapter', () => {
  it('writes SKILL.md under .cursor/skills/jig, not the old .cursor/rules/jig.mdc location', () => {
    const [file] = getAdapter('cursor').skillFiles(ctx);
    expect(file.relPath).toBe('.cursor/skills/jig/SKILL.md');
    expect(file.content).toMatch(/^---\n/);
  });
});

// --- Carry-forward 2: a shared guard on relPath, exercised via skillFilesFor ---
describe('skillFilesFor guard', () => {
  it('rejects an adapter that produces a relPath with a .. segment', () => {
    const badAdapter: Adapter = {
      name: 'bad-dotdot',
      displayName: 'Bad Dotdot',
      referenceDir: () => '.jig',
      skillFiles: () => [{ relPath: '../escape.md', content: 'x' }],
    };
    expect(() => skillFilesFor(badAdapter, ctx)).toThrow(/unsafe/i);
  });

  it('rejects an adapter that produces an absolute relPath', () => {
    const badAdapter: Adapter = {
      name: 'bad-abs',
      displayName: 'Bad Abs',
      referenceDir: () => '.jig',
      skillFiles: () => [{ relPath: '/etc/passwd', content: 'x' }],
    };
    expect(() => skillFilesFor(badAdapter, ctx)).toThrow(/unsafe/i);
  });

  it('rejects an adapter that produces a Windows-drive-prefixed relPath', () => {
    const badAdapter: Adapter = {
      name: 'bad-drive',
      displayName: 'Bad Drive',
      referenceDir: () => '.jig',
      skillFiles: () => [{ relPath: 'C:\\evil.md', content: 'x' }],
    };
    expect(() => skillFilesFor(badAdapter, ctx)).toThrow(/unsafe/i);
  });

  it('passes a well-behaved adapter through unchanged', () => {
    const claudeAdapter = getAdapter('claude');
    expect(skillFilesFor(claudeAdapter, ctx)).toEqual(claudeAdapter.skillFiles(ctx));
  });
});

// --- Carry-forward 3: the frontmatter description is quoted defensively ---
describe('frontmatter description quoting', () => {
  for (const name of ['claude', 'cursor', 'opencode', 'generic', 'gemini']) {
    it(`${name} emits the description as a quoted YAML scalar`, () => {
      const [file] = getAdapter(name).skillFiles(ctx);
      expect(file.content).toMatch(/^description: ".*"$/m);
    });
  }
});
