import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { assetRoot, findProjectRoot, getPackageRoot } from './paths.js';
import { install } from './commands/install.js';
import { update } from './commands/update.js';
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

program.parse();
