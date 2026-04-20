<p align="center">
  <strong>Nerve Hub</strong>
</p>

<p align="center">
  AI Agent 状态总线 — 多智能体协作的神经系统
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> · <a href="#核心概念">核心概念</a> · <a href="#使用场景">使用场景</a> · <a href="#rest-api">REST API</a> · <a href="#skill">Skill</a> · <a href="#开发">开发</a>
</p>

---

## 这是什么

Nerve Hub 是一个轻量级的 **AI Agent 任务协作中心**。

你可以把它理解为「给 AI Agent 用的看板工具」——在一个地方创建任务、分配给不同的 AI（Claude、Cursor、GPT 等），然后追踪它们的执行状态和产出。

**核心能力：**
- 📋 **看板管理** — 创建项目、拆分任务、拖拽切换状态
- 🤖 **跨平台协作** — 通过 REST API / MCP / Skill 连接任意 AI Agent
- 📝 **状态追踪** — 自动记录每次状态变更（谁、什么时候、改了什么）
- 🌐 **Web 界面** — 内置 React 看板，开箱即用
- 🔌 **MCP 集成** — 可作为 Claude Desktop 的 MCP Server

## 快速开始

### 1. 安装

```bash
git clone git@github.com:nerve-io/nerve-hub.git
cd nerve-hub
pnpm install
pnpm build
```

### 2. 启动

```bash
# 启动后端 + Web UI（默认端口 3141）
pnpm start

# 浏览器打开
open http://localhost:3141
```

### 3. 开发模式

```bash
# 终端 1：启动后端（热重载）
pnpm dev

# 终端 2：启动前端（热重载，自动代理 API 到 3141）
cd web && npm install && npm run dev
# 前端地址：http://localhost:5173
```

## 核心概念

| 概念 | 说明 | 类比 |
|------|------|------|
| **Project（项目）** | 一个独立的工作空间 | Jira 项目 / Trello 看板 |
| **Task（任务）** | 一个具体要做的事 | Jira 工单 / Trello 卡片 |
| **Status（状态）** | 任务当前进展 | 待办 → 进行中 → 完成 |
| **Priority（优先级）** | 紧急程度 | P0 紧急 / P1 高 / P2 中 / P3 低 |
| **Assignee（负责人）** | 谁来做这个任务 | Claude / Cursor / 张三 |
| **Type（类型）** | 任务种类 | 写代码 / 测试 / 部署 / 调研 |
| **Event（事件）** | 操作日志 | 谁在什么时候做了什么 |
| **StateLog（状态日志）** | 字段级变更记录 | status 从 pending 变为 running |

### 任务状态流转

```
pending（待处理）
  ↓
running（进行中）
  ↓
  ├── done（已完成）
  ├── blocked（已阻塞）→ running
  ├── waiting（等待中）→ running
  └── failed（已失败）

任意状态 → archived（已归档）
```

### 任务类型

| 值 | 含义 |
|---|---|
| `code` | 💻 写代码 |
| `review` | 🔍 代码审查 |
| `test` | 🧪 写测试 |
| `deploy` | 🚀 部署上线 |
| `research` | 📚 调研分析 |
| `custom` | 📋 其他 |

## 使用场景

### 场景：多 AI Agent 协作开发

一个典型的跨平台协作流程：

```
1. Claude Code 分析需求，将大任务拆分为多个子任务，上传到 Hub
2. 你在 Web 看板上查看任务列表
3. 在 Cursor 中打开新会话，认领一个任务
4. Cursor 读取任务上下文，执行开发
5. Cursor 完成后，将 git 仓库地址作为成果上传到 Hub
6. 你在 Web 看板上看到任务已完成
```

### 场景：Claude Desktop MCP 集成

```json
{
  "mcpServers": {
    "nerve-hub": {
      "command": "node",
      "args": ["/path/to/nerve-hub/dist/cli/index.js", "mcp"]
    }
  }
}
```

Claude Desktop 可以直接通过 MCP 工具创建和更新任务。

### 场景：通过 Skill 跨平台使用

将 `skills/nerve-hub/` 目录复制到你的项目的 `.claude/skills/` 下，任何支持 Skill 的 AI 平台都可以通过 bash 脚本操作 Hub。

详见 [skills/nerve-hub/SKILL.md](skills/nerve-hub/SKILL.md)。

## REST API

Base URL: `http://localhost:3141/api/v1`

所有请求和响应均为 JSON。通过 `X-Nerve-Agent` header 标识调用者身份。

### 项目

```bash
# 创建项目
curl -X POST http://localhost:3141/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "重构用户系统", "description": "将认证模块从 session 迁移到 JWT"}'

# 列出所有项目
curl http://localhost:3141/api/v1/projects

# 获取项目看板（任务按状态分组）
curl http://localhost:3141/api/v1/projects/{id}/board

# 获取项目上下文（项目信息 + 任务汇总）
curl http://localhost:3141/api/v1/projects/{id}/context

# 获取项目事件日志
curl http://localhost:3141/api/v1/projects/{id}/events?limit=50
```

### 任务

```bash
# 创建任务
curl -X POST http://localhost:3141/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-Nerve-Agent: claude" \
  -d '{
    "projectId": "{project-id}",
    "title": "实现 JWT 签发接口",
    "description": "使用 RS256 算法，支持 refresh token 轮换",
    "type": "code",
    "priority": "high",
    "assignee": "claude",
    "tags": ["后端", "认证"],
    "dependencies": ["{另一个任务ID}"]
  }'

# 查询任务（支持过滤）
curl "http://localhost:3141/api/v1/tasks?projectId={id}&status=running&assignee=claude"

# 获取单个任务
curl http://localhost:3141/api/v1/tasks/{id}

# 更新任务
curl -X PATCH http://localhost:3141/api/v1/tasks/{id} \
  -H "Content-Type: application/json" \
  -H "X-Nerve-Agent: claude" \
  -d '{
    "status": "done",
    "progress": 100,
    "result": {
      "type": "git",
      "path": "https://github.com/org/repo/pull/123",
      "summary": "实现了 JWT 签发和验证，包含单元测试"
    }
  }'

# 删除任务
curl -X DELETE http://localhost:3141/api/v1/tasks/{id}

# 获取任务变更历史
curl http://localhost:3141/api/v1/tasks/{id}/logs
```

### 健康检查

```bash
curl http://localhost:3141/health
# {"status":"ok","service":"nerve-hub","version":"0.1.0"}
```

## MCP 工具

| 工具 | 说明 |
|------|------|
| `create_project` | 创建项目 |
| `create_task` | 创建任务（支持依赖关系、标签等） |
| `update_task` | 更新任务（状态、进度、成果、错误信息等） |
| `query_tasks` | 按条件查询任务（projectId、status、assignee、type） |
| `get_task` | 获取单个任务详情 |
| `get_project_context` | 获取项目上下文（项目信息 + 任务汇总 + 最近任务） |
| `list_projects` | 列出所有项目 |
| `delete_task` | 删除任务 |

## Skill

`skills/nerve-hub/` 目录包含一个 Claude Code 兼容的 Skill，让任何支持 Skill 的 AI 平台都能通过 bash 脚本操作 Hub。

### 安装

将 `skills/nerve-hub/` 复制到你的项目的 `.claude/skills/` 下：

```bash
cp -r skills/nerve-hub/ /your/project/.claude/skills/nerve-hub/
```

### 可用命令

```bash
# 查看项目列表
bash nerve.sh list-projects

# 创建项目
bash nerve.sh create-project "项目名称" "项目描述"

# 查看项目任务
bash nerve.sh list-tasks <projectId>

# 创建任务
bash nerve.sh create-task <projectId> "任务标题" \
  --description "详细描述" \
  --type code \
  --priority high \
  --assignee "claude" \
  --tags "前端,API"

# 认领任务
bash nerve.sh claim-task <taskId> "你的名字"

# 更新任务状态
bash nerve.sh update-task <taskId> --status done --progress 100

# 提交成果（git 仓库地址等）
bash nerve.sh submit-result <taskId> \
  --result-type git \
  --path "https://github.com/org/repo" \
  --summary "实现了用户登录模块"

# 记录失败
bash nerve.sh fail-task <taskId> "依赖的 API 尚未就绪"

# 获取任务上下文（用于注入到新会话）
bash nerve.sh task-context <taskId>
```

## Web 界面

内置 React SPA，启动后端后访问 `http://localhost:3141` 即可。

### 页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 仪表盘 | `/` | 总览统计、项目列表、最近任务 |
| 项目管理 | `/projects` | 创建和浏览项目 |
| 看板 | `/projects/:id/board` | 拖拽式任务看板（7 列状态） |
| 任务详情 | `/tasks/:id` | 任务信息、进度、状态变更历史 |
| 事件日志 | `/events` | 项目操作日志流 |
| 任务拓扑 | `/topology` | 任务依赖关系树 |

## 项目结构

```
nerve-hub/
├── src/                    # 后端源码（TypeScript）
│   ├── core/               # 核心引擎（SQLite + Zod）
│   │   ├── engine.ts       # NerveCore 主类
│   │   ├── models.ts       # 数据模型定义
│   │   └── storage.ts      # SQLite 存储层
│   ├── api/                # Fastify HTTP 服务
│   │   ├── index.ts        # 应用入口 + 静态托管
│   │   └── routes/         # REST API 路由
│   ├── mcp/                # MCP Server
│   │   ├── tools.ts        # MCP 工具定义
│   │   └── resources.ts    # MCP 资源定义
│   └── cli/                # CLI 命令
│       ├── index.ts        # Commander 入口
│       └── commands/       # init / start / mcp
├── web/                    # 前端源码（React + Vite）
│   └── src/
│       ├── api/client.ts   # REST API 客户端
│       ├── pages/          # 页面组件
│       ├── components/     # 通用组件
│       ├── contexts/       # React Context
│       ├── styles/         # CSS 设计系统
│       └── types/          # TypeScript 类型
├── skills/                 # Claude Code Skill
│   └── nerve-hub/
│       ├── SKILL.md        # Skill 使用说明
│       ├── reference.md    # API 速查表
│       └── scripts/nerve.sh # CLI 封装脚本
├── tests/                  # 测试
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## 技术栈

| 层 | 技术 |
|---|---|
| 后端运行时 | Node.js + TypeScript |
| HTTP 框架 | Fastify 5 |
| 数据库 | SQLite（better-sqlite3） |
| 数据校验 | Zod |
| MCP SDK | @modelcontextprotocol/sdk |
| CLI | Commander |
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite |
| 拖拽 | @dnd-kit |
| 图标 | Lucide React |
| 后端构建 | tsup |
| 测试 | Vitest |

## 开发

```bash
# 后端开发（热重载）
pnpm dev

# 后端构建
pnpm build

# 运行测试
pnpm test

# 前端开发
cd web && npm install && npm run dev

# 前端构建
cd web && npm run build

# 一体化构建并启动
pnpm build && pnpm start
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NERVE_HUB_PORT` | `3141` | HTTP 服务端口 |
| `NERVE_HUB_DATA_DIR` | `./.nerve` | 数据存储目录 |
| `NERVE_HUB_URL` | `http://localhost:3141` | Skill 脚本使用的 Hub 地址 |

## License

MIT
