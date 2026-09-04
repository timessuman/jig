import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';
import { commandMetadata as metadata, registeredCommands } from './helpers/registered-commands.js';

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
