import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate } from '../src/commands/gate.js';

/**
 * jig-site's header spec went through five confirmed rounds after its mockup
 * was approved and still said `mockup: approved` over a drawing of none of
 * them. A spec whose regions the approved drawing no longer shows has no
 * approved drawing.
 */
let root: string;

const spec = (phone: string) => `---
feature: read a rule
surface: rule-page
mode: editorial
sizes:
  phone:
    regions:
${phone}
    nav: Menu button, top left
  tablet:
    same-as: phone
    why: one column at every width below the rail
  desktop:
    same-as: phone
    why: as tablet
  wide:
    same-as: desktop
    why: content is capped
confirmed: true
mockup: approved
mockup_at: .jig/mockups/rule-page.html
---
Prose.`;

const frame = (size: string, labels: string[]) =>
  `<section class="frame" data-size="${size}">${labels.map((l) => `<div class="region"><span class="name">${l}</span></div>`).join('')}</section>`;
const drawing = (labels: string[]) => ['phone', 'tablet', 'desktop', 'wide'].map((s) => frame(s, labels)).join('\n');

const run = (command: string) => {
  const path = join(root, `t-${command}.jsonl`);
  writeFileSync(path, JSON.stringify({ type: 'user', message: { content: `<command-name>/jig</command-name>\n<command-args>${command} rule-page</command-args>` } }) + '\n');
  return gate({ projectRoot: root, version: '0.19.1', input: { session_id: command, transcript_path: path } });
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-drawn-'));
  writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }] }));
  mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
  mkdirSync(join(root, '.jig', 'mockups'), { recursive: true });
  writeFileSync(join(root, '.jig', 'mockups', 'rule-page.html'), drawing([
    'site header (unchanged)', 'identity', 'example (two specimens, each 320px)', 'why (prose)', 'metadata', 'plain-text twin',
  ]));
});

describe('an approved drawing that no longer shows the spec', () => {
  it('reads qualifiers, conditional regions and lists the way the spec means them', () => {
    writeFileSync(join(root, '.jig', 'specs', 'rule-page.spec.md'), spec([
      '      - "identity: the id, then the title"',
      '      - "example (rules only): two specimens"',
      '      - "specification note (specs only): a statement"',
      '      - "why, metadata, plain-text twin: stacked"',
    ].join('\n')));
    expect(run('spec').reason ?? '').not.toMatch(/no longer shows/);
  });

  it('asks spec to set the mockup back to pending when a region was added after approval', () => {
    writeFileSync(join(root, '.jig', 'specs', 'rule-page.spec.md'), spec([
      '      - "identity: the id, then the title"',
      '      - "theme toggle: one button"',
    ].join('\n')));
    const reason = run('spec').reason ?? '';
    expect(reason).toMatch(/says `mockup: approved`, but the approved drawing no longer shows what the spec lists/);
    expect(reason).toMatch(/no labelled region for "theme toggle"/);
    expect(reason).toMatch(/Set `mockup: pending` in the spec/);
    expect(run('make').reason ?? '').toMatch(/this one is of an earlier spec\. Stop, and ask for `\/jig mockup`/);
  });

  it('leaves a drawing made before frames alone', () => {
    writeFileSync(join(root, '.jig', 'mockups', 'rule-page.html'), '<main><h1>identity</h1></main>');
    writeFileSync(join(root, '.jig', 'specs', 'rule-page.spec.md'), spec('      - "theme toggle: one button"'));
    expect(run('make').reason ?? '').not.toMatch(/no longer shows/);
  });
});

// jig-site: the home drawing captioned its rule specimens `spec-frame`, and the
// gate read each one as a new size frame, orphaning the regions after it.
describe('a size frame is the class `frame`, not a class containing it', () => {
  it('does not split a frame at a `spec-frame` inside it', () => {
    writeFileSync(join(root, '.jig', 'mockups', 'rule-page.html'), ['phone', 'tablet', 'desktop', 'wide'].map((size) =>
      `<section class="frame" data-size="${size}"><div class="region"><span class="name">identity</span></div>` +
      `<figure class="spec-frame"><iframe></iframe></figure><div class="region"><span class="name">theme toggle</span></div></section>`).join('\n'));
    writeFileSync(join(root, '.jig', 'specs', 'rule-page.spec.md'), spec(['      - "identity: the id"', '      - "theme toggle: one button"'].join('\n')));
    expect(run('spec').reason ?? '').not.toMatch(/no longer shows/);
  });
});
