# Contributing to Jig

Thanks for helping. Jig is a set of UI rules a coding agent reads, and a CLI,
`jig check`, that settles the rules a program can. Both get better the same way:
someone runs Jig on a real project and says where it was wrong.

## The most useful thing you can do

Run Jig on something you are building, then tell us what happened:

- `check` flagged something that was fine, or passed something that was broken;
- a rule was unclear, or your agent read it and still got it wrong;
- `init` or `install` failed, or did something you didn't expect, on your
  framework or your agent.

Open an issue with the template that fits. Say which framework, which agent,
and the Jig version (`npx jig-ui --version`). A few lines of the markup or CSS
that show it are worth more than a description.

## Setting up

You need Node 22 or later and git.

```
git clone https://github.com/timessuman/jig.git
cd jig
npm ci
npm test
```

`npm test` checks the token files, typechecks, and runs every test in
`packages/cli`. CI runs it on Linux, macOS and Windows with Node 22 and 24, and
a pull request needs all six to pass.

To try your change on a project of your own:

```
cd packages/cli && npm run build
node /path/to/jig/packages/cli/dist/index.js check --all
```

Run that second line from the root of the project you're testing.

## Where things are

| Path | What it holds |
| --- | --- |
| `rules/00-anti-patterns.md` … `05-copy.md` | The rules, in the words an agent reads |
| `rules.index.json` | One entry per rule: its bucket, severity and the detector that checks it |
| `examples/<ID>.html` | A small "don't" and "do" for every rule (see `examples/README.md`) |
| `tokens/` | The brand and mode token files `init` installs |
| `packages/cli/src/check/detectors/` | The checks, one file per kind of failure |
| `packages/cli/src/check/registry.ts` | Where a detector is registered |
| `packages/cli/test/` | Tests (vitest) |
| `CHANGELOG.md` | What changed, written for the people who use Jig |

`AGENTS.md` holds the standing rules for working on Jig itself. Read its
"Changing a rule" and "Testing that a rule works" sections before you change one.

## Fixing a check

Most fixes are a detector that misses a case or fires on one it shouldn't.

1. Write a failing test in `packages/cli/test/` with the smallest markup or CSS
   that shows it. Look at a neighbouring test file for the shape.
2. Fix the detector.
3. Run `npm test`.

A fix should hold on every framework Jig reads (`.html`, `.jsx`/`.tsx`,
`.vue`, `.svelte`, `.astro`, templates), not only the one you hit it on.

## Adding or changing a rule

A rule earns its place by changing what an agent builds. Before proposing one,
check that an agent without it actually makes the mistake (`AGENTS.md`,
"Testing that a rule works"). If it doesn't, there is nothing for the rule to fix.

Open an issue with the "Rule" template first. Wording and ids are easier to
settle there than in review. Once it's agreed:

- **Id.** The letter is the section the rule belongs to (`E` states and
  interaction, `F` forms, `G` motion, and so on). The number is one more than the
  highest number in use across all sections.
- **Text.** A `❌` line, a `✅` line, then the reason. Write it so an agent can
  act on it: name the thing to do, not a quality to aim for.
- **Index.** Add the rule to `rules.index.json`. `bucket` is `mechanical` when a
  program can settle it, `judgment` when only a person or the agent can, and
  `hybrid` when a program settles part. Give `since` as the next version; the
  maintainer will correct it at release.
- **Example.** Add `examples/<ID>.html`.
- **Counts.** Rule counts appear in the README and a few other places. `npm test`
  fails on any that are stale and says which.

## Pull requests

- One change per pull request, with a test when it touches code.
- Add a line to `CHANGELOG.md` under `## Unreleased` (add the heading if it
  isn't there), saying what changed for
  someone using Jig, not what changed in the code.
- Don't bump versions or publish. Releases are done by the maintainer.
- Every pull request needs CI to pass and a review from a maintainer before it
  can be merged.

## Security

Please don't report a security problem in a public issue. See
[SECURITY.md](SECURITY.md).

## License

Jig is licensed under Apache 2.0. By sending a pull request, you agree that your
contribution is licensed the same way.
