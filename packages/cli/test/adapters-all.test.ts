import { describe, it, expect } from 'vitest';
import { ADAPTERS, getAdapter, skillFilesFor } from '../src/adapters/registry.js';
import type { Adapter } from '../src/adapters/types.js';

const ctx = { version: '0.1.0', scope: 'project' as const, skillBody: 'BODY', commandPrefix: '/jig ' };

describe('every adapter', () => {
  it('registers all five targets', () => {
    expect(ADAPTERS.map((a) => a.name).sort())
      .toEqual(['claude', 'codex', 'cursor', 'generic', 'opencode']);
  });

  for (const a of ADAPTERS) {
    it(`${a.name} produces at least one file containing the skill body`, () => {
      const files = a.skillFiles(ctx);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.content.includes('BODY'))).toBe(true);
    });

    it(`${a.name} produces only relative paths`, () => {
      for (const f of a.skillFiles(ctx)) {
        expect(f.relPath.startsWith('/')).toBe(false);
        expect(f.relPath).not.toContain('..');
      }
    });
  }
});

describe('AGENTS.md adapters', () => {
  for (const name of ['codex', 'generic']) {
    it(`${name} wraps content in jig markers`, () => {
      const [file] = getAdapter(name).skillFiles(ctx);
      expect(file.relPath).toBe('AGENTS.md');
      expect(file.content).toContain('<!-- jig:start -->');
      expect(file.content).toContain('<!-- jig:end -->');
    });
  }
});

describe('cursor adapter', () => {
  it('writes an .mdc rule file with frontmatter', () => {
    const [file] = getAdapter('cursor').skillFiles(ctx);
    expect(file.relPath).toBe('.cursor/rules/jig.mdc');
    expect(file.content).toMatch(/^---\n/);
    expect(file.content).toMatch(/^alwaysApply: /m);
  });

  it('does not support global scope', () => {
    expect(getAdapter('cursor').supportsScope('global')).toBe(false);
  });
});

// --- Carry-forward 2: a shared guard on relPath, exercised via skillFilesFor ---
describe('skillFilesFor guard', () => {
  it('rejects an adapter that produces a relPath with a .. segment', () => {
    const badAdapter: Adapter = {
      name: 'bad-dotdot',
      displayName: 'Bad Dotdot',
      supportsScope: () => true,
      skillFiles: () => [{ relPath: '../escape.md', content: 'x' }],
    };
    expect(() => skillFilesFor(badAdapter, ctx)).toThrow(/unsafe/i);
  });

  it('rejects an adapter that produces an absolute relPath', () => {
    const badAdapter: Adapter = {
      name: 'bad-abs',
      displayName: 'Bad Abs',
      supportsScope: () => true,
      skillFiles: () => [{ relPath: '/etc/passwd', content: 'x' }],
    };
    expect(() => skillFilesFor(badAdapter, ctx)).toThrow(/unsafe/i);
  });

  it('rejects an adapter that produces a Windows-drive-prefixed relPath', () => {
    const badAdapter: Adapter = {
      name: 'bad-drive',
      displayName: 'Bad Drive',
      supportsScope: () => true,
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
  for (const name of ['claude', 'cursor', 'opencode']) {
    it(`${name} emits the description as a quoted YAML scalar`, () => {
      const [file] = getAdapter(name).skillFiles(ctx);
      expect(file.content).toMatch(/^description: ".*"$/m);
    });
  }
});
