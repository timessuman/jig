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

    // Codex's command templates live in `.codex/prompts/<name>.md` and
    // substitute `$ARGUMENTS`, so `/jig init` reaches the same dispatching body
    // every other harness gets. Evidence, since this was got wrong once by
    // assuming and once by testing the wrong thing:
    //
    // - The Codex binary carries the strings "No command template body was
    //   found." and "$ARGUMENTS" together, alongside "migrated-command-skills".
    // - A first probe put a file in `~/.codex/prompts/` and drove it with
    //   `codex exec`, which did not expand it — `codex exec` is the
    //   non-interactive path, and slash commands are a TUI affordance. That
    //   result says nothing about whether the file is read in the TUI, which is
    //   how people actually use Codex, so it is not a reason to ship nothing.
    //
    // Unlike the skill-directory harnesses, the prompts directory is `.codex/`
    // at both scopes — under the project root for a project install, under
    // $HOME for a global one — matching where its reference bundle already goes.
    if (ctx.commandBody) {
      // Written to BOTH candidate directories, deliberately.
      //
      // The mechanism is confirmed — the binary carries "No command template
      // body was found." beside `$ARGUMENTS`, and handles custom prompts in
      // `tui/src/bottom_pane/custom_prompt_view.rs` and `prompt_args.rs`. What
      // could not be pinned down is the directory: impeccable's cross-harness
      // documentation names `.codex/prompts/`, while the binary also carries a
      // bare `commands` directory string, and the account available for testing
      // was over its usage limit so no live expansion could be observed.
      //
      // These are ~1KB markdown files. Writing both costs nothing and removes
      // the risk of shipping the feature into a directory nothing reads;
      // whichever Codex globs, `/jig init` works. Collapse to one once someone
      // has confirmed it in the TUI (M15).
      for (const dir of ['prompts', 'commands']) {
        files.push({
          relPath: `.codex/${dir}/jig.md`,
          content: `${ctx.commandBody}\n`,
        });
      }
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
