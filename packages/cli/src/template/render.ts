export interface TemplateVars {
  command_prefix: string;
  scripts_path: string;
  /**
   * How to invoke `update`, which alone among the commands must NOT carry the
   * version pin `scripts_path` renders. `update` exists to move an install
   * forward; pinned, it refreshes to the version already installed and reports
   * success for a no-op, so a reader following the skill could never upgrade.
   */
  update_path: string;
  ask_instruction: string;
  available_commands: string;
  config_file: string;
  /**
   * Directory the vendored rule files live under, relative to wherever the
   * agent should resolve it from: `.jig` for a project-scope install (the
   * agent's own cwd), `~/.jig` for a global install (the user's home
   * directory) — see `buildSkillBody`'s `scope` parameter. Every rule-file
   * reference in the template must be built from this variable rather than
   * a hardcoded `.jig/...` literal, or a global install's skill file will
   * point an agent working in an unrelated project at a `.jig/` directory
   * that does not exist there (finding C2).
   */
  rules_path: string;
}

/**
 * `available` and `planned` describe a CLI binary — one that exists, one that
 * does not yet. `agent` is a different axis: the subcommand is a procedure the
 * agent carries out, and no binary will ever back it. `spec` and `make` are
 * judgment and authorship; a CLI can check their output but cannot do their
 * work, and listing them as "available" sends an agent to run a command that
 * does not exist.
 */
export type CommandStatus = 'available' | 'planned' | 'agent';

export interface CommandMetadata {
  [command: string]: {
    description: string;
    argumentHint: string;
    /**
     * Whether the command is registered in `src/index.ts` today. Missing
     * (as in older fixtures) is treated as `'available'` for backward
     * compatibility, but real `command-metadata.json` content should set
     * this explicitly for every entry.
     */
    status?: CommandStatus;
  };
}

const VAR = /\{\{([a-z_]+)\}\}/g;

export function render(template: string, vars: TemplateVars): string {
  return template.replace(VAR, (_match, name: string) => {
    if (!(name in vars)) {
      throw new Error(
        `Template variable '{{${name}}}' has no value. Known variables: ${Object.keys(vars).join(', ')}`,
      );
    }
    return vars[name as keyof TemplateVars];
  });
}

/**
 * Escapes `|` for use inside a GFM table cell. GFM splits table rows on
 * every `|`, including ones inside a code span — backticks do not protect
 * them — so any cell built from free-form text (an argument hint like
 * `[--scope project|global]`, or a description) must escape pipes before
 * being interpolated into a `| cell |` row, or the row silently gains extra
 * empty columns and every following cell shifts out of place.
 */
function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

export function renderCommandTable(metadata: CommandMetadata): string {
  const rows = Object.entries(metadata).map(([name, meta]) => {
    const signature = meta.argumentHint ? `${name} ${meta.argumentHint}` : name;
    // Three statuses, because there are two kinds of subcommand. `available`
    // and `planned` describe a CLI binary; `agent` describes a procedure the
    // agent performs itself, with no binary behind it at all. Calling those
    // "available" would send an agent to run `jig spec`, which does not exist
    // and never will — the work is the agent's, not the CLI's.
    const status =
      meta.status === 'planned'
        ? 'planned — not yet implemented'
        : meta.status === 'agent'
          ? 'agent procedure — no CLI to run'
          : 'available';
    return `| \`${escapeTableCell(signature)}\` | ${escapeTableCell(meta.description)} | ${status} |`;
  });
  return ['| Command | Description | Status |', '| --- | --- | --- |', ...rows].join('\n');
}
