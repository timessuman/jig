import { describe, it, expect } from 'vitest';
import { getAdapter, adapterNames } from '../src/adapters/registry.js';

const ctx = { version: '0.1.0', scope: 'project' as const, skillBody: 'BODY', commandPrefix: '/jig ' };

describe('registry', () => {
  it('lists the claude adapter', () => {
    expect(adapterNames()).toContain('claude');
  });
  it('throws a helpful error for an unknown agent', () => {
    expect(() => getAdapter('nope')).toThrow(/Unknown agent 'nope'/);
  });
});

describe('claude adapter', () => {
  const a = getAdapter('claude');

  it('supports both scopes (referenceDir resolves for each)', () => {
    expect(a.referenceDir('project')).toBe('.claude/skills/jig');
    expect(a.referenceDir('global')).toBe('.claude/skills/jig');
  });

  it('writes SKILL.md under .claude/skills/jig at project scope', () => {
    const files = a.skillFiles(ctx);
    expect(files.map((f) => f.relPath)).toEqual(['.claude/skills/jig/SKILL.md']);
  });

  it('includes YAML frontmatter with name and description', () => {
    const [file] = a.skillFiles(ctx);
    expect(file.content.startsWith('---\n')).toBe(true);
    expect(file.content).toMatch(/^name: jig$/m);
    expect(file.content).toMatch(/^description: /m);
  });

  it('embeds the rendered skill body', () => {
    expect(a.skillFiles(ctx)[0].content).toContain('BODY');
  });
});
