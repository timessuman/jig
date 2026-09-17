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

  it('states each role simply: decide once, then low fidelity, high fidelity, and scrutiny', () => {
    const head = tmpl().split('\n## ')[0];
    expect(head).toMatch(/`decide` runs once per project/);
    expect(head).toMatch(/for each page, feature or\s+functionality/);
    expect(head).toMatch(/mockup\s+low-fidelity design/);
    expect(head).toMatch(/make\s+high-fidelity: the actual page or feature, built from the spec & mockup/);
    expect(head).toMatch(/critique\s+scrutinises what was built against the rules, its spec & mockup/);
  });
});

describe('spec starts from what is being built and scopes it down', () => {
  const spec = () => section('spec', 'mockup');
  it('accepts a page, feature or functionality, and starts from what it is for', () => {
    expect(spec()).toMatch(/a page, a feature, or a piece of\s+functionality/);
    expect(spec()).toMatch(/Start with what it is for, not how it is laid out/);
  });

  it('refuses to start without DECISIONS.md', () => {
    expect(spec()).toMatch(/No `DECISIONS\.md` with substance → run `\/jig decide` first|No `DECISIONS\.md` with substance → run `\{\{command_prefix\}\}decide` first/);
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
    expect(mockup()).toMatch(/draws \*\*what one spec defines\*\*/);
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

  // All three Stitch runs timed out, retried, and switched tools while their
  // screens were already saved in the project.
  it('treats a Stitch timeout as still running: no retry, poll the screens, then ask', () => {
    const m = mockup();
    expect(m).toMatch(/A timeout is not a failure/);
    expect(m).toMatch(/Do not call it again\.\*\* A second request is a second screen/);
    expect(m).toMatch(/every 30 seconds or so, for up to 10 minutes/);
    expect(m).toMatch(/Only when 10 minutes pass with nothing, tell the user/);
  });

  it('generates a Stitch screen for every size, not only the phone', () => {
    expect(mockup()).toMatch(/`MOBILE` for 360, `TABLET`\s+for 768, `DESKTOP` for 1280/);
    expect(mockup()).toMatch(/confirm there is a screen for \*\*each\*\* size/);
  });

  // A Figma phone frame with no menu button was approved, and the build copied it.
  it('draws navigation at every size, including the phone menu open', () => {
    const m = mockup();
    expect(m).toMatch(/Navigation at every size, exactly as the spec's `nav:` says/);
    expect(m).toMatch(/`phone — menu open`/);
    expect(m).toMatch(/it is a missing region/);
  });

  it('checks every region and nav in each frame against the spec before review', () => {
    expect(mockup()).toMatch(/Check the drawing against the spec before anyone sees it/);
    expect(mockup()).toMatch(/go\s+down the spec's `regions:` and its `nav:`/);
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
  // Owner ruling: make builds from the spec AND the approved mockup. It uses the
  // mockup's structure; it still never pastes the mockup's HTML or the code a
  // Figma or Stitch frame generates, which carry no tokens.
  it('make builds from the spec and the mockup, never by copying the mockup, and V1 only', () => {
    const make = section('make', 'critique');
    expect(make).toMatch(/from its confirmed spec and its\s+approved mockup/);
    expect(make).toMatch(/Build from the spec and the mockup, never by copying the mockup/);
    expect(make).toMatch(/Read it; do not copy it/);
    expect(make).toMatch(/Stop and ask the user which is right/);
    expect(make).toMatch(/Build V1 only/);
  });
  // Owner ruling: critique scrutinises against the rules, the spec AND the mockup,
  // and belongs to the family that needs DECISIONS.md.
  it('critique compares the page to its spec and its mockup, structure not appearance', () => {
    const c = tmpl().split('\n## critique\n')[1];
    expect(c).toMatch(/Compare the page to its spec and its mockup/);
    expect(c).toMatch(/Not the colour, type or\s+polish/);
    expect(c).toMatch(/mockup=<approved\|skipped\|missing>/);
  });

  it('critique refuses to start without DECISIONS.md', () => {
    const c = tmpl().split('\n## critique\n')[1];
    expect(c).toMatch(/No `DECISIONS\.md` with substance → run `\{\{command_prefix\}\}decide` first/);
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
    expect(skill).toMatch(/Building a page, feature or functionality\?/);
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

// decide said "every other command is blocked until this exists". That was
// broader than true — install, init, check and explain do not need it, and init
// has to run first — and an agent taking it literally would refuse to run check
// on a project with no decisions yet. critique is in the family that does need
// it, by owner ruling: it judges against the project's decisions too.
describe('decide names exactly what it blocks', () => {
  it('blocks designing and building only, and says what it does not block', () => {
    const decide = tmpl().split('\n## decide\n')[1];
    expect(decide).not.toMatch(/Every other command is blocked/);
    expect(decide).toMatch(/`spec`, `mockup`, `make` and `critique` are blocked until this exists/);
    expect(decide).toMatch(/`install`, `init`, `check` and `explain` run without it/);
    expect(decide).toMatch(/`init`\s+comes first/);
  });
});
