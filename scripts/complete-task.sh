#!/usr/bin/env bash
# scripts/complete-task.sh — Drop a result file into the inbox.
#
# Usage:
#   bash scripts/complete-task.sh <taskId> "<result summary>"
#
# Example:
#   bash scripts/complete-task.sh abc-123 "Fixed the login bug by patching auth.ts line 42"
#
# The nerve-hub server picks this up within 5 seconds and marks the task done.
# Use this when you can't reach the API/MCP directly (e.g. from a CI script).

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <taskId> <result>"
  exit 1
fi

TASK_ID="$1"
RESULT="$2"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INBOX_DIR="${NERVE_INBOX_PATH:-$REPO_DIR/.nerve/inbox}"

mkdir -p "$INBOX_DIR"

OUTFILE="$INBOX_DIR/${TASK_ID}.done.json"

# Write atomically via a temp file.
TMP="$(mktemp "$INBOX_DIR/.tmp.XXXXXX")"
printf '{\n  "taskId": %s,\n  "result": %s\n}\n' \
  "$(printf '%s' "$TASK_ID" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
  "$(printf '%s' "$RESULT"  | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
  > "$TMP"
mv "$TMP" "$OUTFILE"

echo "✓ Result filed: $OUTFILE"
echo "  nerve-hub will pick it up within 5 seconds."
