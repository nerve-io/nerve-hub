# nerve-hub-api

通过 REST API 与本地 nerve-hub 服务通信。适用于 **无法走 MCP 协议的 cli agent**（如 daemon 模式下的 claude-code），作为 MCP 工具链的替代方案。

## 何时使用本 SKILL

| 场景 | 推荐方式 |
|------|----------|
| claude-code 常规交互模式（有 MCP 工具） | 用 MCP 工具：`complete_task`、`get_briefing` 等 |
| claude-code daemon / 无 MCP 环境 | **使用本 SKILL 的 REST API** |
| 远程 agent 无法访问 localhost | 使用 inbox 文件协议（见本文末尾） |

## 调用约定

- **Base URL**: `http://localhost:3141`
- **Content-Type**: `application/json`
- **认证**: 不需要（仅本地服务）
- **请求体**: JSON（`Content-Type: application/json`）
- **响应体**: JSON

所有 API 以 `/api` 为前缀（但服务器内部在路由前会剥离 `/api`，两种方式均可）。

---

## API 速查

### 1. 获取任务详情

```
GET /api/tasks/<id>
```

**响应** (Task 对象):

```json
{
  "id": "c1b5e63c-8e6e-43f3-a301-a0425eb29c78",
  "projectId": "nerve-hub",
  "title": "任务标题",
  "description": "任务描述（Markdown）",
  "status": "pending",
  "priority": "medium",
  "type": "code",
  "assignee": "claude-code",
  "dependencies": ["<dep-task-id>"],
  "result": "",
  "creator": "claude-desktop",
  "createdAt": "2026-04-26T18:27:47.789Z",
  "updatedAt": "2026-04-26T18:27:47.789Z"
}
```

**curl 示例**:
```bash
curl -s http://localhost:3141/api/tasks/c1b5e63c-8e6e-43f3-a301-a0425eb29c78
```

---

### 2. 获取任务完整上下文

含任务、项目、阻塞依赖、事件、评论的完整视图。**这是了解任务全貌最有效的方式。**

```
GET /api/tasks/<id>/context
```

**响应** (TaskContext):

```json
{
  "task": { "id": "...", "title": "...", "..." },
  "project": {
    "id": "nerve-hub",
    "name": "nerve-hub",
    "description": "...",
    "rules": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "blockedBy": [
    {
      "id": "<blocking-task-id>",
      "title": "前置任务",
      "status": "running",
      "..."
    }
  ],
  "events": [
    {
      "id": "<event-id>",
      "projectId": "nerve-hub",
      "taskId": "c1b5e63c-...",
      "actor": "claude-desktop",
      "action": "task.created",
      "payload": "{\"title\":\"...\"}",
      "createdAt": "2026-04-26T18:27:47.789Z"
    }
  ],
  "comments": [
    {
      "id": "<comment-id>",
      "taskId": "c1b5e63c-...",
      "projectId": "nerve-hub",
      "actor": "claude-code",
      "body": "进展更新...",
      "createdAt": "2026-04-27T10:00:00.000Z"
    }
  ]
}
```

**curl 示例**:
```bash
curl -s http://localhost:3141/api/tasks/c1b5e63c-8e6e-43f3-a301-a0425eb29c78/context
```

---

### 3. 获取阻塞项（未完成的前置依赖）

只返回状态不是 `done` 的依赖任务。

```
GET /api/tasks/<id>/blocked-by
```

**响应** (Task[]):

```json
[
  {
    "id": "<blocking-task-id>",
    "title": "前置任务",
    "status": "running",
    "priority": "high",
    "assignee": "trae-solo",
    "..."
  }
]
```

如果无阻塞项则返回空数组 `[]`。

**curl 示例**:
```bash
curl -s http://localhost:3141/api/tasks/c1b5e63c-8e6e-43f3-a301-a0425eb29c78/blocked-by
```

---

### 4. 更新任务

可部分更新（PATCH 语义）。只传需要修改的字段。`creator` 字段会被服务端静默忽略（不可修改）。

```
PATCH /api/tasks/<id>
Content-Type: application/json
```

**请求体示例**:

```json
{
  "status": "running",
  "result": "正在处理中..."
}
```

```json
{
  "status": "done",
  "result": "已完成：SKILL 文件创建成功，覆盖全部 8 个 API 操作。"
}
```

```json
{
  "description": "更新后的描述内容"
}
```

**可修改字段**:

| 字段 | 类型 | 可选值 |
|------|------|--------|
| `status` | string | `pending`, `running`, `done`, `failed`, `blocked` |
| `priority` | string | `critical`, `high`, `medium`, `low` |
| `type` | string | `code`, `review`, `test`, `deploy`, `research`, `custom` |
| `title` | string | — |
| `description` | string | — |
| `assignee` | string | agent id |
| `result` | string | — |
| `dependencies` | string[] | task id 数组 |
| `projectId` | string | — |

**响应**: 更新后的完整 Task 对象（同 GET 响应）。

**curl 示例**:
```bash
curl -s -X PATCH http://localhost:3141/api/tasks/c1b5e63c-8e6e-43f3-a301-a0425eb29c78 \
  -H "Content-Type: application/json" \
  -d '{"status": "running"}'
```

---

### 5. 获取任务评论列表

```
GET /api/tasks/<id>/comments
```

可选查询参数: `?limit=20&offset=0`（默认 limit=50, offset=0）

**响应** (Comment[]):

```json
[
  {
    "id": "<comment-id>",
    "taskId": "c1b5e63c-8e6e-43f3-a301-a0425eb29c78",
    "projectId": "nerve-hub",
    "actor": "claude-code",
    "body": "已开始处理，先调研现有代码结构。",
    "createdAt": "2026-04-27T10:00:00.000Z"
  }
]
```

**curl 示例**:
```bash
curl -s http://localhost:3141/api/tasks/c1b5e63c-8e6e-43f3-a301-a0425eb29c78/comments
```

---

### 6. 添加评论

```
POST /api/tasks/<id>/comments
Content-Type: application/json
```

**请求体**:

```json
{
  "body": "评论内容（纯文本）"
}
```

- `body` 必填，不能为空
- 最大 10000 字符

**响应** (201 Created):

```json
{
  "id": "<new-comment-id>",
  "taskId": "c1b5e63c-8e6e-43f3-a301-a0425eb29c78",
  "projectId": "nerve-hub",
  "actor": "claude-code",
  "body": "评论内容（纯文本）",
  "createdAt": "2026-04-27T11:00:00.000Z"
}
```

**curl 示例**:
```bash
curl -s -X POST http://localhost:3141/api/tasks/c1b5e63c-8e6e-43f3-a301-a0425eb29c78/comments \
  -H "Content-Type: application/json" \
  -d '{"body": "进展：已完成代码调研，开始编写实现。"}'
```

---

### 7. 生成任务简报

获取结构化的 Markdown 格式任务简报（与 MCP `get_briefing` 输出格式一致）。

```
GET /api/tasks/<id>/briefing
```

**响应**:

```json
{
  "taskId": "c1b5e63c-8e6e-43f3-a301-a0425eb29c78",
  "briefing": "# 任务简报 — 任务标题\n\n## 基本信息\n- 任务 ID：c1b5e63c-...\n- 项目：nerve-hub\n- 优先级：medium\n- 负责人：claude-code\n- 状态：pending\n- 类型：code\n\n## 任务描述\n...\n\n## 阻塞项（0 个）\n...\n\n## 近期事件（最近 5 条）\n...\n\n## 评论（0 条）\n...\n\n---\n## 完成后如何回填结果\n..."
}
```

`briefing` 字段是 Markdown 格式的完整简报文本（含回填指南），可直接呈现给 agent 阅读。

**curl 示例**:
```bash
curl -s http://localhost:3141/api/tasks/c1b5e63c-8e6e-43f3-a301-a0425eb29c78/briefing | jq -r '.briefing'
```

---

### 8. 获取项目列表

```
GET /api/projects
```

**响应** (Project[]):

```json
[
  {
    "id": "nerve-hub",
    "name": "nerve-hub",
    "description": "AI Agent task bus...",
    "rules": "...",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-04-27T00:00:00.000Z"
  }
]
```

**curl 示例**:
```bash
curl -s http://localhost:3141/api/projects
```

---

### 9. 完成任务（Inbox 文件协议）

当 agent **无法访问 localhost**（远程执行、沙箱等场景），使用文件投递方式标记任务完成。

**写入文件**:
```
.nerve/inbox/<taskId>.done.json
```

**文件内容**:
```json
{
  "taskId": "c1b5e63c-8e6e-43f3-a301-a0425eb29c78",
  "result": "一段描述你完成了什么、关键输出是什么"
}
```

服务器每 **5 秒** 轮询 `.nerve/inbox/` 目录：
- 文件必须 **存在超过 1 秒**（防止读到未写完的文件）
- 合法文件 → 自动调用 `db.update()` 将任务状态改为 `done`，写入 `result`
- 处理成功 → 文件移动到 `.nerve/inbox/processed/`
- 处理失败 → 文件移动到 `.nerve/inbox/failed/`
- 任务已是 `done` 状态 → 幂等处理，直接清理文件

**示例**:
```bash
cat > .nerve/inbox/c1b5e63c-8e6e-43f3-a301-a0425eb29c78.done.json << 'EOF'
{
  "taskId": "c1b5e63c-8e6e-43f3-a301-a0425eb29c78",
  "result": "SKILL 文件 skills/nerve-hub-api.md 已创建，覆盖 8 个 API 操作 + inbox 协议。"
}
EOF
```

---

## API 与 Inbox 配合策略

在 daemon 模式下，推荐组合使用：

| 操作 | 推荐方式 | 说明 |
|------|----------|------|
| 读取任务信息 | `GET /tasks/<id>/context` | 完整上下文一次性获取 |
| 获取工作指导 | `GET /tasks/<id>/briefing` | Markdown 简报，可直接阅读 |
| 更新进展 | `POST /tasks/<id>/comments` | 向任务添加进度评论 |
| 更新状态（running） | `PATCH /tasks/<id>` | 标记为正在处理 |
| 更新结果字段 | `PATCH /tasks/<id>` | 部分结果写入 result 字段 |
| 最终完成 | `PATCH /tasks/<id>` 或 inbox 文件 | API 更直接；inbox 是备选 |

---

## 补充 API

以下 API 在特定场景有用：

### 按条件列出任务

```
GET /api/tasks?projectId=nerve-hub&status=pending&assignee=claude-code
```

查询参数：`projectId`、`status`、`priority`、`type`、`assignee`、`search`（标题/描述模糊搜索）、`limit`、`offset`

### 获取项目完整上下文

```
GET /api/projects/<id>/context
```

返回项目信息 + 所有任务列表 + 状态统计。

### 获取指定 agent 规则

```
GET /api/agents/<id>/rules
```

返回该 agent 的规则文本。

---

## 错误处理

- **404**: `{ "error": "not found" }` — 任务/项目不存在
- **400**: `{ "error": "invalid status: ..." }` — 参数校验失败
- **400**: `{ "error": "invalid JSON" }` — 请求体格式错误

对所有写操作，建议先 `GET` 确认资源存在再执行。
