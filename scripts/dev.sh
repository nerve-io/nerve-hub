#!/usr/bin/env bash
# scripts/dev.sh — Start API server + Vite frontend together
# Ctrl+C kills both processes.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Kill all background jobs on exit (Ctrl+C or error)
trap 'echo ""; echo "Shutting down..."; kill $(jobs -p) 2>/dev/null; wait 2>/dev/null' EXIT

echo "▶ API      http://localhost:3141"
echo "▶ Web UI   http://localhost:5173"
echo ""

bun run src/main.ts start &
(cd web && npm run dev) &

wait
