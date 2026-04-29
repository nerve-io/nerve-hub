#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3142/api}"

PROJECT=$(curl -sf -X POST "$BASE/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","description":"Docker 隔离测试用项目"}')
PID=$(echo "$PROJECT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created project: $PID"

for STATUS in pending running done failed; do
  TASK=$(curl -sf -X POST "$BASE/tasks" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"[$STATUS] 测试任务 - $(date +%s)\",\"projectId\":\"$PID\",\"priority\":\"high\",\"description\":\"## 测试描述\\n\\n- 条目一\\n- 条目二\\n\\n代码块: echo hello\",\"type\":\"deploy\"}")
  TID=$(echo "$TASK" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  curl -sf -X PATCH "$BASE/tasks/$TID" \
    -H "Content-Type: application/json" \
    -d "{\"status\":\"$STATUS\"}" >/dev/null
done

curl -sf -X POST "$BASE/tasks" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"这是一个非常非常非常非常非常非常非常非常非常非常非常非常长的任务标题，用来测试 UI 溢出和截断行为是否正常\",\"projectId\":\"$PID\",\"status\":\"pending\",\"type\":\"research\"}" >/dev/null

echo "Seed complete."
