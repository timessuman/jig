import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate, MAX_BLOCKS } from '../src/commands/gate.js';
import { installStopHook } from '../src/commands/install.js';

/**
 * Arm test 3: every "run check" / "run verdicts" step was skippable, and Haiku
 * skipped them. The gate runs when the agent tries to stop, outside its choices.
 */
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jig-gate-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const jigProject = () => writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ surfaces: [{ match: '/', mode: 'editorial' }] }));
const run = (session = 's1') => gate({ projectRoot: root, version: '0.10.0', input: { session_id: session } });

describe('jig gate', () => {
  it('lets the agent stop in a project that does not use Jig', () => {
    writeFileSync(join(root, 'a.css'), 'body { font-family: var(--font-body); }');
    expect(run().block).toBe(false);
  });

  it('blocks when a changed file has a mechanical error, and names it', () => {
    jigProject();
    writeFileSync(join(root, 'a.css'), 'body {\n  font-family: var(--font-body);\n}');
    const r = run();
    expect(r.block).toBe(true);
    expect(r.reason).toMatch(/H-117 a\.css:2 --font-body/);
  });

  it('allows a clean change, and forgets earlier blocks once it passes', () => {
    jigProject();
    writeFileSync(join(root, 'a.css'), 'body { font-family: var(--font-body); }');
    expect(run().block).toBe(true);
    writeFileSync(join(root, 'a.css'), ':root { --font-body: serif; }\nbody { font-family: var(--font-body); }');
    expect(run().block).toBe(false);
    expect(JSON.parse(readFileSync(join(root, '.jig', 'gate.json'), 'utf8'))).toEqual({});
  });

  it('blocks on a critique whose verdict files do not pass', () => {
    jigProject();
    mkdirSync(join(root, '.jig', 'critique', 'pricing'), { recursive: true });
    writeFileSync(join(root, '.jig', 'critique', 'pricing', 'screen.json'), JSON.stringify({ rendered: false, verdicts: [] }));
    const r = run();
    expect(r.block).toBe(true);
    expect(r.reason).toMatch(/jig verdicts pricing/);
    expect(r.reason).toMatch(/do not edit the verdict files/);
  });

  // A gate the agent cannot satisfy must not trap it.
  it(`stops blocking after ${MAX_BLOCKS} attempts in one session, and says the work is unfinished`, () => {
    jigProject();
    writeFileSync(join(root, 'a.css'), 'body { font-family: var(--font-body); }');
    for (let i = 0; i < MAX_BLOCKS; i++) expect(run().block).toBe(true);
    const last = run();
    expect(last.block).toBe(false);
    expect(last.reason).toMatch(/not finished/);
    expect(run('another-session').block).toBe(true);
  });
});

describe('installStopHook', () => {
  const settings = () => JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));

  it('adds a Stop hook that runs the pinned gate', () => {
    expect(installStopHook(root, '0.10.0')).toBe(true);
    expect(settings().hooks.Stop[0].hooks[0].command).toBe('npx --yes jig-ui@0.10.0 gate');
  });

  it("keeps the user's settings and other hooks, and replaces its own entry on re-install", () => {
    mkdirSync(join(root, '.claude'));
    writeFileSync(join(root, '.claude', 'settings.json'), JSON.stringify({
      permissions: { allow: ['Bash(ls)'] },
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }], PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'x' }] }] },
    }));
    installStopHook(root, '0.9.0');
    installStopHook(root, '0.10.0');
    const s = settings();
    expect(s.permissions.allow).toEqual(['Bash(ls)']);
    expect(s.hooks.PreToolUse).toHaveLength(1);
    const commands = s.hooks.Stop.flatMap((g: { hooks: { command: string }[] }) => g.hooks.map((h) => h.command));
    expect(commands).toEqual(['echo mine', 'npx --yes jig-ui@0.10.0 gate']);
  });

  it('leaves a settings file that is not valid JSON alone', () => {
    mkdirSync(join(root, '.claude'));
    writeFileSync(join(root, '.claude', 'settings.json'), '{ broken');
    expect(installStopHook(root, '0.10.0')).toBe(false);
    expect(readFileSync(join(root, '.claude', 'settings.json'), 'utf8')).toBe('{ broken');
    expect(existsSync(join(root, '.jig'))).toBe(false);
  });
});
