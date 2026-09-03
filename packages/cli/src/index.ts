import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { assetRoot, findProjectRoot, getPackageRoot, isPublishedBuild } from './paths.js';
import { install } from './commands/install.js';
import { update } from './commands/update.js';
import { check } from './commands/check.js';
import { init } from './commands/init.js';
import { adapterNames } from './adapters/registry.js';

const packageRoot = getPackageRoot();
const { version } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string };

/**
 * The skill file pins `npx jig-ui@<version>`. That only resolves if this
 * version is on npm, which is guaranteed when this CLI came from npm and not
 * otherwise — so say so rather than let an agent discover it as a 404 later.
 */
function warnIfUnpublishedPin(): void {
  if (isPublishedBuild(packageRoot)) return;
  console.warn(
    `Note: this is a source build, so the skill pins 'npx jig-ui@${version}' — a version that ` +
      `may not be published. Agents reading it will not be able to run the CLI until it is. ` +
      `Re-run install or update from a published build to correct the pin.`,
  );
}

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
      if (result.warning) {
        console.warn(result.warning);
        return;
      }
      console.log(`Installed Jig v${version} for ${opts.agent} (${opts.scope} scope)`);
      warnIfUnpublishedPin();
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
      const label = result.targets
        .map((t) => `${t.agent} (${t.scope}, ${t.fromVersion})`)
        .join(', ');
      warnIfUnpublishedPin();
      console.log(
        `Updated Jig → ${result.toVersion} in ${result.targets.length} harness${
          result.targets.length === 1 ? '' : 'es'
        }: ${label}`,
      );
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

program
  .command('init')
  .description("Set the project up to use Jig: a brand file, jig.config.json, and a baseline check.")
  .option('--yes', 'non-interactive: derive everything, accept the proposal, ask nothing', false)
  .action(async (opts: { yes: boolean }) => {
    const projectRoot = findProjectRoot(process.cwd());
    try {
      await init({
        projectRoot,
        packageRoot: assetRoot(),
        homeDir: homedir(),
        version,
        yes: opts.yes,
      });
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
