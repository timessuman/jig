import { describe, it, expect } from 'vitest';
import { render, renderCommandTable } from '../src/template/render.js';

const vars = {
  command_prefix: '/jig ',
  scripts_path: '/usr/local/bin/jig',
  ask_instruction: 'Ask directly in chat.',
  available_commands: 'TABLE',
  config_file: 'jig.config.json',
};

describe('render', () => {
  it('substitutes every known variable', () => {
    expect(render('run {{command_prefix}}check', vars)).toBe('run /jig check');
  });

  it('substitutes a variable used more than once', () => {
    expect(render('{{config_file}} and {{config_file}}', vars))
      .toBe('jig.config.json and jig.config.json');
  });

  it('throws on an unknown variable rather than substituting empty', () => {
    expect(() => render('hello {{nope}}', vars)).toThrow(/nope/);
  });

  it('leaves text with no variables untouched', () => {
    expect(render('plain text', vars)).toBe('plain text');
  });
});

describe('renderCommandTable', () => {
  const md = renderCommandTable({
    check: { description: 'Check things.', argumentHint: '[target]', status: 'planned' },
    init: { description: 'Set up.', argumentHint: '', status: 'available' },
  });

  it('renders a markdown table header with a status column', () => {
    expect(md.split('\n')[0]).toBe('| Command | Description | Status |');
  });

  it('includes the argument hint in the command cell', () => {
    expect(md).toContain('`check [target]`');
  });

  it('omits an empty argument hint', () => {
    expect(md).toContain('`init`');
    expect(md).not.toContain('`init `');
  });

  it('marks a planned command as not yet implemented', () => {
    const row = md.split('\n').find((line) => line.includes('`check [target]`'));
    expect(row).toContain('planned — not yet implemented');
  });

  it('marks an available command as available', () => {
    const row = md.split('\n').find((line) => line.includes('`init`'));
    expect(row).toContain('| available |');
  });

  it('defaults a command with no status field to available', () => {
    const legacy = renderCommandTable({ update: { description: 'Update.', argumentHint: '' } });
    expect(legacy).toContain('| available |');
    expect(legacy).not.toContain('planned');
  });

  it('escapes a pipe in the argument hint so it does not split the table row', () => {
    const withPipe = renderCommandTable({
      install: {
        description: 'Install stuff.',
        argumentHint: '--agent <name> [--scope project|global]',
        status: 'available',
      },
    });
    const row = withPipe.split('\n').find((line) => line.includes('install'))!;
    expect(row).toContain('project\\|global');
    // Exactly 4 real cell separators: leading, between command/description,
    // between description/status, trailing. Any unescaped `|` from cell
    // content would inflate this count.
    const unescapedPipes = row.match(/(?<!\\)\|/g);
    expect(unescapedPipes).toHaveLength(4);
  });

  it('escapes a pipe in the description as well', () => {
    const withPipe = renderCommandTable({
      foo: { description: 'Pick a|b.', argumentHint: '', status: 'available' },
    });
    const row = withPipe.split('\n').find((line) => line.includes('foo'))!;
    expect(row).toContain('a\\|b');
    const unescapedPipes = row.match(/(?<!\\)\|/g);
    expect(unescapedPipes).toHaveLength(4);
  });
});
