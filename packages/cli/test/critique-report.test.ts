import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate } from '../src/commands/gate.js';

/**
 * jig-site: the Guide's first critique held seven findings in its verdict
 * files and listed six in REPORT.md. I-83 was in the files and nowhere in the
 * report, which is what the owner and the next make read.
 */
let root: string;
const dir = () => join(root, '.jig', 'critique', 'guide');
const run = () => {
  const path = join(root, 't.jsonl');
  writeFileSync(path, JSON.stringify({ type: 'user', message: { content: '<command-name>/jig</command-name>\n<command-args>critique guide</command-args>' } }) + '\n');
  return gate({ projectRoot: root, version: '0.21.0', input: { session_id: 'c', transcript_path: path } });
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-report-'));
  writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }] }));
  mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
  writeFileSync(join(root, '.jig', 'specs', 'guide.spec.md'), '---\nsurface: guide\n---\n');
  mkdirSync(dir(), { recursive: true });
  writeFileSync(join(dir(), 'code.json'), JSON.stringify({ verdicts: [
    { id: 'I-83', verdict: 'finding', reason: 'six agents is spelled out' },
    { id: 'H-46', verdict: 'finding', reason: 'inline code is unstyled' },
    { id: 'A-01', verdict: 'ok', reason: 'fine' },
  ] }));
  writeFileSync(join(dir(), 'decisions.json'), JSON.stringify({ verdicts: [
    { decision: 'Current page in navigation: a bar, not an underline', verdict: 'finding', reason: 'the rail has no bar' },
  ] }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('a critique report', () => {
  it('is refused when it leaves out a finding its verdict files hold', () => {
    writeFileSync(join(dir(), 'REPORT.md'), '# Critique\n\n1. **H-46**: unstyled code.\n2. "Current page in navigation: a bar, not an underline": no bar.\n');
    expect(run().reason).toMatch(/REPORT\.md leaves out a finding the verdict files hold: I-83/);
  });

  it('passes when it names every finding', () => {
    writeFileSync(join(dir(), 'REPORT.md'), '# Critique\n\n1. H-46.\n2. i-83.\n3. current page in navigation: a bar, not an underline.\n');
    expect(run().reason ?? '').not.toMatch(/leaves out/);
  });

  it('is not asked for where the project keeps no report file', () => {
    expect(run().reason ?? '').not.toMatch(/leaves out/);
  });
});
