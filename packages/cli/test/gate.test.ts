import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gate, MAX_BLOCKS } from '../src/commands/gate.js';
import { install, installStopHook } from '../src/commands/install.js';
import { repoRoot } from './helpers/registered-commands.js';

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

/**
 * Arm test 4: four runs, and not one wrote a spec in the procedure's shape or
 * a single critique verdict file. Every skip was invisible, because the gate
 * could only check output that existed. The transcript says which command ran.
 */
describe('the gate checks the command that just ran', () => {
  const transcript = (command: string) => {
    const path = join(root, 'transcript.jsonl');
    writeFileSync(path, JSON.stringify({ type: 'user', message: { content: `<command-name>/jig</command-name>\n<command-args>${command}</command-args>` } }) + '\n');
    return path;
  };
  const runAfter = (command: string) => gate({ projectRoot: root, version: '0.10.0', input: { session_id: 's1', transcript_path: transcript(command) } });
  const spec = (body: string) => {
    mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), body);
  };
  const goodSpec = `---
feature: choose a plan
surface: pricing
mode: editorial
sizes:
  phone:
    regions: [nav, plans]
    nav: Menu button, top right
  tablet:
    regions: [nav, plans]
    nav: five links in a row
  desktop:
    regions: [nav, plans]
    nav: five links in a row
confirmed: true
mockup: approved
mockup_at: .jig/mockups/pricing.html
---
Prose.`;

  it('blocks a decide that left no Unresolved section', () => {
    jigProject();
    mkdirSync(join(root, 'jig'), { recursive: true });
    writeFileSync(join(root, 'jig', 'DECISIONS.md'), '### The Stamp Rule\n\n**Why:** because.\n');
    expect(runAfter('decide').reason).toMatch(/no `## Unresolved` section/);
    writeFileSync(join(root, 'jig', 'DECISIONS.md'), '### The Stamp Rule\n\n**Why:** because.\n\n## Unresolved\n\nNone named by the owner.\n');
    expect(runAfter('decide').block).toBe(false);
  });

  it('blocks a spec that is prose instead of the procedure\'s shape', () => {
    jigProject();
    spec('# Pricing Page Specification\n\nA prose document, as all four arm-test runs wrote.');
    expect(runAfter('spec').reason).toMatch(/has no frontmatter/);
  });

  it('names a size whose composition is missing, and passes a whole spec', () => {
    jigProject();
    spec(goodSpec.replace(/  desktop:[\s\S]*?nav: five links in a row\n/, ''));
    expect(runAfter('spec').reason).toMatch(/no `desktop:` composition/);
    spec(goodSpec);
    expect(runAfter('spec').block).toBe(false);
  });

  it('blocks a menu button at a width where the links fit', () => {
    jigProject();
    spec(goodSpec.replace('  desktop:\n    regions: [nav, plans]\n    nav: five links in a row', '  desktop:\n    regions: [nav, plans]\n    nav: Menu button, top right'));
    expect(runAfter('spec').reason).toMatch(/`desktop` has `nav: Menu button, top right`/);
  });

  it('blocks a mockup drawn outside .jig/mockups, and one still pending', () => {
    jigProject();
    spec(goodSpec.replace('.jig/mockups/pricing.html', 'mockup.html'));
    writeFileSync(join(root, 'mockup.html'), '<html></html>');
    expect(runAfter('mockup').reason).toMatch(/A mockup lives in \.jig\/mockups\//);
    spec(goodSpec.replace('mockup: approved', 'mockup: pending'));
    expect(runAfter('mockup').reason).toMatch(/still pending/);
  });

  it('blocks a critique that wrote no verdict files at all', () => {
    jigProject();
    spec(goodSpec);
    mkdirSync(join(root, '.jig', 'mockups'), { recursive: true });
    writeFileSync(join(root, '.jig', 'mockups', 'pricing.html'), '<html></html>');
    const r = runAfter('critique');
    expect(r.block).toBe(true);
    expect(r.reason).toMatch(/critique wrote no verdict files/);
  });

  // Arm test 6: every spec passed the shape check with `phone: 360px, stacked
  // cards, menu button top-right` — frontmatter in shape, prose in substance.
  it('refuses a size written as one line, and one claiming same-as with no why', () => {
    jigProject();
    spec(goodSpec.replace('  tablet:\n    regions: [nav, plans]\n    nav: five links in a row', '  tablet: 768px, wider cards, visible navigation'));
    expect(runAfter('spec').reason).toMatch(/`tablet:` is a one-line description/);
    spec(goodSpec.replace('  tablet:\n    regions: [nav, plans]\n    nav: five links in a row', '  tablet:\n    same-as: phone'));
    expect(runAfter('spec').reason).toMatch(/claims `same-as:` with no `why:`/);
  });

  it('refuses a size with no regions or nav', () => {
    jigProject();
    spec(goodSpec.replace('  desktop:\n    regions: [nav, plans]\n    nav: five links in a row', '  desktop:\n    hierarchy: [plans]'));
    const reason = runAfter('spec').reason;
    expect(reason).toMatch(/`desktop` has no `regions:`/);
    expect(reason).toMatch(/`desktop` has no `nav:`/);
  });

  it('blocks a critique whose screen pass judged the rules without a render', () => {
    jigProject();
    spec(goodSpec);
    mkdirSync(join(root, '.jig', 'mockups'), { recursive: true });
    writeFileSync(join(root, '.jig', 'mockups', 'pricing.html'), '<html></html>');
    const dir = join(root, '.jig', 'critique', 'pricing');
    mkdirSync(dir, { recursive: true });
    const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8')) as Array<{ id: string; bucket: string; pass?: string }>;
    const ids = (pass: string) => index.filter((r) => r.bucket === 'judgment' && r.pass === pass).map((r) => ({ id: r.id, verdict: 'ok', reason: `${r.id} holds` }));
    writeFileSync(join(dir, 'screen.json'), JSON.stringify({ rendered: false, verdicts: [...ids('screen'), { id: 'P-14', verdict: 'ok', reason: 'nav reads as the spec says' }] }));
    writeFileSync(join(dir, 'code.json'), JSON.stringify({ verdicts: ids('code') }));
    expect(runAfter('critique').reason).toMatch(/judged \d+ rules with rendered: false/);
  });

  it('says nothing about commands when the transcript names none', () => {
    jigProject();
    spec('# prose');
    expect(gate({ projectRoot: root, version: '0.10.0', input: { session_id: 's1' } }).block).toBe(false);
  });
});

describe('the Stop hook is written only when someone asked for it', () => {
  const pkg = () => join(root, 'pkg');
  const opts = (extra: Record<string, unknown> = {}) => ({
    agent: 'claude', scope: 'project' as const, projectRoot: root, packageRoot: pkg(),
    version: '0.10.0', homeDir: join(root, 'home'), ...extra,
  });
  beforeEach(() => {
    mkdirSync(join(pkg(), 'rules'), { recursive: true });
    mkdirSync(join(pkg(), 'templates'), { recursive: true });
    mkdirSync(join(pkg(), 'tokens'), { recursive: true });
    for (const t of ['brand.default.css', 'mode.editorial.css', 'mode.product.css', 'mode.operator.css']) writeFileSync(join(pkg(), 'tokens', t), ':root { --a: 1; }\n');
    writeFileSync(join(pkg(), 'rules', '00-anti-patterns.md'), '### A-01 Rule\n');
    writeFileSync(join(pkg(), 'rules.index.json'), JSON.stringify([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0', pass: 'code' }]));
    writeFileSync(join(pkg(), 'templates', 'SKILL.md.tmpl'), '{{command_prefix}} {{config_file}} {{rules_path}} {{available_commands}} {{ask_instruction}} {{scripts_path}}');
    writeFileSync(join(pkg(), 'templates', 'command-metadata.json'), JSON.stringify({ check: { description: 'Check.', argumentHint: '' } }));
    writeFileSync(join(pkg(), 'LICENSE'), 'Apache');
    writeFileSync(join(pkg(), 'NOTICE'), 'Jig');
  });

  it('writes no hook unless asked, and writes one when asked', () => {
    expect(install(opts()).stopHook).toBeUndefined();
    expect(existsSync(join(root, '.claude', 'settings.json'))).toBe(false);
    expect(install(opts({ hook: true })).stopHook).toBe(true);
    expect(readFileSync(join(root, '.claude', 'settings.json'), 'utf8')).toMatch(/jig-ui@0\.10\.0 gate/);
  });

  it('adds no hook for another agent or at global scope even when asked', () => {
    expect(install(opts({ hook: true, agent: 'codex' })).stopHook).toBeUndefined();
    expect(install(opts({ hook: true, scope: 'global' as const })).stopHook).toBeUndefined();
  });
});
