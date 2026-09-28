import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate } from '../src/commands/gate.js';
import { ownerQuotes, specChecksum } from '../src/check/spec-checked.js';

/**
 * jig-site: the Guide's second chapter was specced, confirmed and built, and
 * seven of the eight errors later found on the page were in the confirmed spec:
 * a decide procedure Jig does not have, the lock written at the wrong moment,
 * sentences about the switch's own clicks as reader copy. Nothing after spec
 * compares the spec to the owner's words or to the facts it states, so a spec
 * is checked by a reader who did not write it before the owner is asked.
 */
let root: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-checked-'));
  git('init', '-q');
  writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }] }));
  mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'gate.md'), 'line one\nthe gate records the lock when a session stops\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const spec = (extra = '', confirmed = 'false') => `---
feature: read the loop
surface: the-loop
mode: editorial
sizes:
  phone:
    regions: [chapter]
    nav: Menu button, top left
  tablet:
    same-as: phone
    why: one column below the rails
  desktop:
    regions: [chapters, chapter, on-this-page]
    nav: the site header's links in a row
  wide:
    same-as: desktop
    why: content is capped
confirmed: ${confirmed}
mockup: skipped — the owner: "it reuses the Guide's approved layout"
---
${extra}`;

const writeSpec = (body: string) => writeFileSync(join(root, '.jig', 'specs', 'the-loop.spec.md'), body);
const writeChecked = (body: string, record: Record<string, unknown> = {}) =>
  writeFileSync(join(root, '.jig', 'specs', 'the-loop.checked.json'), JSON.stringify({ spec: specChecksum(body), quotes: [], facts: [], ...record }));

const owner = "/jig spec the-loop — it reuses the Guide's approved layout. Only where the steps differ by path.";
const run = (agentSays?: string, said = owner) => {
  const path = join(root, 't.jsonl');
  const lines = [
    { type: 'user', timestamp: new Date(Date.now() + 2000).toISOString(), message: { content: `<command-name>/jig</command-name>\n<command-args>spec the-loop</command-args>\n${said}` } },
    ...(agentSays ? [{ type: 'assistant', message: { content: [{ type: 'text', text: agentSays } ] } }] : []),
  ];
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return gate({ projectRoot: root, version: '0.21.1', input: { session_id: 's', transcript_path: path } });
};

describe('a spec is checked before the owner is asked', () => {
  it('holds the question back until another reader has checked the spec', () => {
    writeSpec(spec());
    const r = run('Here is the spec and its sheet. Do you confirm it?');
    expect(r.block).toBe(true);
    expect(r.reason).toMatch(/the-loop\.checked\.json is missing/);
  });

  it('asks once the check is of the spec being shown', () => {
    const body = spec();
    writeSpec(body);
    writeChecked(body);
    expect(run('Do you confirm it?').block).toBe(false);
  });

  it('keeps the check when the owner\'s yes sets confirmed', () => {
    writeChecked(spec());
    writeSpec(spec('', 'true'));
    expect(run().block).toBe(false);
  });

  it('refuses a check of an earlier spec', () => {
    writeChecked(spec());
    writeSpec(spec('A line added after the check.'));
    expect(run('Do you confirm it?').reason).toMatch(/is of an earlier spec/);
  });

  it('does not ask again about a spec this session left alone', () => {
    writeSpec(spec());
    git('add', '.');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'spec');
    expect(run('Anything else?').block).toBe(false);
  });
});

describe('a quotation given as the owner\'s', () => {
  it('is held to the owner\'s words', () => {
    const body = spec('Per the owner: "Every chapter opens on the path they last chose."');
    writeSpec(body);
    writeChecked(body);
    const r = run('Do you confirm it?');
    expect(r.reason).toMatch(/as the owner's that the owner's words do not hold: "Every chapter opens on the path they last chose\."/);
  });

  it('passes when the owner said it, however the YAML escapes it', () => {
    const body = spec('  - before: "one switch (owner: \\"Only where the steps differ by path\\")"');
    writeSpec(body);
    writeChecked(body);
    expect(run('Do you confirm it?').block).toBe(false);
  });

  it('is not every quotation near the word user', () => {
    expect(ownerQuotes('The user clicks "Save" and sees "Saved".')).toEqual([]);
    expect(ownerQuotes('The user said: "no trials"')).toEqual(['no trials']);
    expect(ownerQuotes('the owner\'s ruling, "three columns from 1280 up"')).toEqual(['three columns from 1280 up']);
    expect(ownerQuotes('the owner\'s reason: "not given"')).toEqual([]);
  });
});

describe('the facts a spec states', () => {
  const body = spec('The gate records the lock when a session stops.');

  it('stops a fact its reader found false from reaching the owner', () => {
    writeSpec(body);
    writeChecked(body, { facts: [{ claim: 'the lock is written only after fixes', source: 'docs/gate.md:2', holds: false, note: 'written when a session stops' }] });
    expect(run('Do you confirm it?').reason).toMatch(/states a fact its reader found false at the source: "the lock is written only after fixes" \(docs\/gate\.md:2\)/);
  });

  it('holds a source to existing in the project', () => {
    writeSpec(body);
    writeChecked(body, { facts: [
      { claim: 'a', source: 'docs/missing.md', holds: true },
      { claim: 'b', source: 'docs/gate.md:40', holds: true },
      { claim: 'c', source: 'https://example.com/docs', holds: true },
    ] });
    const reason = run('Do you confirm it?').reason;
    expect(reason).toMatch(/cites sources the project does not have: docs\/missing\.md, docs\/gate\.md:40\./);
    expect(reason).not.toMatch(/example\.com/);
  });

  it('asks why a fact was left unchecked', () => {
    writeSpec(body);
    writeChecked(body, { facts: [{ claim: 'Stitch needs a key', source: 'https://stitch.withgoogle.com', holds: 'unchecked' }] });
    expect(run('Do you confirm it?').reason).toMatch(/1 unchecked fact says nothing of why/);
    writeChecked(body, { facts: [{ claim: 'Stitch needs a key', source: 'https://stitch.withgoogle.com', holds: 'unchecked', note: 'no network here' }] });
    expect(run('Do you confirm it?').block).toBe(false);
  });

  it('passes a fact that holds at a line that exists', () => {
    writeSpec(body);
    writeChecked(body, { facts: [{ claim: 'the lock is recorded when a session stops', source: 'docs/gate.md:2', holds: true }] });
    expect(run('Do you confirm it?').block).toBe(false);
  });
});
