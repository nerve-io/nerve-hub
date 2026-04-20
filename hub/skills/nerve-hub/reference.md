# Nerve Hub REST API 速查

Base URL: `http://localhost:3141/api/v1`

所有请求和响应均为 JSON。通过 `X-Nerve-Agent` header 标识调用者身份。

---

## 项目

### 创建项目
```
POST /projects
Body: { "name": "string", "description": "string" }
```

### 列出所有项目
```
GET /projects
```

### 获取单个项目
```
GET /projects/:id
```

### 获取项目看板（按状态分组的任务）
```
GET /projects/:id/board
Response: { "project": Project, "board": { "pending": Task[], "running": Task[], ... } }
```

### 获取项目上下文
```
GET /projects/:id/context
Response: { "project": Project, "taskSummary": { "pending": 3, "done": 5, ... }, "recentTasks": Task[] }
```

### 获取项目事件日志
```
GET /projects/:id/events?limit=100
```

---

## 任务

### 创建任务
```
POST /tasks
Body: {
  "projectId": "uuid",           // 必填
  "title": "string",             // 必填
  "description": "string",
  "type": "code|review|test|deploy|research|custom",
  "priority": "critical|high|medium|low",
  "assignee": "string",
  "dependencies": ["uuid", ...],
  "tags": ["string", ...],
  "metadata": {}
}
```

### 查询任务
```
GET /tasks?projectId=xxx&status=pending&assignee=claude&type=code
```

### 获取单个任务
```
GET /tasks/:id
```

### 更新任务
```
PATCH /tasks/:id
Body: {
  "title": "string",
  "description": "string",
  "status": "pending|running|blocked|waiting|done|failed|archived",
  "priority": "critical|high|medium|low",
  "assignee": "string",
  "progress": 0-100,
  "result": { "type": "git", "path": "https://...", "summary": "..." },
  "error": "string",
  "tags": ["string", ...]
}
```

### 删除任务
```
DELETE /tasks/:id
```

### 获取任务变更历史
```
GET /tasks/:id/logs?limit=100
Response: [{ "field": "status", "oldValue": "pending", "newValue": "running", "actor": "claude", "timestamp": "..." }]
```

---

## 健康检查

```
GET /health
Response: { "status": "ok", "service": "nerve-hub", "version": "0.1.0" }
```

---

## 任务状态流转

```
pending → running → done
                → blocked → running
                → waiting → running
                → failed
任意状态 → archived
```

## 任务类型

| 值 | 含义 |
|---|---|
| `code` | 写代码 |
| `review` | 代码审查 |
| `test` | 写测试 |
| `deploy` | 部署 |
| `research` | 调研 |
| `custom` | 其他 |

## 优先级

| 值 | 含义 |
|---|---|
| `critical` | 紧急 |
| `high` | 高 |
| `medium` | 中（默认） |
| `low` | 低 |

## 成果格式（result 字段）

```json
{
  "type": "git",
  "path": "https://github.com/org/repo",
  "content": null,
  "summary": "实现了用户登录模块"
}
```

`type` 建议值：`git`（代码仓库）、`doc`（文档）、`url`（其他链接）、`output`（直接产出）。
