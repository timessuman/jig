import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../src/commands/install.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * The end-to-end case M2 describes. `checksum()` normalises CRLF before
 * hashing, so a file checked out under `core.autocrlf` matches its recorded
 * checksum — but the writes normalised nothing, so splicing an LF block into a
 * CRLF `AGENTS.md` left a file with mixed endings that the checksum could not
 * see. Mutation-checked: without `matchLineEndings`, this file comes back with
 * 3 CRLF and 10 lone LF.
 */
it('splices into a CRLF AGENTS.md without leaving mixed endings', () => {
  const project = mkdtempSync(join(tmpdir(), 'jig-crlf-'));
  const home = mkdtempSync(join(tmpdir(), 'jig-crlf-home-'));
  // A Windows checkout: the user's own AGENTS.md content, CRLF throughout.
  writeFileSync(join(project, 'AGENTS.md'), '# House rules\r\n\r\nUse tabs.\r\n');

  install({ agent: 'codex', scope: 'project', projectRoot: project,
            packageRoot: repoRoot, version: '0.4.0', homeDir: home });

  const after = readFileSync(join(project, 'AGENTS.md'), 'utf8');
  const loneLf = (after.match(/(?<!\r)\n/g) ?? []).length;
  expect(after).toContain('Use tabs.');
  expect(loneLf, 'mixed endings: LF lines inside a CRLF file').toBe(0);
  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});
