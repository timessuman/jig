# Releasing

## Naming

Release titles are `Jig <version>`. Nothing else — no tagline, no summary.
The title is an identifier; a list of releases should be scannable at a glance,
and the notes are where the reasoning goes.

Tags are `v<version>`.

## One version, not several

Jig ships as a single npm package. `rules/`, `tokens/`, `templates/` and the CLI
all travel together, `.jig/manifest.json` records one version, and `jig update`
compares against that one number. So the version means *the state of the system
you installed*, not the state of any one part.

Per-component versioning — separate tracks for the rules, the tokens and the CLI —
is deliberately not used, for two reasons:

1. **Nothing is separately installable.** A consumer runs one command and gets all
   of it. Three version numbers would describe a separation that does not exist.
2. **The rules and the CLI are coupled by `rules.index.json`.** Every rule must
   have an index entry (`loadRules` throws otherwise, and the test suite fails on
   drift), and the CLI reads that index. Independent versions would allow a rules
   version whose index the installed CLI cannot use.

### What would change this

Split the versions when a component becomes independently consumable — for
example if the rules were published as their own package for people who want the
system without the installer. At that point the index coupling has to be solved
first: the rules package would need to carry its own index and the CLI would need
to accept a range of index versions rather than assuming a matching one.

Until then, a rules-only fix still bumps the package version. That is correct,
not noise: the artifact a consumer installed did change.

## Choosing the number

While pre-1.0:

- **Patch** — corrections that do not change what any command writes.
- **Minor** — new behaviour, or a change to what a command produces. `0.2.0` was
  minor rather than patch because `install` began writing four token files it had
  not written before.

## Steps

1. Land everything on `main` through pull requests; `main` is protected.
2. Bump `version` in `packages/cli/package.json`, update `CHANGELOG.md`, open a
   release PR, merge it.
3. Tag and push: `git tag -a v<version> -m "v<version>" && git push origin v<version>`
4. `gh release create v<version> --target main --title "Jig <version>" --notes-file <notes>`
5. Publish: `cd packages/cli && npm publish --otp=<code>`
6. Verify against the registry, not the local build — install the published
   version into a scratch directory and check it actually works.

Step 6 is not optional. `0.1.0` passed every local check and shipped a tarball
whose `bin` pointed at a `dist/` that was never built, because every test ran
against a stale local build.
