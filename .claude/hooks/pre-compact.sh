#!/usr/bin/env bash
# PreCompact — what the summary must keep. Claude Code appends this hook's
# output to its own compaction instructions; it adds to them, never replaces.
#
# Why: details a summary dropped have cost more than anything else after a
# compaction. A runner script's contents, a background run's state and exact
# paths had to be dug back out of a 42 MB transcript.

cat <<'TEXT'
Keep these verbatim in the summary, because they are expensive or impossible to re-derive:
- Every file path of a script, brief or output this session created or ran, and where its results go.
- Every background task: its ID, the command, its output file and its last known status.
- The owner's rulings and the user's decisions, in their own words.
- Commit hashes, branch names, pull request numbers, tags and versions, and which repository each belongs to.
- The exact command lines used for releases, dev builds and headless runs.
- Anything the user paused, refused or asked not to do, and whether that still holds.
Drop tool output that can be re-read from disk or from git.
TEXT
exit 0
