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
