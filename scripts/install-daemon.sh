#!/usr/bin/env bash
set -euo pipefail

NERVE_DB_PATH="${NERVE_DB_PATH:-/Users/neilji/AIGC/nerve-hub/.nerve/hub.db}"
PROJECT_DIR="/Users/neilji/AIGC/nerve-hub"
PLIST_PATH="$HOME/Library/LaunchAgents/com.nerve-hub.daemon.plist"

# ─── Generate launchd plist ──────────────────────────────────────────────────

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nerve-hub.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/bun</string>
        <string>run</string>
        <string>daemon</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NERVE_HUB_AGENT_NAME</key>
        <string>claude-code</string>
        <key>NERVE_DB_PATH</key>
        <string>${NERVE_DB_PATH}</string>
        <key>DAEMON_PORT</key>
        <string>3142</string>
        <key>HOME</key>
        <string>${HOME}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/.nerve/daemon.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/.nerve/daemon.error.log</string>
</dict>
</plist>
EOF

echo "✅ Generated: $PLIST_PATH"

# ─── Load service ───────────────────────────────────────────────────────────

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✅ Daemon installed and started."
echo ""
echo "Verify:"
echo "  launchctl list | grep nerve-hub"
echo "  curl http://127.0.0.1:3142/webhook -X POST -H 'Content-Type: application/json' -d '{\"task_id\":\"test\",\"briefing\":\"echo hello\"}'"
