import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/registered-commands.js';

const tmpl = () => readFileSync(join(repoRoot, 'templates/COMMAND.md.tmpl'), 'utf8');
const section = (name: string, next: string) => tmpl().split(`\n## ${name}\n`)[1].split(`\n## ${next}\n`)[0];

describe('the command loop runs one feature at a time', () => {
  it('lists mockup as an agent procedure, between spec and make', () => {
    const head = tmpl().split('\n## ')[0];
    expect(head).toMatch(/`decide`, `spec`, `mockup`, `make`, `critique`/);
    const order = ['decide', 'spec', 'mockup', 'make', 'critique'].map((c) => head.indexOf(`\n${c} `));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('says outright that the whole product is not designed up front', () => {
    expect(tmpl().split('\n## ')[0]).toMatch(/never the whole product at once/);
  });
});

describe('spec starts from a feature and scopes it down', () => {
  const spec = () => section('spec', 'mockup');
  it('asks for a task, not a screen', () => {
    expect(spec()).toMatch(/Start with a feature, not a layout/);
    expect(spec()).toMatch(/State it as a task/);
  });
  it('cuts to the smallest useful version and records what was cut', () => {
    expect(spec()).toMatch(/smallest version that is useful on its own/);
    expect(spec()).toMatch(/^later: \[/m);
  });
  it('leaves the mockup pending for the next command', () => {
    expect(spec()).toMatch(/^mockup: pending/m);
    expect(spec()).toMatch(/^mockup_at:/m);
    expect(spec()).toMatch(/^feature: /m);
  });
  it('does not invent a navigation shell for the first feature', () => {
    expect(spec()).toMatch(/No shell before there are features/);
  });
});

describe('mockup', () => {
  const mockup = () => section('mockup', 'make');
  // The stylesheet itself, from its code fence — the prose above it also
  // mentions `<style>`, so splitting on the tag alone reads the paragraph.
  const wireframe = () => mockup().split('```html')[1].split('```')[0];

  it('draws one specified feature, and refuses the whole app', () => {
    expect(mockup()).toMatch(/draws \*\*one feature\*\*/);
    expect(mockup()).toMatch(/mock up the app/);
  });

  it('is grayscale, tokenless and undecorated', () => {
    expect(mockup()).toMatch(/Grayscale only/);
    expect(mockup()).toMatch(/No tokens and no project CSS/);
    expect(mockup()).toMatch(/No icons, imagery, shadows or decoration/);
  });

  // Grayscale by construction, not by instruction: every colour the shipped
  // wireframe stylesheet sets has equal red, green and blue.
  it('ships a wireframe stylesheet with no colour in it', () => {
    const style = wireframe();
    const hexes = style.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexes.length).toBeGreaterThan(3);
    for (const hex of hexes) {
      const h = hex.slice(1);
      const [r, g, b] = h.length === 3 ? [h[0], h[1], h[2]] : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
      expect(r === g && g === b, `${hex} is not grey`).toBe(true);
    }
    expect(style).not.toMatch(/\b(rgb|hsl|oklch)a?\(|var\(--/);
  });

  it('draws every size, phone first', () => {
    const style = wireframe();
    const phone = style.indexOf('data-size="phone"');
    expect(phone).toBeGreaterThan(-1);
    expect(style.indexOf('data-size="tablet"')).toBeGreaterThan(phone);
    expect(style.indexOf('data-size="desktop"')).toBeGreaterThan(style.indexOf('data-size="tablet"'));
    expect(mockup()).toMatch(/Size is structure, not\s+detail/);
  });

  // Design-to-code parity through a design tool is in scope. Jig ships neither
  // tool and writes nothing for either: they are MCP servers the user connects.
  // The owner's ruling: ask every time — HTML, Figma or Stitch — and when a
  // chosen tool's MCP server is missing, tell the user to connect it and wait.
  it('asks the user every time whether to draw in HTML, Figma or Stitch', () => {
    expect(mockup()).toMatch(/Ask every time, before drawing anything/);
    for (const way of ['HTML', 'Figma', 'Google Stitch']) expect(mockup()).toContain(`**${way}**`);
    expect(mockup()).toMatch(/Jig ships neither tool and writes nothing for either/);
  });

  it('tells the user to connect a missing server, waits, and does not switch for them', () => {
    expect(mockup()).toMatch(/they need to connect it/);
    expect(mockup()).toMatch(/stop and wait/);
    expect(mockup()).toMatch(/Do not switch to HTML on their behalf/);
  });

  it('refuses a polished Stitch screen as a mockup', () => {
    expect(mockup()).toMatch(/it is not a mockup/);
  });

  it('can review an existing design, for structure only', () => {
    expect(mockup()).toMatch(/An existing design the user already has/);
    expect(mockup()).toMatch(/reviews structure only/);
  });

  it('puts every review change into the spec before redrawing', () => {
    expect(mockup()).toMatch(/Every change goes into the spec first/);
    expect(mockup()).toMatch(/Never adjust the drawing alone/);
  });

  it('records approval only from the user, and a skip only with their reason', () => {
    expect(mockup()).toMatch(/mockup: approved/);
    expect(mockup()).toMatch(/mockup: skipped — <their reason>/);
    expect(mockup()).toMatch(/Only their own response counts/);
  });
});

describe('make and critique honour the mockup without depending on it', () => {
  it('make refuses an unreviewed feature and will not skip the mockup itself', () => {
    const make = section('make', 'critique');
    expect(make).toMatch(/`mockup: pending`/);
    expect(make).toMatch(/Do not decide to\s+skip it yourself/);
  });
  it('make builds from the spec, never the drawing or code generated from it, and V1 only', () => {
    const make = section('make', 'critique');
    expect(make).toMatch(/From the spec, never from the drawing/);
    expect(make).toMatch(/code\s+generated from a Figma or Stitch frame/);
    expect(make).toMatch(/Build V1 only/);
  });
  it('critique judges the page against the spec, not the drawing', () => {
    expect(tmpl().split('\n## critique\n')[1]).toMatch(/Compare the page to its spec — not to the mockup/);
  });
});

describe('init no longer describes the behaviour #79 removed', () => {
  it('does not claim --yes writes a product mapping', () => {
    expect(tmpl()).not.toMatch(/with `--yes` it takes\s+`'\/' → product`/);
  });
});

describe('the loop is documented where people and agents look', () => {
  it('README lists every agent procedure as a slash command', () => {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
    for (const c of ['decide', 'spec', 'mockup', 'make', 'critique']) {
      expect(readme, `/jig ${c} missing from the README slash-command table`).toMatch(new RegExp(`\\| \`/jig ${c}\\b`));
    }
  });
  it('the skill routes a new feature through spec, mockup, make and critique', () => {
    const skill = readFileSync(join(repoRoot, 'templates/SKILL.md.tmpl'), 'utf8');
    expect(skill).toMatch(/Building a new feature\?/);
    expect(skill).toMatch(/mockup/);
  });
});

// The installed slash command tells the agent to refuse anything outside its
// "Available subcommands" list — and that list was built from `available` only,
// so every agent procedure shipped with an instruction to decline it. No test
// looked at the list, which is how it survived four commands.
describe('the installed slash command offers the agent procedures', () => {
  it('lists every agent procedure as available, so none is refused', async () => {
    const { buildCommandBody } = await import('../src/commands/install.js');
    const { body, subcommands } = buildCommandBody(repoRoot, '.claude/skills/jig/rules', '0.0.0', '$ARGUMENTS');
    const listed = /Available subcommands: ([^.]+)\./.exec(body)![1].split(', ');
    for (const c of ['decide', 'spec', 'mockup', 'make', 'critique']) {
      expect(subcommands, `${c} not offered`).toContain(c);
      expect(listed, `${c} missing from "Available subcommands"`).toContain(c);
    }
  });
});
