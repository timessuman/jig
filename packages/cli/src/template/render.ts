export interface TemplateVars {
  command_prefix: string;
  scripts_path: string;
  ask_instruction: string;
  available_commands: string;
  config_file: string;
}

export interface CommandMetadata {
  [command: string]: { description: string; argumentHint: string };
}

const VAR = /\{\{([a-z_]+)\}\}/g;

export function render(template: string, vars: TemplateVars): string {
  return template.replace(VAR, (_match, name: string) => {
    const value = (vars as Record<string, string>)[name];
    if (value === undefined) {
      throw new Error(
        `Template variable '{{${name}}}' has no value. Known variables: ${Object.keys(vars).join(', ')}`,
      );
    }
    return value;
  });
}

export function renderCommandTable(metadata: CommandMetadata): string {
  const rows = Object.entries(metadata).map(([name, meta]) => {
    const signature = meta.argumentHint ? `${name} ${meta.argumentHint}` : name;
    return `| \`${signature}\` | ${meta.description} |`;
  });
  return ['| Command | Description |', '| --- | --- |', ...rows].join('\n');
}
