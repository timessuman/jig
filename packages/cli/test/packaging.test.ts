import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(process.cwd(), '..', '..');
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
