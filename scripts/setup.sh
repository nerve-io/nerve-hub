#!/usr/bin/env bash
# scripts/setup.sh — Arch-aware dependency installer
#
# Problem: TRAE SOLO runs in an amd64 sandbox VM; local machine is arm64.
# node_modules contains arch-specific binaries (esbuild, rollup native, etc.)
#
# Strategy (per package manager):
#   Backend (bun):  arch-isolated via node_modules.<arch>/ symlink.
#                   bun does not auto-install platform optional deps, so we
#                   need separate directories per arch.
#   Frontend (npm): npm natively handles platform optional deps on every install,
#                   so a plain `npm install` is sufficient — no symlink trick needed.
#
# Usage:  bun run setup   (or: bash scripts/setup.sh)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCH="$(uname -m)"    # arm64 | x86_64
cd "$REPO_DIR"

echo ""
echo "nerve-hub setup  [arch: $ARCH]"
echo ""

# ─── Backend: bun with arch-isolated node_modules ────────────────────────────

setup_bun() {
  local dir="$1" label="$2"
  local stamp_dir="$dir/node_modules.$ARCH"
  local stamp_file="$stamp_dir/.setup-stamp"
  local modules_link="$dir/node_modules"
  local lockfile="$dir/bun.lock"

  mkdir -p "$stamp_dir"

  # Ensure node_modules is a symlink to the arch-specific dir
  if [ -L "$modules_link" ] || [ ! -e "$modules_link" ]; then
    ln -sfn "node_modules.$ARCH" "$modules_link"
  else
    echo "  ⚠  $modules_link is a real directory, not a symlink."
    echo "     Run: rm -rf $modules_link  then retry."
    exit 1
  fi

  local needs_install=false
  [ ! -f "$stamp_file" ] && needs_install=true
  [ -f "$lockfile" ] && [ "$lockfile" -nt "$stamp_file" ] && needs_install=true

  if $needs_install; then
    echo "▶ Installing $label deps  ($dir) via bun..."
    (cd "$dir" && bun install 2>&1 | grep -v "^$" | sed 's/^/  /')
    touch "$stamp_file"
    echo "  ✓ $label deps installed  (node_modules.$ARCH)"
  else
    echo "✓ $label deps up-to-date  (node_modules.$ARCH)"
  fi
}

# ─── Frontend: npm handles platform native deps automatically ─────────────────

setup_npm() {
  local dir="$1" label="$2"
  # Use an arch-stamped file so switching platforms triggers a reinstall
  local stamp_file="$dir/.setup-stamp-$ARCH"
  local pkg_json="$dir/package.json"

  # npm wants a real directory — remove any symlink left from earlier attempts
  local modules_link="$dir/node_modules"
  if [ -L "$modules_link" ]; then
    rm "$modules_link"
  fi

  local needs_install=false
  [ ! -f "$stamp_file" ] && needs_install=true
  [ -f "$pkg_json" ] && [ "$pkg_json" -nt "$stamp_file" ] && needs_install=true

  if $needs_install; then
    echo "▶ Installing $label deps  ($dir) via npm..."
    # npm resolves and installs platform-specific optional deps (rollup, esbuild)
    (cd "$dir" && npm install 2>&1 | grep -v "^$" | sed 's/^/  /')
    touch "$stamp_file"
    echo "  ✓ $label deps installed"
  else
    echo "✓ $label deps up-to-date"
  fi
}

# ─── Run ─────────────────────────────────────────────────────────────────────

setup_bun "." "backend"
setup_npm "web" "frontend"

echo ""
echo "Setup complete."
echo ""
