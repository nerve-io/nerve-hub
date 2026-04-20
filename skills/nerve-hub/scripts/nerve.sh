#!/usr/bin/env bash
# Nerve Hub CLI — REST API 封装
# 用法: bash nerve.sh <command> [args...] [options...]
# 所有信息提示输出到 stderr，stdout 只输出纯 JSON（方便管道处理）

set -euo pipefail

HUB_URL="${NERVE_HUB_URL:-http://localhost:3141}"
API="$HUB_URL/api/v1"

# ─── Helpers ────────────────────────────────────────────────────────────────

die() { echo "❌ $*" >&2; exit 1; }
info() { echo "$*" >&2; }

get()  { curl -sf "$API/$1" | python3 -m json.tool 2>/dev/null || curl -sf "$API/$1"; }
post() { curl -sf -X POST "$API/$1" -H "Content-Type: application/json" -d "$2" | python3 -m json.tool 2>/dev/null || curl -sf -X POST "$API/$1" -H "Content-Type: application/json" -d "$2"; }
patch(){ curl -sf -X PATCH "$API/$1" -H "Content-Type: application/json" -d "$2" | python3 -m json.tool 2>/dev/null || curl -sf -X PATCH "$API/$1" -H "Content-Type: application/json" -d "$2"; }

# Parse optional flags
parse_flags() {
  DESCRIPTION=""
  TYPE="custom"
  PRIORITY="medium"
  ASSIGNEE=""
  TAGS=""
  DEPENDENCIES=""
  RESULT_TYPE=""
  RESULT_PATH=""
  RESULT_SUMMARY=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --description) DESCRIPTION="$2"; shift 2 ;;
      --type)        TYPE="$2";        shift 2 ;;
      --priority)    PRIORITY="$2";    shift 2 ;;
      --assignee)    ASSIGNEE="$2";    shift 2 ;;
      --tags)        TAGS="$2";        shift 2 ;;
      --dependencies) DEPENDENCIES="$2"; shift 2 ;;
      --status)      STATUS="$2";      shift 2 ;;
      --progress)    PROGRESS="$2";    shift 2 ;;
      --result-type) RESULT_TYPE="$2"; shift 2 ;;
      --path)        RESULT_PATH="$2"; shift 2 ;;
      --summary)     RESULT_SUMMARY="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
}

build_tags_json() {
  if [[ -z "$TAGS" ]]; then echo "[]"; return; fi
  local arr=$(echo "$TAGS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$' | while read -r tag; do
    printf '"%s",' "$tag"
  done)
  echo "[${arr%,}]"
}

build_deps_json() {
  if [[ -z "$DEPENDENCIES" ]]; then echo "[]"; return; fi
  local arr=$(echo "$DEPENDENCIES" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$' | while read -r dep; do
    printf '"%s",' "$dep"
  done)
  echo "[${arr%,}]"
}

# ─── Commands ───────────────────────────────────────────────────────────────

cmd_list_projects() {
  info "📋 项目列表"
  get "projects"
}

cmd_create_project() {
  local name="${1:?项目名称不能为空}"
  local desc="${2:-}"
  local body=$(cat <<EOF
{"name":"$name","description":"$desc"}
EOF
)
  info "📦 创建项目: $name"
  post "projects" "$body"
}

cmd_list_tasks() {
  local projectId="${1:?项目 ID 不能为空}"
  info "📋 项目 $projectId 的任务列表"
  get "tasks?projectId=$projectId"
}

cmd_create_task() {
  local projectId="${1:?项目 ID 不能为空}"
  local title="${2:?任务标题不能为空}"
  shift 2
  parse_flags "$@"

  local tags_json=$(build_tags_json)
  local deps_json=$(build_deps_json)

  local body=$(cat <<EOF
{
  "projectId":"$projectId",
  "title":"$title",
  "description":"$DESCRIPTION",
  "type":"$TYPE",
  "priority":"$PRIORITY",
  "assignee":"$ASSIGNEE",
  "tags":$tags_json,
  "dependencies":$deps_json
}
EOF
)
  info "📋 创建任务: $title"
  post "tasks" "$body"
}

cmd_claim_task() {
  local taskId="${1:?任务 ID 不能为空}"
  local agent="${2:-$(whoami)}"
  local body="{\"status\":\"running\",\"assignee\":\"$agent\"}"
  info "🤖 认领任务: $taskId (by $agent)"
  patch "tasks/$taskId" "$body"
}

cmd_update_task() {
  local taskId="${1:?任务 ID 不能为空}"
  shift
  parse_flags "$@"

  local body="{}"
  [[ -n "${STATUS:-}" ]] && body=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); d['status']='$STATUS'; print(json.dumps(d))")
  [[ -n "${PROGRESS:-}" ]] && body=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); d['progress']=$PROGRESS; print(json.dumps(d))")
  [[ -n "${ASSIGNEE:-}" ]] && body=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); d['assignee']='$ASSIGNEE'; print(json.dumps(d))")

  info "✏️ 更新任务: $taskId"
  patch "tasks/$taskId" "$body"
}

cmd_submit_result() {
  local taskId="${1:?任务 ID 不能为空}"
  shift
  parse_flags "$@"

  local body=$(cat <<EOF
{
  "status":"done",
  "progress":100,
  "result":{"type":"$RESULT_TYPE","path":"$RESULT_PATH","summary":"$RESULT_SUMMARY"}
}
EOF
)
  info "✅ 提交成果: $taskId"
  patch "tasks/$taskId" "$body"
}

cmd_fail_task() {
  local taskId="${1:?任务 ID 不能为空}"
  local reason="${2:-执行失败}"
  local body="{\"status\":\"failed\",\"error\":\"$reason\"}"
  info "❌ 任务失败: $taskId"
  patch "tasks/$taskId" "$body"
}

cmd_get_task() {
  local taskId="${1:?任务 ID 不能为空}"
  get "tasks/$taskId"
}

cmd_task_logs() {
  local taskId="${1:?任务 ID 不能为空}"
  get "tasks/$taskId/logs"
}

cmd_events() {
  local projectId="${1:?项目 ID 不能为空}"
  get "projects/$projectId/events?limit=50"
}

cmd_task_context() {
  local taskId="${1:?任务 ID 不能为空}"

  # 获取任务详情
  local task
  task=$(curl -sf "$API/tasks/$taskId") || die "任务 $taskId 不存在"

  local projectId=$(echo "$task" | python3 -c "import sys,json; print(json.load(sys.stdin)['projectId'])")
  local title=$(echo "$task" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")
  local description=$(echo "$task" | python3 -c "import sys,json; print(json.load(sys.stdin).get('description',''))")
  local deps=$(echo "$task" | python3 -c "import sys,json; print(json.load(sys.stdin).get('dependencies',[]))")

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "任务上下文（可直接粘贴到新会话）"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "## 任务: $title"
  echo ""
  echo "### 描述"
  echo "$description"
  echo ""

  # 依赖任务的结果
  if [[ "$deps" != "[]" && "$deps" != "" ]]; then
    echo "### 依赖任务的产出"
    echo "$deps" | python3 -c "
import sys, json
deps = json.load(sys.stdin)
for dep_id in deps:
    print(f'- 依赖任务 ID: {dep_id}')
" 2>/dev/null
    echo ""
    echo "⚠️ 请通过以下命令获取依赖任务的详细结果："
    echo "   curl -s $API/tasks/<依赖任务ID> | python3 -m json.tool"
    echo ""
  fi

  echo "### 任务 ID"
  echo "$taskId"
  echo ""
  echo "### Hub API"
  echo "- 更新状态: PATCH $API/tasks/$taskId"
  echo "- 提交成果: PATCH $API/tasks/$taskId  {\"status\":\"done\",\"result\":{...}}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ─── Router ─────────────────────────────────────────────────────────────────

COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  list-projects)   cmd_list_projects "$@" ;;
  create-project)  cmd_create_project "$@" ;;
  list-tasks)      cmd_list_tasks "$@" ;;
  create-task)     cmd_create_task "$@" ;;
  claim-task)      cmd_claim_task "$@" ;;
  update-task)     cmd_update_task "$@" ;;
  submit-result)   cmd_submit_result "$@" ;;
  fail-task)       cmd_fail_task "$@" ;;
  get-task)        cmd_get_task "$@" ;;
  task-logs)       cmd_task_logs "$@" ;;
  events)          cmd_events "$@" ;;
  task-context)    cmd_task_context "$@" ;;
  help|*)
    echo "Nerve Hub CLI"
    echo ""
    echo "用法: bash nerve.sh <command> [args...]"
    echo ""
    echo "命令:"
    echo "  list-projects                     查看所有项目"
    echo "  create-project <name> [desc]      创建项目"
    echo "  list-tasks <projectId>            查看项目任务"
    echo "  create-task <projectId> <title>   创建任务（支持 --description --type --priority --assignee --tags --dependencies）"
    echo "  claim-task <taskId> [agent]       认领任务"
    echo "  update-task <taskId>              更新状态（--status --progress）"
    echo "  submit-result <taskId>            提交成果（--result-type --path --summary）"
    echo "  fail-task <taskId> [reason]       记录失败"
    echo "  get-task <taskId>                 查看任务详情"
    echo "  task-logs <taskId>                查看变更历史"
    echo "  events <projectId>                查看事件日志"
    echo "  task-context <taskId>             获取任务上下文（用于注入新会话）"
    echo ""
    echo "环境变量:"
    echo "  NERVE_HUB_URL  Hub 服务地址（默认 http://localhost:3141）"
    ;;
esac
