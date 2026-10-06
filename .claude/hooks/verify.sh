#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit) — run the check that covers the file just
# edited, and only that one. Exits 2 on failure so the error goes back to the
# agent while the change is fresh.
#
#   packages/cli/**/*.ts   typecheck the CLI (tsc --noEmit)
#   tokens/**              scripts/check-tokens.mjs
#
# The full suite (`npm test`) is too slow for every edit; run it before a commit.

set -uo pipefail
input=$(cat)
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const p=JSON.parse(s).tool_input?.file_path??"";process.stdout.write(require("path").relative(process.argv[1],p).split(require("path").sep).join("/"))}catch{}})' "$root")
[ -z "$file" ] && exit 0

fail=0
run() {
  if ! out=$("$@" 2>&1); then
    fail=1
    echo "[verify] FAILED: $*" >&2
    printf '%s\n' "$out" | tail -40 >&2
  fi
}

# In `case`, `*` also matches `/`, so these patterns cover nested paths.
case "$file" in
  packages/cli/*.ts) run npm run typecheck -w jig-ui --silent ;;
esac
case "$file" in
  tokens/*|scripts/check-tokens.mjs) run node scripts/check-tokens.mjs ;;
esac

if [ "$fail" -ne 0 ]; then
  echo "[verify] Fix the above before going on." >&2
  exit 2
fi
exit 0
