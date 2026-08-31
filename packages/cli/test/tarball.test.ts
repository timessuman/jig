import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * Validates the ACTUAL published tarball contents rather than trusting
 * `package.json`'s `prepack`/`files` configuration. `npm pack --dry-run
 * --json` runs the real `prepack` lifecycle script (build included) and
 * reports exactly what would ship — this is the only way to catch a
 * `prepack` that stages assets but never builds `dist/`, which would leave
 * `bin.jig` pointing at a file that does not exist in the published package
 * (see finding C1).
 *
 * `npm`'s own build-tool subprocesses (tsup, the stage-assets script) log to
 * the same stdout stream ahead of npm's JSON payload, so the JSON is
 * extracted from the last line that is exactly `[` onward rather than
 * parsing the whole stream.
 */
function packDryRunFiles(): string[] {
  const raw = execSync('npm pack --dry-run --json', {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const lines = raw.split('\n');
  const startIdx = lines.map((l) => l.trim()).lastIndexOf('[');
  if (startIdx === -1) {
    throw new Error(`Could not locate JSON payload in npm pack output:\n${raw}`);
  }
  const json = lines.slice(startIdx).join('\n');
  const parsed = JSON.parse(json) as Array<{ files: Array<{ path: string }> }>;
  return parsed[0].files.map((f) => f.path);
}

describe('published tarball (C1)', () => {
  // Building via tsup + staging assets takes longer than vitest's default
  // test timeout.
  const files = packDryRunFiles();

  it('includes the CLI entrypoint dist/index.js', () => {
    expect(files).toContain('dist/index.js');
  });

  it('includes the vendored rules directory', () => {
    expect(files.some((f) => f.startsWith('rules/'))).toBe(true);
  });

  it('includes the templates directory', () => {
    expect(files.some((f) => f.startsWith('templates/'))).toBe(true);
  });

  it('includes rules.index.json', () => {
    expect(files).toContain('rules.index.json');
  });

  it('includes LICENSE and NOTICE', () => {
    expect(files).toContain('LICENSE');
    expect(files).toContain('NOTICE');
  });
}, 30000);
