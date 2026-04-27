#!/usr/bin/env bash
# setup-cua.sh — Cua Driver permission initialization for nerve-hub
#
# Usage: bun run setup:cua  (or: bash scripts/setup-cua.sh)
#
# Checks:
#   1. Cua Driver v0.0.12+ installed at ~/.local/bin/cua-driver
#   2. macOS Accessibility permission (required — blocks if missing)
#   3. Screen Recording permission (optional — warns only)
#
# Idempotent: safe to run multiple times.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

DRIVER="${CUA_DRIVER_PATH:-$HOME/.local/bin/cua-driver}"

# ─── Step 1: Check driver installation ───────────────────────────────────

echo ""
echo -e "${BOLD}━━━ Cua Setup ━━━${NC}"
echo ""

if [[ ! -f "$DRIVER" ]]; then
  echo -e "${RED}❌ Cua Driver 未安装。${NC}"
  echo ""
  echo "请运行以下命令安装："
  echo ""
  echo -e "  ${BOLD}curl -fsSL https://cua.download/install.sh | bash${NC}"
  echo ""
  echo "或访问 https://docs.cua.sh 获取安装说明。"
  echo ""
  exit 1
fi

VERSION=$("$DRIVER" --version 2>&1 || true)
echo -e "${GREEN}✅ Cua Driver 已安装${NC}：$VERSION"

# ─── Step 2: Check Accessibility permission ──────────────────────────────

echo ""
echo "🔍 检查 Accessibility 权限..."

PERMS_OUTPUT=$("$DRIVER" call check_permissions '{"prompt": false}' --no-daemon 2>/dev/null || true)

if echo "$PERMS_OUTPUT" | grep -q "Accessibility: granted"; then
  echo -e "${GREEN}✅ Accessibility 权限已授权。${NC}"
else
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}${BOLD}⚠️  Cua 权限声明${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Cua Driver 需要 macOS「辅助功能」权限才能运行。"
  echo "授权后，Cua 进程将可以："
  echo "  • 读取屏幕上任何应用的 UI 元素（包括文本、按钮、输入框）"
  echo "  • 模拟鼠标点击和键盘输入到任何应用"
  echo "  • 在后台静默操控 GUI，无需前台焦点"
  echo "这是 Cua 作为 GUI Agent 的核心能力，也是需要谨慎管理的安全权限。"
  echo "你可以随时在「系统设置 → 隐私与安全性 → 辅助功能」中撤销此权限。"
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  echo "正在打开系统设置辅助功能页面..."
  open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility" 2>/dev/null || true

  echo ""
  echo "⏳ 请在系统设置中勾选授权终端应用（Terminal / iTerm2 / VS Code 等）"
  echo "   的辅助功能权限..."
  echo "   等待授权...（最多 60 秒）"
  echo ""

  for i in $(seq 1 60); do
    sleep 1
    PERMS_OUTPUT=$("$DRIVER" call check_permissions '{"prompt": false}' --no-daemon 2>/dev/null || true)
    if echo "$PERMS_OUTPUT" | grep -q "Accessibility: granted"; then
      echo ""
      echo -e "${GREEN}✅ Accessibility 权限已授权！${NC}"
      break
    fi
    if [[ $i -eq 60 ]]; then
      echo ""
      echo -e "${RED}❌ 超时：60 秒内未检测到 Accessibility 权限授权。${NC}"
      echo "   请手动授权后重新运行本脚本。"
      echo ""
      exit 1
    fi
    printf "."
  done
fi

# ─── Step 3: Check Screen Recording permission (optional) ────────────────

echo ""
echo "🔍 检查 Screen Recording 权限..."

PERMS_OUTPUT=$("$DRIVER" call check_permissions '{"prompt": false}' --no-daemon 2>/dev/null || true)

if echo "$PERMS_OUTPUT" | grep -q "Screen Recording: granted"; then
  echo -e "${GREEN}✅ Screen Recording 权限已授权。${NC}"
else
  echo -e "${YELLOW}💡 Screen Recording 权限未授权（可选，仅影响截图功能）。${NC}"
  echo "   如需使用截图功能，请在「系统设置 → 隐私与安全性 → 屏幕录制」中授权。"
fi

# ─── Done ────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}✅ Cua 已就绪，可启动 nerve-hub Cua Agent${NC}"
echo ""
echo "  启动 Cua Agent: ${BOLD}bun run cua${NC}"
echo "  或在启动开发服务器时自动连带: ${BOLD}bun run dev${NC}"
echo ""
