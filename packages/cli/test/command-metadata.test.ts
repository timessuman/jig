import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commandMetadata as metadata, registeredCommands, registeredFlags, repoRoot } from './helpers/registered-commands.js';

/**
 * `templates/command-metadata.json` is what the skill file tells the agent it
 * can run. When it drifts from the CLI, the agent pays the cost: a baseline run
 * reported "the `check` command is live, even though the vendored SKILL.md still
 * lists it as 'planned' — the CLI is ahead of the doc", and had to run `--help`
 * to find out what was true. Every agent would have paid that same tax.
 */

describe('command-metadata.json agrees with the CLI', () => {
  it('finds the registered commands at all (guards the parser itself)', () => {
    // If the regex ever stops matching, every assertion below would pass
    // vacuously — the drift check would silently stop checking.
    expect(registeredCommands()).toContain('install');
    expect(registeredCommands().length).toBeGreaterThanOrEqual(4);
  });

  it('marks every registered command available', () => {
    const meta = metadata();
    for (const name of registeredCommands()) {
      expect(meta[name], `'${name}' is registered in the CLI but absent from the metadata`).toBeDefined();
      expect(
        meta[name].status,
        `'${name}' is registered in the CLI, so the skill must not call it planned`,
      ).toBe('available');
    }
  });

  it('marks every unregistered command planned', () => {
    const registered = new Set(registeredCommands());
    for (const [name, entry] of Object.entries(metadata())) {
      if (registered.has(name)) continue;
      expect(entry.status, `'${name}' is not registered, so the skill must not call it available`).toBe(
        'planned',
      );
    }
  });

  it('gives every command a description and a status the skill file understands', () => {
    for (const [name, entry] of Object.entries(metadata())) {
      expect(entry.description, `'${name}' description`).toBeTruthy();
      expect(typeof entry.argumentHint, `'${name}' argumentHint`).toBe('string');
      expect(['available', 'planned'], `'${name}' status`).toContain(entry.status);
    }
  });
});

describe('the slash-command body covers every available command', () => {
  it('gives each one its own section', () => {
    // The body lists the subcommands from the metadata and then tells the agent
    // to "do the work below for that subcommand". `explain` was listed in the
    // header and the argument hint while having no section at all, so an agent
    // reaching that instruction found nothing.
    const tmpl = readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');
    const sections = [...tmpl.matchAll(/^## ([a-z-]+)$/gm)].map((m) => m[1]);
    const available = Object.entries(metadata())
      .filter(([, v]) => v.status === 'available')
      .map(([k]) => k);
    expect(available.length).toBeGreaterThan(3);
    for (const name of available) {
      expect(sections, `no '## ${name}' section in COMMAND.md.tmpl`).toContain(name);
    }
  });
});

/**
 * The harness must know what the CLI can do.
 *
 * `explain` gained a search mode and `--list`, and the CLI, the README and the
 * command metadata were all updated while `templates/COMMAND.md.tmpl` — the
 * file that actually tells an agent how to use the command — kept describing
 * only the id lookup. The feature worked (flags pass through unchanged) and no
 * agent would ever have reached for it, which is the same as not shipping it.
 *
 * Nothing caught that, because every existing guard checks the command NAMES.
 * This checks the flags.
 */
describe('every flag the CLI declares reaches the harness', () => {
  const harnessText = () =>
    readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8') +
    readFileSync(join(repoRoot, 'templates/SKILL.md.tmpl'), 'utf8') +
    JSON.stringify(metadata());

  it('finds flags at all (guards the parser itself)', () => {
    const flags = registeredFlags();
    expect(flags.check, 'no flags parsed for check — the parser broke').toContain('--all');
    expect(flags.explain).toContain('--list');
  });

  it('mentions each one somewhere an agent will read', () => {
    const text = harnessText();
    const missing: string[] = [];
    for (const [command, flags] of Object.entries(registeredFlags())) {
      for (const flag of flags) {
        if (!text.includes(flag)) missing.push(`${command} ${flag}`);
      }
    }
    expect(missing, `flags the CLI accepts that no harness file mentions: ${missing.join(', ')}`)
      .toEqual([]);
  });
});
