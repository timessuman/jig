import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assetRoot, findProjectRoot, getPackageRoot } from './paths.js';
import { install } from './commands/install.js';
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
      });
      console.log(`Installed Jig v${version} for ${opts.agent} (${opts.scope} scope)`);
      for (const f of result.written) console.log(`  + ${f}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
