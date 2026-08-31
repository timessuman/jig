export interface TemplateVars {
  command_prefix: string;
  scripts_path: string;
  ask_instruction: string;
  available_commands: string;
  config_file: string;
}

export type CommandStatus = 'available' | 'planned';

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

export function renderCommandTable(metadata: CommandMetadata): string {
  const rows = Object.entries(metadata).map(([name, meta]) => {
    const signature = meta.argumentHint ? `${name} ${meta.argumentHint}` : name;
    const status = meta.status === 'planned' ? 'planned — not yet implemented' : 'available';
    return `| \`${signature}\` | ${meta.description} | ${status} |`;
  });
  return ['| Command | Description | Status |', '| --- | --- | --- |', ...rows].join('\n');
}
