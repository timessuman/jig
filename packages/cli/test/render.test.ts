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
    check: { description: 'Check things.', argumentHint: '[target]' },
    init: { description: 'Set up.', argumentHint: '' },
  });

  it('renders a markdown table header', () => {
    expect(md.split('\n')[0]).toBe('| Command | Description |');
  });

  it('includes the argument hint in the command cell', () => {
    expect(md).toContain('`check [target]`');
  });

  it('omits an empty argument hint', () => {
    expect(md).toContain('`init`');
    expect(md).not.toContain('`init `');
  });
});
