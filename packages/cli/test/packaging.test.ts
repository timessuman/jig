import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildSkillBody } from '../src/commands/install.js';

const repoRoot = join(process.cwd(), '..', '..');
const readme = () => readFileSync(join(repoRoot, 'README.md'), 'utf8');

// The commands `src/index.ts` actually registers on the commander program.
// Update this list the same commit a new command lands there — the tests
// below fail loudly if it drifts from `templates/command-metadata.json`.
const IMPLEMENTED_COMMANDS = ['install', 'update'];

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
    for (const agent of ['claude', 'codex', 'cursor', 'opencode', 'generic']) {
      expect(text).toContain(`npx jig-ui@latest install --agent ${agent}`);
    }
  });

  it('README no longer refers to the old name or config file', () => {
    const text = readme();
    expect(text).not.toMatch(/\bSquint\b/);
    expect(text).not.toContain('ui.config.json');
  });

  it('README does not advertise the unimplemented init command', () => {
    const text = readme();
    expect(text).not.toMatch(/jig-ui@latest init/);
  });
});

describe('installed skill file', () => {
  const body = buildSkillBody(repoRoot);
  const commandMetadata = JSON.parse(
    readFileSync(join(repoRoot, 'templates', 'command-metadata.json'), 'utf8'),
  ) as Record<string, { status?: string }>;

  it('marks every command src/index.ts registers as available', () => {
    for (const name of IMPLEMENTED_COMMANDS) {
      expect(commandMetadata[name]?.status).toBe('available');
    }
  });

  it('does not mark a command src/index.ts has not registered as available', () => {
    for (const [name, meta] of Object.entries(commandMetadata)) {
      if (meta.status === 'available') {
        expect(IMPLEMENTED_COMMANDS).toContain(name);
      }
    }
  });

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
