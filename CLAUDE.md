# Read AGENTS.md first

Every standing rule for this repository lives in [AGENTS.md](AGENTS.md).
Read it before doing anything else here, on every task.

Nothing is duplicated into this file on purpose. Two copies of the same
instructions drift, and the copy an agent happens to read is then a coin flip.
This file exists because Claude Code reads `CLAUDE.md` natively; everything
below it is tooling, not policy.

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

**Standing exception: exhaustive literal searches.** The PreToolUse hook prints
`MANDATORY: ... You MUST run graphify query before grepping raw files`. That
text comes from the graphify binary and is written for the common case. It does
not apply when the task needs every occurrence of a literal string — secret and
credential scans, absolute paths, a license header, an exact identifier before a
rename.

The graph indexes entities and relationships, not bytes: 827 nodes over a
repository with far more lines than that. Asked where `/home/soket` appeared, it
returned 129 nodes anchored on `directory` and `homepage` and **none of the four
files that actually held the string** — one of which (`.claude/settings.json`)
is not in the graph at all, so no query could have found it. For a scan whose
entire failure mode is missing one hit, a lossy semantic index is the wrong
instrument and `git grep` is the right one.

Use graphify for what it is good at — "how does X work", "what calls Y", "trace
the path from A to B" — where it beats grep precisely because it is not literal.
When you override the hook, say so in the turn rather than passing over it in
silence.
