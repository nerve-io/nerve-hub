#!/usr/bin/env bash
# scripts/release.sh — Pre-flight checks + compile MCP binary
#
# Usage:
#   ./scripts/release.sh            # compile to default install dir
#   INSTALL_DIR=~/bin ./scripts/release.sh
#
# What this does:
#   1. Run all backend tests (fail fast)
#   2. Build the frontend (web/dist/)
#   3. Compile MCP binary to INSTALL_DIR
#
# The compiled binary is for MCP mode only.
# Web UI / API server: continue using `bun run dev` from source.
# Share one database via NERVE_DB_PATH (see .env.example).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.nerve-hub}"
BINARY="$INSTALL_DIR/nerve-hub"
DB_PATH="${NERVE_DB_PATH:-$HOME/.nerve/hub.db}"

cd "$REPO_DIR"

echo ""
echo "┌─────────────────────────────────────────┐"
echo "│  nerve-hub release build                │"
echo "└─────────────────────────────────────────┘"
echo ""

# ── Step 1: Backend tests ────────────────────────────────────────────────────
echo "▶ 1/3  Running tests..."
bun test ./src/test.ts ./src/test-agents.ts ./src/test-webhooks.ts
echo "       ✓ All tests passed"
echo ""

# ── Step 2: Frontend build ───────────────────────────────────────────────────
echo "▶ 2/3  Building frontend..."
(cd web && npm run build)
echo "       ✓ web/dist/ ready"
echo ""

# ── Step 3: Compile binary ───────────────────────────────────────────────────
echo "▶ 3/3  Compiling MCP binary..."
mkdir -p "$INSTALL_DIR"
bun build --compile src/main.ts --outfile "$BINARY"
echo "       ✓ Binary: $BINARY"
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────
echo "┌─────────────────────────────────────────┐"
echo "│  Release complete                       │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "MCP binary:  $BINARY"
echo "Database:    $DB_PATH  (set via NERVE_DB_PATH)"
echo ""
echo "── Claude Desktop config ────────────────────────────────────────────────"
cat <<JSON
{
  "mcpServers": {
    "nerve-hub": {
      "command": "$BINARY",
      "args": ["mcp"],
      "env": {
        "NERVE_DB_PATH": "$DB_PATH"
      }
    }
  }
}
JSON
echo ""
echo "── Dev server (shares same DB) ──────────────────────────────────────────"
echo "  NERVE_DB_PATH=$DB_PATH bun run dev"
echo ""
