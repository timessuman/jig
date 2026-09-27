#!/usr/bin/env node
// pack-dev.mjs: pack this checkout as a dev build, to try on a real project
// before anything is released.
//
//   node scripts/pack-dev.mjs            -> .dev-builds/jig-ui-<next minor>-dev.<n>.tgz
//   node scripts/pack-dev.mjs 0.20.2     -> .dev-builds/jig-ui-0.20.2-dev.<n>.tgz
//
// A version carrying `-dev` is never published. Installed from the tarball,
// its skill, commands and Stop hook run the `jig` on PATH rather than
// `npx jig-ui@<version>`, which npm could not resolve (packages/cli/src/paths.ts,
// isDevVersion). jig-site switches onto it with its scripts/use-jig.mjs.
//
// Why: 0.20.0 was published, jig-site found a small gap within the hour, and
// that became 0.20.1. A fix is tried here first; a release is cut once the
// project runs clean on it.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages', 'cli');
const pkgPath = join(cli, 'package.json');
const original = readFileSync(pkgPath, 'utf8');
const released = JSON.parse(original).version;

const [major, minor] = released.split('.').map(Number);
const base = process.argv[2] ?? `${major}.${minor + 1}.0`;
if (!/^\d+\.\d+\.\d+$/.test(base)) {
  console.error(`pack-dev: "${base}" is not a version like 0.21.0.`);
  process.exit(1);
}

const out = join(root, '.dev-builds');
mkdirSync(out, { recursive: true });
const taken = readdirSync(out)
  .map((f) => new RegExp(`^jig-ui-${base.replace(/\./g, '\\.')}-dev\\.(\\d+)\\.tgz$`).exec(f)?.[1])
  .filter(Boolean)
  .map(Number);
const version = `${base}-dev.${taken.length ? Math.max(...taken) + 1 : 1}`;

// The version is read from package.json at run time (src/index.ts), so the
// tarball carries it; the checkout's own package.json is put back either way.
writeFileSync(pkgPath, original.replace(`"version": "${released}"`, `"version": "${version}"`));
try {
  // What prepack does, run first, so the pack's own output is only its JSON.
  execFileSync('npm', ['run', 'build'], { cwd: cli, stdio: ['ignore', 'ignore', 'inherit'] });
  execFileSync('node', ['scripts/stage-assets.mjs'], { cwd: cli, stdio: ['ignore', 'ignore', 'inherit'] });
  const [info] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', out], { cwd: cli, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
  console.log(`pack-dev: ${join(out, info.filename)}`);
  console.log(`pack-dev: version ${version}, from ${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()}${execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() ? ' with uncommitted changes' : ''}`);
} finally {
  writeFileSync(pkgPath, original);
}
