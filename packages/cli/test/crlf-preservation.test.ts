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

/**
 * The same property for the token files `init` vendors, which `update`
 * refreshes through a DIFFERENT code path.
 *
 * That path wrote directly rather than through the install writer, and had
 * lost `matchLineEndings` somewhere along the way — so a CRLF token file came
 * back LF-only from `jig update` while the rule files beside it, written by the
 * path that still had it, kept their CRLF. Nobody chose that; it is what three
 * near-copies of eight lines does. All three now go through
 * `install/writer.ts`, and this is the half that was actually broken.
 */
it('refreshes a CRLF token file without flattening it to LF', async () => {
  const { init } = await import('../src/commands/init.js');
  const { update } = await import('../src/commands/update.js');
  const { install: doInstall } = await import('../src/commands/install.js');
  const { readInitManifest } = await import('../src/init/state.js');
  const { readdirSync } = await import('node:fs');

  const project = mkdtempSync(join(tmpdir(), 'jig-crlf-tok-'));
  const home = mkdtempSync(join(tmpdir(), 'jig-crlf-tok-home-'));
  const opts = { agent: 'claude', scope: 'project' as const, projectRoot: project,
                 packageRoot: repoRoot, homeDir: home };

  doInstall({ ...opts, version: '0.4.0' });
  await init({ projectRoot: project, packageRoot: repoRoot, homeDir: home,
               version: '0.4.0', yes: true, log: () => {} });

  // `update` only refreshes a vendored token file whose name it also finds in
  // the package. Pick one of those rather than guessing a filename — init
  // derives the brand file's name from the project, so it is never a match.
  const manifest = readInitManifest(project)!;
  const packaged = new Set(readdirSync(join(repoRoot, 'tokens')));
  // Located from the sidecar, not from a hardcoded directory: the token layer
  // now follows the project's own layout, so `.jig/tokens/` is one possible
  // answer rather than the answer.
  const key = Object.keys(manifest.files).find((k) => packaged.has(k.split('/').pop()!));
  expect(key, 'no vendored token file that update would refresh — test is vacuous')
    .toBeDefined();

  const tokenFile = join(project, ...key!.split('/'));
  // A Windows checkout of a file Jig owns: same bytes, CRLF endings. `checksum`
  // normalises CRLF, so this still reads as unmodified and `update` refreshes
  // it rather than skipping it — which is the case that was broken.
  writeFileSync(tokenFile, readFileSync(tokenFile, 'utf8').replace(/\n/g, '\r\n'));

  update({ ...opts, version: '0.4.1' });

  const after = readFileSync(tokenFile, 'utf8');
  const loneLf = (after.match(/(?<!\r)\n/g) ?? []).length;
  expect(after.length, 'the token file was not rewritten at all').toBeGreaterThan(0);
  expect(loneLf, 'update flattened a CRLF token file to LF').toBe(0);

  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});
