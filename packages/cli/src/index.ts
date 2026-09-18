import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { assetRoot, findProjectRoot, getPackageRoot, isPublishedBuild } from './paths.js';
import { install } from './commands/install.js';
import { update } from './commands/update.js';
import { explain } from './commands/explain.js';
import { check } from './commands/check.js';
import { init } from './commands/init.js';
import { verifyVerdicts } from './commands/verdicts.js';
import { gate, surfacePage } from './commands/gate.js';
import { PROBE_SCRIPT } from './probe/script.js';
import { critiquedSurfaces, ensureProbes, runAndSaveProbes, saveProbe } from './probe/save.js';
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
  .option('--hook', 'add the Stop hook that blocks finishing while check or a step fails (Claude Code, project scope)')
  .option('--no-hook', 'do not add the Stop hook, and do not ask for it')
  .option('--yes', 'non-interactive: ask nothing, and add no Stop hook unless --hook is given', false)
  .action(async (opts: { agent: string; scope: string; hook?: boolean; yes: boolean }) => {
    if (opts.scope !== 'project' && opts.scope !== 'global') {
      console.error(`Invalid scope '${opts.scope}'. Use 'project' or 'global'.`);
      process.exit(1);
    }
    const projectRoot = findProjectRoot(process.cwd());
    // The hook changes how the editor behaves, so it is never written without
    // an answer. `--yes` is the agent path, where nobody can give one.
    let hook = opts.hook === true;
    const unanswered = opts.hook === undefined;
    if (unanswered && opts.agent === 'claude' && opts.scope === 'project' && !opts.yes && process.stdin.isTTY) {
      const { createInterface } = await import('node:readline/promises');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        console.log('\nClaude Code can run a Jig check when the agent tries to finish, and hold it there while');
        console.log('the files it changed fail `check`, or the /jig step it just ran is unfinished. It adds one');
        console.log('entry to .claude/settings.json, keeps everything else in that file, and lets go after three');
        console.log('attempts. Weak models skip steps they are only asked to run; this is what catches that.');
        const answer = (await rl.question('  Add it? [y/N]: ')).trim().toLowerCase();
        hook = answer === 'y' || answer === 'yes';
      } finally {
        rl.close();
      }
    }
    try {
      const result = install({
        agent: opts.agent,
        scope: opts.scope,
        projectRoot,
        packageRoot: assetRoot(),
        version,
        homeDir: homedir(),
        hook,
      });
      if (result.warning) {
        console.warn(result.warning);
        return;
      }
      console.log(`Installed Jig v${version} for ${opts.agent} (${opts.scope} scope)`);
      warnIfUnpublishedPin();
      for (const f of result.written) console.log(`  + ${f}`);
      for (const f of result.skipped) console.log(`  · ${f} (edited locally, left alone)`);
      if (result.stopHook === true) console.log('  + .claude/settings.json (Stop hook: jig gate blocks finishing while check or a critique fails)');
      if (result.stopHook === false) console.log('  ! .claude/settings.json is not valid JSON — the Stop hook was not added. Fix the file and run install again.');
      if (result.stopHook === undefined && opts.agent === 'claude' && opts.scope === 'project') {
        console.log('  · No Stop hook. Add it any time with: npx jig-ui@' + version + ' install --agent claude --hook');
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('explain')
  .description("Explain a rule, or find the rules you cannot name.")
  .argument('[query]', "a rule id ('C-19'), a word to search for ('contrast'), or a section letter with --list")
  .option('--list', 'list every rule id and title, or one section with a section letter')
  .option('--layer', 'name the six layers, or list one of them by name')
  .action((query: string | undefined, options: { list?: boolean; layer?: boolean }) => {
    try {
      console.log(explain({ ruleId: query ?? '', version, list: options.list, layer: options.layer }));
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
  .command('verdicts')
  .description("Verify a critique's verdict files and compute its counts.")
  .argument('<surface>', 'the surface slug the critique wrote under .jig/critique/')
  .action((surface: string) => {
    const projectRoot = findProjectRoot(process.cwd());
    try {
      const result = verifyVerdicts({ projectRoot, surface });
      for (const error of result.errors) console.error(`  ✗ ${error}`);
      if (result.ok) console.log(`  Every rule in both passes has a verdict.`);
      console.log(`  ${result.line}`);
      process.exit(result.ok ? 0 : 1);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description("Check the repo against Jig's mechanical + hybrid rules.")
  .option(
    '--all',
    // Names the files, because the default scope surprised a user who read
    // this as widening the RULES and attested a clean diff as a clean project.
    'scan every file in the repo, not just those changed since HEAD (same rules either way)',
    false,
  )
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
  .command('probe')
  .description("Print the render probe. With --save, read what it returned on stdin and record it for `jig verdicts`.")
  .option('--save <surface>', "record the probe's output (piped in) under .jig/critique/<surface>/")
  .option('--run <page>', 'render this page here, at 360, 768 and 1280, and record each (needs --save)')
  .action(async (opts: { save?: string; run?: string }) => {
    if (opts.run) {
      if (!opts.save) {
        console.error('  ✗ --run records what it measures, so it needs --save <surface>.');
        process.exit(1);
      }
      const projectRoot = findProjectRoot(process.cwd());
      try {
        for (const saved of await runAndSaveProbes({ projectRoot, surface: opts.save, page: opts.run })) {
          console.log(`  Recorded ${saved.path} — ${saved.page} at ${saved.width}px.`);
        }
      } catch (err) {
        console.error(`  ✗ ${(err as Error).message}`);
        process.exit(1);
      }
      return;
    }
    if (!opts.save) {
      console.log(PROBE_SCRIPT);
      return;
    }
    const projectRoot = findProjectRoot(process.cwd());
    try {
      // Read the stream, not fd 0: a pipe can be non-blocking, and a
      // readFileSync(0) against one fails with EAGAIN rather than waiting.
      const json = process.stdin.isTTY ? '' : await new Promise<string>((done, fail) => {
        let text = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => { text += chunk; });
        process.stdin.on('end', () => done(text));
        process.stdin.on('error', fail);
      });
      const result = saveProbe({ projectRoot, surface: opts.save, json });
      console.log(`  Recorded ${result.path} — ${result.page} at ${result.width}px.`);
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('gate')
  .description('Run by the Claude Code Stop hook: block stopping while check or a critique fails.')
  .action(async () => {
    let input = {};
    try {
      if (!process.stdin.isTTY) input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    } catch { /* run by hand, or no hook payload */ }
    const cwd = (input as { cwd?: string }).cwd ?? process.cwd();
    try {
      const projectRoot = findProjectRoot(cwd);
      // Render what the review needs before judging it. A browser on this
      // machine means the probe is not a step anyone can skip; without one,
      // the gate falls back to naming what is missing.
      for (const surface of critiquedSurfaces(projectRoot)) {
        const page = surfacePage(projectRoot, surface);
        if (!page) continue;
        try {
          await ensureProbes({ projectRoot, surface, page });
        } catch { /* the gate reports the absence; a browser failure is not its own verdict */ }
      }
      const result = gate({ projectRoot, version, input });
      if (result.block) console.log(JSON.stringify({ decision: 'block', reason: result.reason }));
      else if (result.reason) console.error(result.reason);
    } catch (err) {
      // A gate that crashes must not block the agent; it says why and lets go.
      console.error(`jig gate: ${(err as Error).message}`);
    }
    process.exit(0);
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
