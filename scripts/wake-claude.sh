#!/usr/bin/env bash
set -euo pipefail

MESSAGE="${1:-}"

if [ -z "$MESSAGE" ]; then
  echo "Usage: wake-claude.sh <message>" >&2
  exit 1
fi

# Copy message to clipboard
printf '%s' "$MESSAGE" | /usr/bin/pbcopy

# Activate Claude Desktop
/usr/bin/osascript -e 'tell application "Claude" to activate'

# Try cliclick for full automation (Cmd+V + Return)
if [ -x "/opt/homebrew/bin/cliclick" ]; then
  sleep 1  # Wait for app to come to foreground
  /opt/homebrew/bin/cliclick "kd:cmd" "t:v" "ku:cmd"
  sleep 0.3
  /opt/homebrew/bin/cliclick "kp:return"
else
  # Fallback: notification + activate only
  ESCAPED=$(printf '%s' "$MESSAGE" | sed 's/\\/\\\\/g; s/"/\\"/g')
  /usr/bin/osascript -e "display notification \"$ESCAPED\" with title \"Claude Desktop Wake\""
  echo "[wake-claude] cliclick not available, used notification fallback" >&2
fi
