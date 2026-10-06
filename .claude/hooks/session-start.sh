#!/usr/bin/env bash
# SessionStart — where the repository stands. Informational, never blocks.

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

branch=$(git branch --show-current 2>/dev/null || echo "?")
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
version=$(node -p 'require("./packages/cli/package.json").version' 2>/dev/null || echo "?")
echo "branch: $branch | uncommitted: $dirty file(s) | jig-ui in tree: $version"

if [ "$branch" = "main" ]; then
  echo "on main: branch before committing; changes land through a pull request."
fi

if [ -z "$(git config user.email 2>/dev/null)" ] || [ -z "$(git config user.name 2>/dev/null)" ]; then
  echo "WARNING: git identity is unset, so commits will fail. Set user.name and user.email."
fi
exit 0
