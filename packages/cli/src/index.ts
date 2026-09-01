import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { assetRoot, findProjectRoot, getPackageRoot } from './paths.js';
import { install } from './commands/install.js';
import { update } from './commands/update.js';
import { check } from './commands/check.js';
import { adapterNames } from './adapters/registry.js';

const packageRoot = getPackageRoot();
const { version } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string };

const program = new Command();
program.name('jig').description('A design system for coding agents.').version(version);

program
  .command('install')
  .description('Install Jig rules and the agent skill file into a repository.')
  .requiredOption('--agent <name>', `target agent (${adapterNames().join(', ')})`)
  .option('--scope <scope>', 'project or global', 'project')
  .action((opts: { agent: string; scope: string }) => {
    if (opts.scope !== 'project' && opts.scope !== 'global') {
      console.error(`Invalid scope '${opts.scope}'. Use 'project' or 'global'.`);
      process.exit(1);
    }
    const projectRoot = findProjectRoot(process.cwd());
    try {
      const result = install({
        agent: opts.agent,
        scope: opts.scope,
        projectRoot,
        packageRoot: assetRoot(),
        version,
        homeDir: homedir(),
      });
      console.log(`Installed Jig v${version} for ${opts.agent} (${opts.scope} scope)`);
      for (const f of result.written) console.log(`  + ${f}`);
      for (const f of result.skipped) console.log(`  · ${f} (edited locally, left alone)`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update vendored Jig rules, skipping files you have edited.')
  .action(() => {
    const projectRoot = findProjectRoot(process.cwd());
    try {
      // `agent`/`scope` here are placeholders required by the shared
      // `InstallOptions` shape — `update()` ignores them and instead
      // discovers the real agent/scope from whichever manifest it finds
      // (projectRoot first, then homeDir), so the same install that was
      // created is the one that gets updated regardless of these values.
      const result = update({
        agent: '',
        scope: 'project',
        projectRoot,
        packageRoot: assetRoot(),
        version,
        homeDir: homedir(),
      });
      console.log(`Updated Jig ${result.fromVersion} → ${result.toVersion}`);
      for (const f of result.updated) console.log(`  ~ ${f}`);
      for (const f of result.skipped) console.log(`  · ${f} (edited locally, left alone)`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description("Check the repo against Jig's mechanical + hybrid rules.")
  .option('--all', 'check the whole repo instead of just changed files', false)
  .option('--ci', 'mechanical bucket only; exits non-zero on any error, deterministic', false)
  .option('--json', 'emit findings as JSON', false)
  .action((opts: { all: boolean; ci: boolean; json: boolean }) => {
    const projectRoot = findProjectRoot(process.cwd());
    try {
      const result = check({
        projectRoot,
        homeDir: homedir(),
        version,
        all: opts.all,
        ci: opts.ci,
      });
      console.log(opts.json ? JSON.stringify(result.findings, null, 2) : result.report);
      if (opts.ci && result.hasError) process.exit(1);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
