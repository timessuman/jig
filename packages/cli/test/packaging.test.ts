import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildSkillBody } from '../src/commands/install.js';
import { repoRoot } from './helpers/registered-commands.js';

// `repoRoot` is derived from the package location, not from `process.cwd()`,
// so these tests resolve the same whether vitest is invoked from the workspace
// or from the repo root.
const readme = () => readFileSync(join(repoRoot, 'README.md'), 'utf8');


describe('packaging', () => {
  it('has a LICENSE naming Apache', () => {
    expect(readFileSync(join(repoRoot, 'LICENSE'), 'utf8')).toContain('Apache License');
  });

  it('has a NOTICE', () => {
    expect(existsSync(join(repoRoot, 'NOTICE'))).toBe(true);
  });

  it('renamed the example config', () => {
    expect(existsSync(join(repoRoot, 'jig.config.example.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'ui.config.example.json'))).toBe(false);
  });

  it('README documents an install line for every adapter', () => {
    const text = readme();
    for (const agent of ['claude', 'codex', 'cursor', 'opencode', 'gemini', 'generic']) {
      expect(text).toContain(`npx jig-ui@latest install --agent ${agent}`);
    }
  });

  it('README no longer refers to the old name or config file', () => {
    const text = readme();
    expect(text).not.toMatch(/\bSquint\b/);
    expect(text).not.toContain('ui.config.json');
  });

  it('README documents jig init now that it is implemented', () => {
    const text = readme();
    expect(text).toMatch(/jig-ui@latest init/);
  });
});

describe('installed skill file', () => {
  const body = buildSkillBody(repoRoot, '.claude/skills/jig/rules');
  const commandMetadata = JSON.parse(
    readFileSync(join(repoRoot, 'templates', 'command-metadata.json'), 'utf8'),
  ) as Record<string, { status?: string }>;

  // Metadata/CLI agreement in both directions lives in command-metadata.test.ts.

  it('does not instruct running a command that is not implemented', () => {
    // The numbered "before generating or reviewing" steps are what an agent
    // actually follows; the Commands table further down is allowed to list
    // planned commands (visibly marked), but nothing before that table may
    // tell an agent to invoke one.
    const instructions = body.slice(0, body.indexOf('## Commands'));
    for (const [name, meta] of Object.entries(commandMetadata)) {
      if (meta.status === 'planned') {
        expect(instructions).not.toContain(`/jig ${name}`);
      }
    }
  });

  it('the JIG_CHECK attestation line does not claim results no engine produces yet', () => {
    const attestationLine = body.split('\n').find((line) => line.startsWith('JIG_CHECK:'));
    expect(attestationLine).toBeDefined();
    expect(attestationLine).not.toMatch(/mechanical=/);
  });
});

// --- C2: a global install's skill file must point at a home-anchored rules
// path, not a bare project-relative one that only resolves relative to
// whatever project the agent happens to be sitting in when it later reads
// the skill file. Since 0.4.0 the anchor is adapter-specific (each
// adapter's own `referenceDir`, see adapters/types.ts) rather than a
// hardcoded `.jig` — `install`/`update` compute it via `rulesPathFor` and
// pass it straight into `buildSkillBody`. ---
describe('buildSkillBody scope (C2)', () => {
  it('renders project-scope rule paths anchored at the given rules_path', () => {
    const body = buildSkillBody(repoRoot, '.claude/skills/jig/rules');
    expect(body).toContain('`.claude/skills/jig/rules/00-anti-patterns.md`');
    expect(body).toContain('`.claude/skills/jig/rules/01-modes.md`');
    expect(body).toContain('`.claude/skills/jig/rules/03-patterns.md`');
    expect(body).toContain('`.claude/skills/jig/rules/04-principles.md`');
    expect(body).toContain('`.claude/skills/jig/rules/05-copy.md`');
  });

  it('renders a home-anchored rules_path verbatim for a global install', () => {
    const body = buildSkillBody(repoRoot, '~/.claude/skills/jig/rules');
    expect(body).toContain('`~/.claude/skills/jig/rules/00-anti-patterns.md`');
    expect(body).toContain('`~/.claude/skills/jig/rules/01-modes.md`');
    expect(body).toContain('`~/.claude/skills/jig/rules/03-patterns.md`');
    expect(body).toContain('`~/.claude/skills/jig/rules/04-principles.md`');
    expect(body).toContain('`~/.claude/skills/jig/rules/05-copy.md`');
    // Must not also contain the bare project-scope form.
    expect(body).not.toContain('`.claude/skills/jig/rules/00-anti-patterns.md`');
  });
});

// --- rulesPathFor: the exact function install/update use to compute the
// rules_path baked into a rendered skill/instructions body. ---
describe('rulesPathFor', () => {
  it('is bare (project-relative) for project scope', async () => {
    const { rulesPathFor } = await import('../src/commands/install.js');
    expect(rulesPathFor('.claude/skills/jig', 'project')).toBe('.claude/skills/jig/rules');
  });

  it('is home-anchored for global scope', async () => {
    const { rulesPathFor } = await import('../src/commands/install.js');
    expect(rulesPathFor('.claude/skills/jig', 'global')).toBe('~/.claude/skills/jig/rules');
  });
});
