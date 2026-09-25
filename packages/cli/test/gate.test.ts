import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, utimesSync } from 'node:fs';
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

// One em dash in a page survived two runs: an agent saw the warning, called it
// pre-existing, and finished, because only errors blocked. A warning in a file
// the agent changed now holds it until the warning is fixed or waived.
describe('jig gate — warnings', () => {
  const html = (body: string) =>
    `<!doctype html><html><head><title>t</title><meta name="description" content="d"></head><body><main>\n${body}\n</main></body></html>`;

  it('blocks on a warning in a changed file, and names it', () => {
    jigProject();
    writeFileSync(join(root, 'a.html'), html('<p>Free — forever</p>'));
    const r = run();
    expect(r.block).toBe(true);
    expect(r.reason).toMatch(/1 warning\(s\) in the files you changed/);
    expect(r.reason).toMatch(/warning I-118 a\.html:2/);
    expect(r.reason).toMatch(/jig-allow <ID>: <why>/);
  });

  it('lets the agent stop once the warning is waived on its line with a reason', () => {
    jigProject();
    writeFileSync(join(root, 'a.html'), html('<!-- jig-allow I-118: the product name is spelled with the dash -->\n<p>Free — forever</p>'));
    expect(run().block).toBe(false);
  });

  it('does not take a waiver with no reason', () => {
    jigProject();
    writeFileSync(join(root, 'a.html'), html('<!-- jig-allow I-118: -->\n<p>Free — forever</p>'));
    expect(run().block).toBe(true);
  });

  it('does not let a waiver silence an error', () => {
    jigProject();
    writeFileSync(join(root, 'a.css'), 'body {\n  /* jig-allow H-117: it is declared somewhere */\n  font-family: var(--font-body);\n}');
    const r = run();
    expect(r.block).toBe(true);
    expect(r.reason).toMatch(/H-117 a\.css:3/);
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
  wide:
    same-as: desktop
    why: content is capped, so 1600 adds margin and nothing else
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

  // A live run: decide asked its first question, the gate said DECISIONS.md
  // did not exist, and on the second refusal the agent wrote the file from its
  // own reasoning with no answer from anyone.
  describe('a command waiting on the owner', () => {
    const said = (command: string, text: string) => {
      const path = transcript(command);
      writeFileSync(path, readFileSync(path, 'utf8') + JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }) + '\n');
      return gate({ projectRoot: root, version: '0.10.0', input: { session_id: 's1', transcript_path: path } });
    };

    it('lets decide stop to ask a question before DECISIONS.md exists', () => {
      jigProject();
      expect(said('decide', 'Round 1b. What is the one sentence this project is trying to be?').block).toBe(false);
      expect(said('decide', 'Question 2 of 5: **which of these is closer?**').block).toBe(false);
    });

    // The shape decide actually uses: the round's questions, then an example
    // answer, then a line telling the owner to answer for their own project.
    // The message ends on a full stop, and reading only its last line refused
    // this pause in a live run.
    it('lets decide stop when its questions come before an example', () => {
      jigProject();
      const round = '**Round 1.**\n\n1. What is this project, in a sentence, and who is it for?\n2. What should it never look like? (name real products, not adjectives)\n\n> *For example: "hosted log search, for a backend engineer."*\n\nThat is an example shape, not a suggestion. Answer for this project.';
      expect(said('decide', round).block).toBe(false);
    });

    it('does not read a question mark in a URL or code as a question', () => {
      jigProject();
      expect(said('decide', 'Wrote the link as `/pricing?plan=team` and linked https://x.test/a?b=c. Done.').block).toBe(true);
    });

    it('still blocks a decide that says it is finished with nothing written', () => {
      jigProject();
      expect(said('decide', 'Done. The decisions are recorded.').reason).toMatch(/decide wrote no DECISIONS\.md/);
    });

    it('still runs check while the question is open', () => {
      jigProject();
      writeFileSync(join(root, 'a.css'), 'body {\n  font-family: var(--font-body);\n}');
      const r = said('decide', 'Which typeface does the audience already read all day?');
      expect(r.block).toBe(true);
      expect(r.reason).toMatch(/H-117/);
      expect(r.reason).not.toMatch(/DECISIONS/);
    });
  });

  it('finds DECISIONS.md beside the token layer that jig.config.json names', () => {
    writeFileSync(join(root, 'jig.config.json'), JSON.stringify({ brand: 'src/styles/jig/brand.site.css', surfaces: [{ match: '/', mode: 'editorial' }] }));
    mkdirSync(join(root, 'src', 'styles', 'jig'), { recursive: true });
    writeFileSync(join(root, 'src', 'styles', 'jig', 'DECISIONS.md'), '### Voice\n\n**Why:** because.\n\n## Unresolved\n\nNone named by the owner.\n');
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
    spec(goodSpec.replace(/  wide:[\s\S]*?and nothing else\n/, ''));
    expect(runAfter('spec').reason).toMatch(/no `wide:` composition/);
    spec(goodSpec);
    expect(runAfter('spec').block).toBe(false);
  });

  // A live spec wrote `nav: horizontal bar (no menu), logo left` and was told
  // it had put a menu where the links fit.
  it('does not read "no menu" as a menu', () => {
    jigProject();
    spec(goodSpec.replace('  desktop:\n    regions: [nav, plans]\n    nav: five links in a row', '  desktop:\n    regions: [nav, plans]\n    nav: horizontal bar (no menu), logo left, five destinations right'));
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

  // jig-site: three mockups in a row were one responsive page each, and the
  // owner saw only their own window's width.
  describe('the mockup drawing', () => {
    const frame = (size: string, labels: string[], width?: number) =>
      `<p class="size">${size}</p><section class="frame" data-size="${size}"${width ? ` data-width="${width}" style="width:${width}px"` : ''}>` +
      labels.map((l) => `<div class="region"><span class="name">${l}</span></div>`).join('') + '</section>';
    const draw = (html: string) => {
      mkdirSync(join(root, '.jig', 'mockups'), { recursive: true });
      writeFileSync(join(root, '.jig', 'mockups', 'pricing.html'), html);
    };
    const all = (labels: string[]) => ['phone', 'tablet', 'desktop', 'wide'].map((s) => frame(s, labels)).join('');

    it('needs a frame for each size', () => {
      jigProject();
      spec(goodSpec);
      draw('<html><body><main>one responsive page</main></body></html>');
      expect(runAfter('mockup').reason).toMatch(/has no frame for phone \(360px\), tablet \(768px\), desktop \(1280px\), wide \(1600px\)/);
      draw(['phone', 'tablet', 'desktop'].map((s) => frame(s, ['nav', 'plans'])).join(''));
      expect(runAfter('mockup').reason).toMatch(/has no frame for wide \(1600px\)\./);
    });

    it('needs each size\'s regions in its frame, by name where the spec names them', () => {
      jigProject();
      spec(goodSpec);
      draw(all(['nav']));
      expect(runAfter('mockup').reason).toMatch(/the phone frame has no labelled region for "plans"/);
      draw(['phone', 'tablet', 'desktop', 'wide'].map((s) => `<section class="frame" data-size="${s}"></section>`).join(''));
      expect(runAfter('mockup').reason).toMatch(/the phone frame has no labelled region for "nav", "plans"/);
      draw(all(['nav · 326 × 48', 'plans']));
      expect(runAfter('mockup').reason ?? '').not.toMatch(/frame|region/);
    });

    it('counts regions a spec describes rather than names, and follows same-as', () => {
      jigProject();
      const described = goodSpec
        .replace('  phone:\n    regions: [nav, plans]', '  phone:\n    regions:\n      - "one sentence under the heading, saying which plan suits whom"\n      - "the three plans side by side where they fit, stacked where they do not"')
        .replace(/  tablet:\n    regions: \[nav, plans\]\n    nav: five links in a row/, '  tablet:\n    same-as: phone\n    why: one column still');
      spec(described);
      draw(frame('phone', ['intro']) + frame('tablet', ['intro', 'plans']) + frame('desktop', ['nav', 'plans']) + frame('wide', ['nav', 'plans']));
      const reason = runAfter('mockup').reason;
      expect(reason).toMatch(/the phone frame labels 1 region\(s\) and the spec lists 2 for phone/);
      expect(reason).not.toMatch(/tablet frame/);
    });

    // jig-site's header switches at 540, between phone and tablet.
    it('draws either side of each switch the project records', () => {
      jigProject();
      spec(goodSpec);
      writeFileSync(join(root, 'site.css'), '@theme { --breakpoint-nav: 540px; }');
      draw(all(['nav', 'plans']));
      expect(runAfter('mockup').reason).toMatch(/does not draw either side of the `--breakpoint-nav` switch at 540px \(no frame at 539 or 540px\)/);
      draw(all(['nav', 'plans']) + frame('switch', [], 539) + frame('switch', [], 540));
      expect(runAfter('mockup').reason ?? '').not.toMatch(/switch/);
    });

    // jig-site's Versions spec wrote `switches: [breakpoint-nav]`; read as a
    // switch of that name, it matched nothing and no switch was checked.
    it('reads a switch however the spec spells it, and names one the project does not record', () => {
      jigProject();
      writeFileSync(join(root, 'site.css'), '@theme { --breakpoint-nav: 540px; }');
      for (const spelling of ['nav', 'breakpoint-nav', '--breakpoint-nav']) {
        spec(goodSpec.replace(/^sizes:/m, `switches: [${spelling}]\nsizes:`));
        draw(all(['nav', 'plans']));
        expect(runAfter('mockup').reason).toMatch(/either side of the `--breakpoint-nav` switch at 540px/);
      }
      spec(goodSpec.replace(/^sizes:/m, 'switches: [navigation]\nsizes:'));
      draw(all(['nav', 'plans']) + frame('switch', [], 539) + frame('switch', [], 540));
      expect(runAfter('mockup').reason).toMatch(/`switches:` names "navigation", which the project does not record\. Recorded: nav \(540px\)/);
    });

    it('refuses icons and images in a frame', () => {
      jigProject();
      spec(goodSpec);
      draw(all(['nav', 'plans']).replace('<span class="name">nav</span>', '<span class="name">nav</span><svg viewBox="0 0 24 24"></svg><i class="fa fa-github"></i>'));
      expect(runAfter('mockup').reason).toMatch(/draws icons or images in its frames \(phone frame: <svg>; phone frame: an icon font/);
      draw(all(['nav [menu] [theme] [GitHub]', 'plans']));
      expect(runAfter('mockup').reason ?? '').not.toMatch(/icons or images/);
    });

    it('leaves out a switch the spec says the page never crosses', () => {
      jigProject();
      writeFileSync(join(root, 'site.css'), '@theme { --breakpoint-nav: 540px; --breakpoint-rails: 1216px; }');
      spec(goodSpec.replace(/^sizes:/m, 'switches: [nav]\nsizes:'));
      draw(all(['nav', 'plans']) + frame('switch', [], 539) + frame('switch', [], 540));
      expect(runAfter('mockup').reason ?? '').not.toMatch(/switch/);
      spec(goodSpec.replace(/^sizes:/m, 'switches: none\nsizes:'));
      draw(all(['nav', 'plans']));
      expect(runAfter('mockup').reason ?? '').not.toMatch(/switch/);
    });
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
    const ids = (pass: string) => index.filter((r) => (r.bucket === 'judgment' || r.bucket === 'hybrid') && r.pass === pass).map((r) => ({ id: r.id, verdict: 'ok', reason: `${r.id} holds` }));
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

/**
 * Arm test 8: `claude -p --continue` keeps one session across every /jig step,
 * so a Haiku run that spent three blocks on its spec reached `critique` with
 * none left — and reported a review it had never written. The budget belongs
 * to the failure, not the session.
 */
describe('the block budget is per failure', () => {
  const transcript = (command: string) => {
    const path = join(root, `transcript-${command}.jsonl`);
    writeFileSync(path, JSON.stringify({ type: 'user', message: { content: `<command-name>/jig</command-name>\n<command-args>${command}</command-args>` } }) + '\n');
    return path;
  };
  const run = (command: string) => gate({ projectRoot: root, version: '0.10.0', input: { session_id: 'one-session', transcript_path: transcript(command) } });

  it('gives a new failure its own three attempts in the same session', () => {
    jigProject();
    mkdirSync(join(root, 'jig'), { recursive: true });
    writeFileSync(join(root, 'jig', 'DECISIONS.md'), '### A rule\n\nno unresolved section here\n');
    for (let i = 0; i < 3; i++) expect(run('decide').block).toBe(true);
    expect(run('decide').block, 'spent its three attempts').toBe(false);

    // A different step, failing differently: it starts from zero.
    mkdirSync(join(root, '.jig', 'specs'), { recursive: true });
    writeFileSync(join(root, '.jig', 'specs', 'pricing.spec.md'), '# prose, no frontmatter');
    expect(run('spec').block, 'the next failure inherited an exhausted budget').toBe(true);
  });

  it('returns the attempts once the failure is fixed', () => {
    jigProject();
    mkdirSync(join(root, 'jig'), { recursive: true });
    const decisions = join(root, 'jig', 'DECISIONS.md');
    writeFileSync(decisions, '### A rule\n\nno unresolved section\n');
    expect(run('decide').block).toBe(true);
    writeFileSync(decisions, '### A rule\n\n**Why:** given.\n\n## Unresolved\n\nNone named by the owner.\n');
    expect(run('decide').block).toBe(false);
    expect(JSON.parse(readFileSync(join(root, '.jig', 'gate.json'), 'utf8'))).toEqual({});
  });
});

// A live run: make fixed three critique findings, then rewrote those verdicts
// from `finding` to `ok` itself, and the gate accepted the review as clean.
describe('verdicts belong to critique', () => {
  const session = (command: string) => {
    const path = join(root, `t-${command}.jsonl`);
    writeFileSync(path, JSON.stringify({ type: 'user', message: { content: `<command-name>/jig</command-name>\n<command-args>${command}</command-args>` } }) + '\n');
    return gate({ projectRoot: root, version: '0.10.0', input: { session_id: command, transcript_path: path } });
  };
  const dir = () => join(root, '.jig', 'critique', 'pricing');
  const verdicts = (verdict: string) => {
    mkdirSync(dir(), { recursive: true });
    writeFileSync(join(dir(), 'decisions.json'), JSON.stringify({ verdicts: [{ decision: 'Corners', verdict, reason: 'r' }] }));
  };

  it('blocks a make session that changed what critique wrote, and lets go once it is restored', async () => {
    const { verdictGuard } = await import('../src/commands/gate.js');
    jigProject();
    verdicts('finding');
    session('critique');
    expect(existsSync(join(dir(), 'verdicts.lock'))).toBe(true);
    verdicts('ok');
    const problems = verdictGuard(root, 'make');
    expect(problems.join('\n')).toMatch(/verdict files changed after `\/jig critique` wrote them, in a session that ran `\/jig make`/);
    verdicts('finding');
    expect(verdictGuard(root, 'make')).toEqual([]);
  });

  it('lets critique change its own verdicts, and records the new ones', async () => {
    const { verdictGuard } = await import('../src/commands/gate.js');
    jigProject();
    verdicts('finding');
    session('critique');
    verdicts('ok');
    session('critique');
    expect(verdictGuard(root, 'make')).toEqual([]);
  });

  it('says nothing about a critique that was never locked', async () => {
    const { verdictGuard } = await import('../src/commands/gate.js');
    jigProject();
    verdicts('ok');
    expect(verdictGuard(root, 'make')).toEqual([]);
  });
});

// On one site a spec for one page could not finish because another page's
// critique predated a release that added rules, and a set-aside record still
// failed for screenshots it no longer had. A stop is judged on what it touched.
describe('the gate judges the critiques this session touched', () => {
  const badCritique = (surface: string) => {
    const dir = join(root, '.jig', 'critique', surface);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'screen.json'), JSON.stringify({ rendered: false, verdicts: [] }));
    return dir;
  };
  const session = (startedAt: Date, command = 'spec') => {
    const path = join(root, 'session.jsonl');
    writeFileSync(path, JSON.stringify({ type: 'user', timestamp: startedAt.toISOString(), message: { content: `<command-name>/jig</command-name>\n<command-args>${command}</command-args>` } }) + '\n');
    return path;
  };
  const stop = (transcript?: string) => gate({ projectRoot: root, version: '0.10.0', input: { session_id: 's-scope', transcript_path: transcript } });

  it('does not block on another page\'s critique written before this session', () => {
    jigProject();
    const dir = badCritique('catalog');
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(join(dir, 'screen.json'), old, old);
    expect(stop(session(new Date())).reason).not.toMatch(/jig verdicts catalog/);
  });

  it('blocks on a critique this session changed', () => {
    jigProject();
    badCritique('catalog');
    expect(stop(session(new Date(Date.now() - 60_000))).reason).toMatch(/jig verdicts catalog/);
  });

  it('never judges a critique set aside with a leading underscore', () => {
    jigProject();
    badCritique('_superseded-catalog');
    expect(stop(session(new Date(Date.now() - 60_000))).reason ?? '').not.toMatch(/_superseded/);
  });

  // Seen live: a critique session on one page stamped a lock into the other
  // page's critique folder, and the next stop read that stamp as a touch.
  it('does not lock, and then judge, another page\'s critique during a critique session', () => {
    jigProject();
    const catalog = badCritique('catalog');
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(join(catalog, 'screen.json'), old, old);
    const page = badCritique('rule-page');
    const t = session(new Date(Date.now() - 60_000), 'critique');
    stop(t);
    expect(existsSync(join(catalog, 'verdicts.lock'))).toBe(false);
    expect(existsSync(join(page, 'verdicts.lock'))).toBe(true);
    expect(stop(t).reason).not.toMatch(/jig verdicts catalog/);
  });

  // Seen live: a make round saved its probe into the catalog's critique folder,
  // and the gate then asked make, three times, for verdicts only critique writes.
  it('does not judge a critique whose folder a make round only measured into', () => {
    jigProject();
    const dir = badCritique('catalog');
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(join(dir, 'screen.json'), old, old);
    writeFileSync(join(dir, 'probe-1280.json'), '{}');
    expect(stop(session(new Date(Date.now() - 60_000), 'make')).reason).not.toMatch(/jig verdicts catalog/);
  });

  it('judges every critique when there is no transcript to date the session', () => {
    jigProject();
    const dir = badCritique('catalog');
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(join(dir, 'screen.json'), old, old);
    expect(stop(undefined).reason).toMatch(/jig verdicts catalog/);
  });
});
