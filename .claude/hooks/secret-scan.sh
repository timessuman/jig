#!/usr/bin/env bash
# PreToolUse(Bash) — refuse a `git commit` whose changes carry a secret or this
# machine's home path. Exits 2 to block; every other command passes untouched.
#
# The hook fires on every Bash call and filters here, so it does not depend on
# the matcher understanding command arguments.
#
# Scans staged and unstaged tracked changes: `git commit -a` and
# `git commit <path>` both commit work that was never staged.

set -uo pipefail
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).tool_input?.command??""))}catch{}})')
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit' || exit 0

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0
fail=0

if command -v gitleaks >/dev/null 2>&1; then
  if ! out=$(gitleaks protect --staged --no-banner --redact 2>&1); then
    fail=1
    echo "[secrets] gitleaks flagged staged content:" >&2
    echo "$out" >&2
  fi
else
  echo "[secrets] gitleaks is not installed; only the built-in patterns ran." >&2
fi

added=$( { git diff --cached; git diff; } 2>/dev/null | grep -E '^\+[^+]' || true)
[ -z "$added" ] && exit $(( fail ? 2 : 0 ))

check() {
  hits=$(printf '%s\n' "$added" | grep -nEI -e "$1" || true)
  if [ -n "$hits" ]; then
    fail=1
    echo "[secrets] $2" >&2
    printf '%s\n' "$hits" | sed 's/\(.\{140\}\).*/\1…/' >&2
  fi
}

check '(AKIA|ASIA)[0-9A-Z]{16}'                     "AWS access key id"
check 'sk-(ant-)?[A-Za-z0-9_-]{20,}'                "Anthropic or OpenAI secret key"
check 'npm_[A-Za-z0-9]{36}'                         "npm access token"
check 'gh[pousr]_[A-Za-z0-9]{30,}'                  "GitHub token"
check '-----BEGIN [A-Z ]*PRIVATE KEY-----'          "Private key block"
check '[a-z+]+://[^:/[:space:]]+:[^@/[:space:]]+@'   "URL with an inline password"

# A tracked file must not name this machine's home directory: it leaks the
# username and breaks for everyone else. Test fixtures use made-up homes.
check "$HOME/"                                      "Absolute home path ($HOME). Use a relative path."

if [ "$fail" -ne 0 ]; then
  echo "[secrets] Commit blocked. Remove the lines above; rotate any real secret already exposed." >&2
  exit 2
fi
exit 0
