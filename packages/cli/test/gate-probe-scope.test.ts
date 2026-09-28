import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { surfacesToProbe } from '../src/commands/gate.js';

/**
 * jig-site: every stop of a Guide session re-rendered the probes of home, the
 * Reference, the header and Versions, because the header gained a link, and
 * left sixty probe files changed that no one had asked for. The Stop hook
 * refreshes the probes of the critiques it judges, and no others.
 */
let root: string;
const transcript = (command: string, surface: string) => {
  const path = join(root, `t-${command}.jsonl`);
  writeFileSync(path, [
    { type: 'user', timestamp: new Date(Date.now() + 60_000).toISOString(), message: { content: `<command-name>/jig</command-name>\n<command-args>${command} ${surface}</command-args>` } },
  ].map((e) => JSON.stringify(e)).join('\n') + '\n');
  return path;
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-probe-scope-'));
  mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
  writeFileSync(join(root, '.jig', 'specs', 'guide.spec.md'), '---\nsurface: guide\n---\n');
  for (const s of ['guide', 'home', 'reference']) {
    mkdirSync(join(root, '.jig', 'critique', s), { recursive: true });
    writeFileSync(join(root, '.jig', 'critique', s, 'screen.json'), '{"verdicts":[]}');
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('the probes the Stop hook refreshes', () => {
  it('are none of the other pages for a make session', () => {
    expect(surfacesToProbe(root, { session_id: 'm', transcript_path: transcript('make', 'guide') })).toEqual([]);
  });

  it('are the critique\'s own page for a critique session', () => {
    expect(surfacesToProbe(root, { session_id: 'c', transcript_path: transcript('critique', 'guide') })).toEqual(['guide']);
  });

  it('are every critique when run by hand, with no session to date', () => {
    expect(surfacesToProbe(root, {}).sort()).toEqual(['guide', 'home', 'reference']);
  });
});
