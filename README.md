# nerve-hub

AI Agent 任务总线 — 个人本地使用，支持异构 Agent 协作。

---

## 快速开始

### 安装依赖

```bash
bun run setup
```

### 启动服务（API + Web UI + Runner）

```bash
bun run dev
```

### 访问

- **Web UI**：http://localhost:5173
- **API**：http://localhost:3141
- **MCP Server**：通过 Claude Desktop 或 MCP 客户端接入（支持本地 stdio 或远端 HTTP/SSE）

---

## 局域网多设备接入

除了本地 `stdio` 方式运行，nerve-hub 还内置了 HTTP/SSE 传输层，允许局域网内的其他设备（如你的另一台电脑上的 IDE）直接连接。

### 远端 Agent 接入方法

1. 确保服务器主机已运行 `bun run dev`。
2. 在**远端设备**上，运行配置向导：
   ```bash
   bun run agent-setup
   ```
3. 在提示输入 `nerve-hub 地址` 时，输入类似 `http://192.168.1.x:3141`。
4. 脚本会自动为你生成如下格式的配置（支持通过 URL 的 query param 注入身份）：

```json
{
  "mcpServers": {
    "nerve-hub": {
      "transport": "sse",
      "url": "http://192.168.1.x:3141/api/mcp/sse?agentName=my-agent&agentUid=xxxxxxxx-xxxx-xxxx"
    }
  }
}
```

> **安全可选**：如果配置了 `NERVE_HUB_TOKEN` 环境变量，远端 MCP 客户端建立连接时需要在 Header 中携带 `Authorization: Bearer <TOKEN>` 才能接入。

---

## Supported Products

以下产品已通过实际工作流验证，可与 nerve-hub 稳定协作。

### Claude Desktop (Cowork 模式)

- **角色**：任务调度方（Orchestrator）
- **接入方式**：MCP stdio server，`bun run release` 后复制输出的 JSON 到 Claude Desktop 配置
- **能力**：创建项目/任务、生成 Briefing、认领任务、回填结果、查询事件日志
- **验证状态**：✅ 所有 23 个 MCP 工具稳定可用

### TRAE SOLO（Code Solo 模式）

- **角色**：任务执行方（Implementor）
- **接入方式**：在 TRAE 中配置 nerve-hub MCP server，使用 **Code Solo 模式**
- **能力**：接收 Briefing、实施代码任务、通过 `complete_task` 工具直接回填结果
- **验证状态**：✅ MCP 工具发现与调用稳定可用
- **已知限制**：
  - MTC Solo 模式无法发现/调用本地自定义 MCP（疑似产品 Bug，与 nerve-hub 无关）
  - 建议在**独立工作目录**执行任务，避免在 nerve-hub 仓库本身内工作（会产生语义混淆）

### Claude Code (CLI)

- **角色**：任务执行方 / 调度方均可
- **接入方式**：全局 MCP，运行以下命令一次性配置：
  ```bash
  claude mcp add nerve-hub -s user \
    -e NERVE_DB_PATH=/Users/your-name/.nerve/hub.db \
    -- bun /path/to/nerve-hub/src/mcp.ts
  ```
- **能力**：与其他 Agent 相同，通过 MCP 工具收发任务
- **验证状态**：✅ MCP 接入已验证可用
- **提升自动化程度**：Claude Code 默认每次工具调用都需手动批准，接入 nerve-hub 后建议在 `~/.claude/settings.json` 中配置权限模式以减少中断：
  ```json
  {
    "permissionMode": "auto"
  }
  ```
  `auto` 模式由内置分类器自动放行安全操作，拦截高危操作（批量删除等），无需逐条确认。若完全信任当前环境，也可设为 `"bypassPermissions"` 跳过所有审批。详见 [Claude Code 权限文档](https://code.claude.com/docs/en/permission-modes)。

### Google Antigravity

- **角色**：任务执行方（Implementor）
- **接入方式**：MCP stdio server，`bun run release` 后将输出的 JSON 复制到：
  ```
  ~/.gemini/antigravity/mcp_config.json
  ```
- **能力**：与 TRAE SOLO 相同，通过 MCP 工具收发任务
- **验证状态**：✅ MCP 接入已验证可用

---

## 架构概述

nerve-hub 由三部分组成：

- **API Server**（`src/main.ts` + `src/api.ts`）：REST API + WebSocket 实时推送
- **Runner**（`src/runner.ts`）：任务调度 + Webhook 派发 + 心跳监控
- **Web UI**（`web/`）：Glassmorphism 深色主题，看板 + 任务详情 + Agent 管理

---

## Agent 类型

| 类型 | 说明 | 接入状态 |
|------|------|---------|
| Webhook | AI 产品通过 HTTP 接收任务、回调结果、发送心跳 | ✅ 已支持 |
| Manual | 商业 AI（Claude.ai、TRAE SOLO 等），人工中转 + Briefing 复制 | ✅ 已支持 |
| CLI | 本地命令行进程，stdin/stdout 交互 | 🚧 TODO |

### CLI Agent（计划中）

> 详见 [SPARKS.md — SPARK-010](./SPARKS.md)。

---

## MCP 工具列表

共 23 个工具。

### 项目管理

| 工具 | 说明 |
|------|------|
| `create_project` | 创建项目（name, description?, rules?） |
| `list_projects` | 列出所有项目 |
| `get_project_context` | 获取项目上下文（项目 + 任务 + 统计），支持 ID 或项目名 |
| `get_project_rules` | 获取项目协作规则，支持 ID 或项目名（如 `"nerve-hub"`） |

### 任务管理

| 工具 | 说明 |
|------|------|
| `create_task` | 创建任务（title, projectId?, description?, priority?, type?, assignee?, dependencies?, creator?） |
| `list_tasks` | 列出任务，可按 projectId / status / priority / type / assignee 过滤，支持分页 |
| `get_task` | 获取单个任务详情 |
| `get_task_context` | 获取任务完整上下文（任务 + 项目 + 阻塞依赖 + 事件） |
| `update_task` | 更新任务字段（creator 字段只读，传入时静默忽略） |
| `delete_task` | 删除任务 |
| `search_tasks` | 按关键词搜索任务（匹配标题和描述） |
| `claim_task` | 认领任务：原子设置 status=running + assignee |
| `complete_task` | 完成任务：原子设置 status=done + result |
| `get_blocked_by` | 获取未完成的依赖任务 |

### 评论

| 工具 | 说明 |
|------|------|
| `list_comments` | 获取任务评论列表（支持分页） |
| `create_comment` | 添加评论 |
| `delete_comment` | 删除评论 |

### Agent 管理

| 工具 | 说明 |
|------|------|
| `register_agent` | 注册/更新 Agent 档案（id, name, type, endpoint?, capabilities?） |
| `list_agents` | 列出所有 Agent |
| `get_agent_rules` | 获取指定 Agent 的行为规则（Agent 启动时主动调用） |

### Handoff

| 工具 | 说明 |
|------|------|
| `get_agent_briefing` | 获取任务简报（含上下文、阻塞项、事件、评论、操作指引） |
| `get_handoff_queue` | 获取 Manual Agent 待办队列 |

### 事件

| 工具 | 说明 |
|------|------|
| `get_events` | 查询事件日志（projectId?, taskId?, limit?） |

### MCP 配置

`bun run release` 执行后会打印标准 MCP JSON 配置片段，适用于所有支持 MCP stdio server 的产品：

**Claude Desktop**：粘贴到 `~/Library/Application Support/Claude/claude_desktop_config.json`

**Google Antigravity**：粘贴到 `~/.gemini/antigravity/mcp_config.json`

**TRAE SOLO / 其他产品**：参考各产品的 MCP 配置文档

配置格式示例：
```json
{
  "mcpServers": {
    "nerve-hub": {
      "command": "/path/to/nerve-hub-binary",
      "args": ["mcp"]
    }
  }
}
```

> `bun run release` 会输出包含正确绝对路径的完整配置，无需手动填写路径。

---

## API 路由速查

Base URL: `http://localhost:3141`，所有请求和响应均为 JSON。

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |

### 项目

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/projects` | 创建项目 |
| GET | `/projects` | 列出项目 |
| GET | `/projects/:id` | 获取项目 |
| PATCH | `/projects/:id` | 更新项目（name?, description?, rules?） |
| DELETE | `/projects/:id` | 删除项目 |
| GET | `/projects/:id/context` | 项目上下文 |
| GET | `/projects/:id/blocked-statuses` | 批量阻塞状态 |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/tasks` | 创建任务 |
| GET | `/tasks` | 列出任务（?status=&priority=&type=&assignee=&search=） |
| GET | `/tasks/:id` | 获取任务 |
| GET | `/tasks/:id/context` | 任务上下文 |
| GET | `/tasks/:id/blocked-by` | 获取阻塞依赖 |
| PATCH | `/tasks/:id` | 更新任务 |
| DELETE | `/tasks/:id` | 删除任务 |
| GET | `/tasks/:id/briefing` | 获取任务简报 |

### 评论

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/tasks/:id/comments` | 获取评论列表 |
| POST | `/tasks/:id/comments` | 创建评论 |
| DELETE | `/comments/:id` | 删除评论 |

### Agent

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/agents` | 列出所有 Agent |
| POST | `/agents` | 注册/更新 Agent（upsert by id） |
| GET | `/agents/:id` | 获取 Agent |
| DELETE | `/agents/:id` | 删除 Agent |
| PATCH | `/agents/:id/status` | 更新 Agent 状态 |
| GET | `/agents/:id/rules` | 获取 Agent 行为规则（纯文本） |
| PATCH | `/agents/:id/rules` | 更新 Agent 行为规则 |

### Handoff

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/handoff` | 获取 Handoff Queue |

### Webhook

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/webhooks/callback` | 任务结果回调 |
| POST | `/webhooks/heartbeat` | Agent 心跳 |

### 事件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/events` | 事件日志（?projectId=&taskId=&limit=） |

### WebSocket

| 路径 | 说明 |
|------|------|
| WS `/ws` | 实时推送（task.*, project.*, agent.* 事件） |

---

## 数据模型

### Task

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | UUID |
| `title` | string | 任务标题 |
| `description` | string | 任务描述 |
| `status` | pending / running / done / failed / blocked | 任务状态 |
| `priority` | critical / high / medium / low | 优先级 |
| `type` | code / review / test / deploy / research / custom | 类型 |
| `assignee` | string | 负责人（Agent ID） |
| `dependencies` | string[] | 依赖任务 ID 列表 |
| `result` | string | 任务成果 |
| `creator` | string | 创建方 Agent ID（只读，创建后不可修改） |
| `projectId` | string | 所属项目 |
| `createdAt` | string | 创建时间 |
| `updatedAt` | string | 更新时间 |

### Agent

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | Agent 唯一标识（同 assignee） |
| `name` | string | 显示名称 |
| `type` | webhook / manual | Agent 类型 |
| `endpoint` | string | Webhook URL（webhook 类型） |
| `heartbeatInterval` | number | 心跳间隔秒数（默认 60） |
| `lastSeen` | string | 最后心跳时间 |
| `status` | online / offline / busy | 当前状态 |
| `capabilities` | object | Agent 能力描述（taskTypes, languages, priorities, description） |
| `rules` | string | Agent 行为规则（Markdown，通过 `get_agent_rules` 读取） |
| `metadata` | string | 扩展字段（JSON） |
| `createdAt` | string | 创建时间 |

### 状态流转

```
pending → running → done
                → failed
pending → blocked → running
任意状态 → pending（重置）
```

---

## 项目结构

```
nerve-hub/
├── src/
│   ├── main.ts         # 入口（start / mcp 两种模式）
│   ├── db.ts           # bun:sqlite 存储层（TaskDB）
│   ├── api.ts          # Bun.serve() REST API
│   ├── mcp.ts          # MCP stdio server
│   ├── runner.ts       # 任务调度 + Webhook 派发
│   ├── inbox.ts        # 文件收件箱（.nerve/inbox/ 自动回填）
│   ├── test.ts         # 核心功能测试
│   ├── test-agents.ts  # Agent 注册测试
│   └── test-webhooks.ts # Webhook 回调测试
├── web/
│   ├── src/
│   │   ├── main.tsx       # 前端入口 + 路由
│   │   ├── api.ts         # API 客户端
│   │   ├── types.ts       # TypeScript 类型
│   │   ├── components/    # UI 组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── pages/         # 页面组件
│   │   │   ├── ProjectList.tsx
│   │   │   ├── Kanban.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── EventLog.tsx
│   │   │   ├── Agents.tsx
│   │   │   └── HandoffQueue.tsx
│   │   └── lib/           # 工具库
│   └── vite.config.ts
├── package.json
└── tsconfig.json
```

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Bun |
| HTTP | Bun.serve()（零依赖） |
| 数据库 | bun:sqlite（Bun 内置） |
| 数据校验 | Zod（MCP schema） |
| MCP SDK | @modelcontextprotocol/sdk |
| 前端 | React + TypeScript + Vite |
| 样式 | TailwindCSS v4 + shadcn/ui 风格 |
| 图标 | lucide-react |
| 测试 | bun:test |

---

## 开发

### 两种运行模式

nerve-hub 有两个身份，建议物理分离，避免"边开发边用"的心智负担：

| 身份 | 启动方式 | 说明 |
|------|---------|------|
| **MCP 生产二进制** | `~/.nerve-hub/nerve-hub mcp` | 编译产物，Claude Desktop 配置指向这里，与源码无关 |
| **开发服务器** | `NERVE_DB_PATH=~/.nerve/hub.db bun run dev` | 从源码启动，Web UI + API + Runner |

两者通过 `NERVE_DB_PATH` 指向同一个数据库文件，数据共享、互不干扰。

### Release 流程

```bash
bun run release
# 等价于：bash scripts/release.sh
```

脚本依次执行：
1. 运行全部测试（任一失败立即中止）
2. 构建前端（`web/dist/`）
3. 编译 MCP 二进制到 `~/.nerve-hub/nerve-hub`

完成后输出 Claude Desktop 配置片段，粘贴到 `~/Library/Application Support/Claude/claude_desktop_config.json` 即可。

> 只有在你确认功能稳定、想"发布"新版本时才需要 `bun run release`。
> 日常开发直接 `bun run dev`，不影响 Claude 正在使用的已编译版本。

### 初始安装（跨架构隔离）

本项目在 amd64 和 arm64 之间共享目录。**不要直接用 `bun install`**，改用：

```bash
bun run setup
```

脚本会把 `node_modules` 指向 `node_modules.<当前 arch>/`，保证两个架构的产物互不覆盖。
每次切换开发者（或 `bun.lock` 更新后）重跑一次即可，已有 arch 的只是改符号链接，秒完成。

### 测试

```bash
bun test
```

### 数据库迁移

自动在启动时执行（`src/db.ts` migration 机制，当前版本 v12）。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NERVE_DB_PATH` | SQLite 数据库绝对路径，用于共享 DB | `<项目根>/.nerve/hub.db` |
| `NERVE_INBOX_PATH` | 文件收件箱目录，Agent 写 `.done.json` 文件触发自动回填 | `<DB 同级目录>/inbox/` |
| `NERVE_PUBLIC_URL` | 对外可访问的 URL，用于 Webhook callback/heartbeat | `http://localhost:3141` |
| `PORT` | API 监听端口 | `3141` |

---

## License

MIT
