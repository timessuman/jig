import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { agentsPointer } from './types.js';

export const codex: Adapter = {
  name: 'codex',
  displayName: 'Codex',
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    // Codex has a skills system, and until now Jig did not use it: its binary
    // instructs the model that "after deciding to use a skill, the main agent
    // must read its SKILL.md completely", and warns at startup about a "skills
    // context budget". The skill therefore goes in a skill directory like every
    // other harness's, under the cross-agent `.agents/` convention — which is
    // where impeccable installs its own Codex support.
    //
    // What this buys is the thing the convention exists for. `AGENTS.md` is
    // read into the context of EVERY session, so inlining the whole rule
    // summary there taxed every Codex task — a database migration, a shell
    // script — with a design system it would never use. A skill loads on
    // demand instead.
    const skillPath = '.agents/skills/jig/SKILL.md';
    const files: RenderedFile[] = [{ relPath: skillPath, content: ctx.skillBody }];

    // `AGENTS.md` keeps a short pointer rather than the full body. Codex
    // definitely reads AGENTS.md; exactly which skill directories it globs is
    // less certain, so the pointer guarantees an agent can still find the rules
    // either way. It is a few lines, not the whole system.
    const agentsPath = ctx.scope === 'global' ? '.codex/AGENTS.md' : 'AGENTS.md';
    files.push({ relPath: agentsPath, content: agentsPointer(skillPath) });

    // Codex's custom prompts are GLOBAL ONLY. OpenAI's documentation is
    // explicit: they load from `~/.codex/prompts` (or `$CODEX_HOME/prompts`),
    // it "scans only the top-level Markdown files in that folder", and there is
    // no project-scoped `.codex/prompts`. The filename without `.md` becomes
    // the slash entry, so `jig.md` gives `/jig`.
    //
    // Two earlier guesses here were wrong and are worth recording, because both
    // looked reasonable:
    //
    // - `.codex/commands/` does not exist as a mechanism. The bare string
    //   `commands` in the binary belongs to the import-from-another-agent
    //   feature ("Migrate commands from .. to .."), not to prompt loading.
    // - Writing the file at project scope reads to Codex as nothing at all.
    //   A `~/.codex/prompts` directory on this machine looked like evidence for
    //   it until `stat` showed the birth time matched an earlier probe of my
    //   own — it was my artifact, not Codex's.
    //
    // For a project-scope install there is therefore no prompt file to write.
    // That is not a gap: OpenAI deprecates custom prompts in favour of skills
    // precisely because "skills can be shared through your repository" while
    // prompts stay local — and the skill above is exactly that.
    if (ctx.commandBody && ctx.scope === 'global') {
      files.push({ relPath: '.codex/prompts/jig.md', content: `${ctx.commandBody}\n` });
    }

    return files;
  },
  /**
   * codex has no skill directory: AGENTS.md is a plain file (project root, or
   * `.codex/` for a global install). Reference material lives under `.codex/`
   * at BOTH scopes.
   *
   * Project scope used to be a bare `.jig`, which put Jig's rules, index,
   * licence and manifest into the one directory 0.4.0 reserves for the
   * project's own material — the brand file, the mode copies, `state.json`.
   * That cost more than tidiness:
   *
   * - `detectLegacyRules` scans `.jig/` for install artifacts and offers to
   *   remove them. Under the old layout a *live* codex install looked exactly
   *   like the legacy one, so the migration path could offer to delete the
   *   install just made.
   * - One directory holding two manifests is what let a stale
   *   `.jig/manifest.json` hijack `update` and resurrect the vendored layout.
   *
   * Mirroring the global path keeps codex's own convention and leaves `.jig/`
   * unambiguously the project's.
   */
  /**
   * Beside the skill, like every other harness — the rules are what `SKILL.md`
   * tells the agent to read, so they belong next to it. This used to be
   * `.codex/.jig`, and before that a bare `.jig`, which put Jig's property in
   * the one directory the project owns.
   */
  referenceDir: () => '.agents/skills/jig',
  argsPlaceholder: '$ARGUMENTS',
};
