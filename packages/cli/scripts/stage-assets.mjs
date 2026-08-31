#!/usr/bin/env node
// Copies bundled assets from the repo root into packages/cli so `npm pack`
// / `npm publish` (which run `prepack`) include them in the published
// tarball. In the monorepo these assets live at the repo root; a published
// jig-ui package needs its own copies alongside dist/.
//
// Runs on every `prepack`. Sources that don't exist yet are skipped rather
// than treated as errors, since some (rules.index.json, templates/) are
// introduced by later tasks in this plan.

import { existsSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(cliRoot, '..', '..');

const ASSETS = ['rules', 'tokens', 'templates', 'rules.index.json', 'LICENSE', 'NOTICE', 'README.md'];

for (const name of ASSETS) {
  const src = join(repoRoot, name);
  const dest = join(cliRoot, name);

  if (!existsSync(src)) {
    continue;
  }

  cpSync(src, dest, { recursive: true, force: true });
  console.log(`staged ${name}`);
}
