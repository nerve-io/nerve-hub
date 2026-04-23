<p align="center">
  <strong>Nerve Hub</strong>
</p>

<p align="center">
  AI Agent 任务总线 — 多智能体协作的神经系统
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> · <a href="#rest-api">REST API</a> · <a href="#mcp-工具">MCP 工具</a> · <a href="#数据模型">数据模型</a> · <a href="#开发">开发</a>
</p>

---

## 这是什么

Nerve Hub 是一个轻量级的 **AI Agent 任务协作中心**。

它提供 REST API 和 MCP Server 两种接口，让多个 AI Agent（Claude、Cursor、GPT 等）可以创建任务、认领任务、提交成果、查询进度。数据存储在本地 SQLite 文件中，零外部依赖。

**核心能力：**
- 📋 **任务 CRUD** — 创建、查询、更新、删除任务
- 🏷️ **负责人追踪** — assignee 字段，按 Agent 过滤任务
- 🤖 **MCP Server** — 7 个工具，含 `claim_task` / `complete_task` 语义化操作
- 🌐 **REST API** — 标准 HTTP 接口，支持 status + assignee 组合过滤
- 💾 **本地存储** — bun:sqlite 单文件，无需数据库服务

## 快速开始

### 前置条件

- [Bun](https://bun.sh/) >= 1.0

### 安装

```bash
git clone git@github.com:nerve-io/nerve-hub.git
cd nerve-hub
bun install
```

### 启动 REST API

```bash
bun run src/main.ts start          # 默认端口 3141
bun run src/main.ts start --port 8080
```

### 启动 MCP Server

```bash
bun run src/main.ts mcp
```

### 运行测试

```bash
bun test src/test.ts
```

## REST API

Base URL: `http://localhost:3141`

所有请求和响应均为 JSON。

### 健康检查

```bash
curl http://localhost:3141/health
# {"status":"ok"}
```

### 创建任务

```bash
curl -X POST http://localhost:3141/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "实现登录接口", "description": "OAuth2 flow", "assignee": "claude"}'
# → 201 {"id": "...", "title": "实现登录接口", "status": "pending", "assignee": "claude", ...}
```

### 查询任务

```bash
# 列出所有任务
curl http://localhost:3141/tasks

# 按状态过滤
curl http://localhost:3141/tasks?status=pending

# 按负责人过滤
curl http://localhost:3141/tasks?assignee=claude

# 组合过滤
curl http://localhost:3141/tasks?status=running&assignee=claude

# 获取单个任务
curl http://localhost:3141/tasks/{id}
```

### 更新任务

```bash
curl -X PATCH http://localhost:3141/tasks/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "result": "PR #42 merged"}'
```

可更新字段：`title`、`description`、`status`、`assignee`、`result`

### 删除任务

```bash
curl -X DELETE http://localhost:3141/tasks/{id}
# → {"deleted": true}
```

## MCP 工具

Nerve Hub 提供 7 个 MCP 工具，分为通用操作和语义化快捷操作两类：

### 通用操作

| 工具 | 说明 |
|------|------|
| `create_task` | 创建任务（title, description?, assignee?） |
| `list_tasks` | 列出任务，可按 status 和/或 assignee 过滤 |
| `get_task` | 获取单个任务详情 |
| `update_task` | 更新任务字段（title?, description?, status?, assignee?, result?） |
| `delete_task` | 删除任务 |

### 语义化快捷操作

| 工具 | 说明 |
|------|------|
| `claim_task` | 认领任务：原子设置 status=running + assignee，Agent 开始工作前调用 |
| `complete_task` | 完成任务：原子设置 status=done + result，Agent 完成工作后调用 |

> `claim_task` 和 `complete_task` 各自是一次 `db.update()` 调用，保证原子性。推荐 Agent 优先使用这两个工具，而非手动 `update_task`。

### Claude Desktop 配置

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "nerve-hub": {
      "command": "bun",
      "args": ["/absolute/path/to/nerve-hub/src/main.ts", "mcp"]
    }
  }
}
```

> **注意**：必须使用绝对路径，因为 Claude Desktop 的 cwd 不可预测。

## 数据模型

### Task

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | UUID，自动生成 |
| `title` | string | 任务标题（必填） |
| `description` | string | 任务描述 |
| `status` | `"pending"` \| `"running"` \| `"done"` \| `"failed"` \| `"blocked"` | 任务状态，默认 `pending` |
| `assignee` | string | 负责人（Agent 名称或人名），默认空 |
| `result` | string | 任务成果 |
| `createdAt` | string | ISO 8601 创建时间 |
| `updatedAt` | string | ISO 8601 更新时间 |

### 状态流转

```
pending  → running  → done
                  → failed
pending  → blocked → running
任意状态 → pending（重置）
```

典型多 Agent 协作流程：

```
Agent A: create_task(title, assignee="claude")     → pending
Agent B: claim_task(id, assignee="claude")          → running
Agent B: complete_task(id, result="PR merged")      → done
```

## 项目结构

```
nerve-hub/
├── src/
│   ├── main.ts    # 入口（start / mcp 两种模式）
│   ├── db.ts      # bun:sqlite 存储层（TaskDB）
│   ├── api.ts     # Bun.serve() REST API
│   ├── mcp.ts     # MCP stdio server（7 个工具）
│   └── test.ts    # bun:test 冒烟测试（17 个用例）
├── skills/        # Claude Code Skill
│   └── nerve-hub/
│       ├── SKILL.md
│       ├── reference.md
│       └── scripts/nerve.sh
├── package.json
├── tsconfig.json
└── bun.lock
```

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Bun |
| HTTP | Bun.serve()（零依赖） |
| 数据库 | bun:sqlite（Bun 内置） |
| 数据校验 | Zod（MCP schema） |
| MCP SDK | @modelcontextprotocol/sdk |
| 测试 | bun:test（Bun 内置） |

## 开发

```bash
bun install                    # 安装依赖
bun run src/main.ts start      # 启动 API 服务
bun run src/main.ts mcp        # 启动 MCP 服务
bun test src/test.ts           # 运行测试
```

## License

MIT
