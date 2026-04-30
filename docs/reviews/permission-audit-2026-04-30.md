# nerve-hub 权限系统自查报告

**日期**: 2026-04-30 | **自查人**: claude-code

---

## 1. 现有权限检查覆盖面

### API 端点权限矩阵

| 端点 | 认证 | permissionLevel | visibilityScope |
|------|------|----------------|-----------------|
| POST /import | ✅ | admin | — |
| POST /backup | ✅ | admin | — |
| PATCH /projects/:id (rules) | ✅ | admin | — |
| PATCH /agents/:id/rules | ✅ | admin | — |
| PATCH /agents/:id (perm) | ✅ | admin | — |
| POST /agents/:id/credentials | localhost/op | — | — |
| POST /tasks | **NO** | — | — |
| DELETE /tasks/:id | **NO** | — | — |
| POST /projects | **NO** | — | — |
| DELETE /projects/:id | **NO** | — | — |
| POST /tasks/:id/comments | **NO** | — | — |
| DELETE /comments/:id | **NO** | — | — |
| GET /events | **NO** | — | — |
| GET /tasks/:id/context | **NO** | — | — |
| POST /agents | **NO** | — | — |
| DELETE /agents/:id | **NO** | — | — |
| PATCH /agents/:id/status | **NO** | — | — |
| GET /tasks | 可选 | — | ✅ own |
| GET /tasks/:id | 可选 | — | ✅ own |
| PATCH /tasks/:id | 可选 | task-any* | — |
| GET /me | ✅ | — | — |

> *仅当修改他人任务时要求 task-any。完整映射见 MCP 工具同样有类似分布。

### MCP 工具权限矩阵

| 有权限检查 | admin: issue/revoke/list credential, update_agent_permissions, import_data, backup |
|          | task-any: complete_task, update_task (仅修改他人任务时) |
|          | task-self: claim_task |
|          | visibilityScope: get_task, list_tasks, search_tasks, get_agent_briefing, get_task_context, list_comments, get_events(partial), list_agents, get_agent_rules |
| 无权限检查 | create_task, delete_task, create_project, create_comment, delete_comment, get_blocked_by, **get_events(project-scoped)** |

### 关键发现

- **`readonly` 权限等级已定义但从未被检查** — 任何认证 Agent 都可执行写操作
- **删除操作无权限门控** — delete_task, delete_comment, delete_agent 均无需特殊权限
- **API 和 MCP 层不一致** — API 有 7 个端点无认证即可访问，MCP 至少要求有效 token

---

## 2. Project 隔离的当前状态

### 结论：**当前不存在任何项目级别的隔离。**

证据：
- `agents` 表的 `permissionLevel` 和 `visibilityScope` 是全局字段，不区分项目
- `agent_credentials` 表无 project scope 字段
- 没有 agent_projects 关联表
- `checkTaskAccess` 和 `listTasksWithScope` 仅按 assignee 过滤，不按 project 过滤

### 跨项目越权路径（具体举例）

**路径 1**：`task-any` Agent A 创建在项目 X 中，可调用 `update_task` 修改项目 Y 中的任意任务。
- src/mcp.ts line 301-306: `update_task` 仅检查 task-any（修改他人任务时），不验证 project

**路径 2**：任意认证 Agent 可调用 `create_comment` 在项目 Y 的任务中添加评论，即使该 Agent 不应访问该项目。
- src/mcp.ts: `create_comment` 无任何权限检查

**路径 3**：`get_events` 传入 projectId 时，不检查调用方的 visibilityScope 或 project 访问权。
- src/mcp.ts lines 412-421: 仅在 task-scoped 时调用 `checkTaskAccess`

---

## 3. Credential 机制现状

### agent_credentials 表结构（migration v13）

| 字段 | 类型 | 用途 |
|------|------|------|
| id | TEXT PK | 内部 ID |
| agent_id | TEXT FK | 关联 agents 表 |
| key_id | TEXT UNIQUE | 公钥标识（kid） |
| token_hash | TEXT UNIQUE | SHA-256 哈希 |
| status | TEXT | active/revoked |
| issued_at | TEXT | 签发时间 |
| expires_at | TEXT | 过期时间（可选） |
| revoked_at | TEXT | 吊销时间（可选） |
| last_used_at | TEXT | 最后使用时间 |
| created_by | TEXT | 签发人 |

**无 project scope 字段，无扩展列预留。** 但 TEXT 类型的 status 列可通过 JSON 扩展（如 `active:projectA,projectB`），或新增 TEXT 列 `project_scope` 存 JSON 数组。

---

## 4. 差距分析与方案对比

### 需要修改的层面

```
DB Schema 层 → API 中间件层 → MCP 工具层 → 端点逐一门控
```

| 层面 | 当前状态 | 需要补充 |
|------|---------|---------|
| DB Schema | agents/tasks/credentials 均无 project 隔离字段 | 新增 project_scope 列 |
| API 中间件 | authenticateRequest 仅解析 agentId | 附加 project scope 到 AuthContext |
| MCP 工具 | 各工具独立调用 resolveAgentIdentity | 统一 project scope 注入 |
| 端点门控 | 7+ API 端点 + 5+ MCP 工具无检查 | 逐端添加 project 访问验证 |

### 方案 A vs 方案 B

| 维度 | 方案A: agents 加 allowedProjects | 方案B: credentials 加 project_scope |
|------|--------------------------------|-------------------------------------|
| **粒度** | 粗 — 同一 Agent 的所有 token 共享 project 范围 | 细 — 不同 credential 可有不同 project scope |
| **最小权限** | 弱 — 需创建多个 Agent 身份来实现不同 project 访问 | 强 — 签发 credential 时指定 scope |
| **DB 迁移** | `ALTER TABLE agents ADD allowed_projects TEXT DEFAULT '["*"]'` | `ALTER TABLE agent_credentials ADD project_scope TEXT DEFAULT '["*"]'` |
| **auth 影响** | 改 `authenticateRequest` 读取 agent 行 | 改 `authenticateRequest` 读取 credential 行（已读） |
| **长期适合** | 低 — 新增 Agent 比新增 Credential 重 | **高 — credential 是天然授权边界** |
| **改动成本** | 略低（1 表 + middleware） | 中（1 表 + credential 创建流 + middleware） |

### 推荐：方案 B（credential project_scope）

理由：
1. credential 已是认证边界（token → agent），加上 scope 是自然扩展
2. 同一 Agent 可持有不同 scope 的 credential，灵活支持"claude-code 在项目 A 是 admin，在项目 B 是 readonly"
3. `authenticateRequest` 已读取 credential 行，加 scope 读取零额外查询
4. 与 JWT/OAuth 的 scope 概念一致，认知成本低

### 修复路线图

**Phase 1**（1-2天）：Schema + Auth 层
- migration: `ALTER TABLE agent_credentials ADD project_scope TEXT NOT NULL DEFAULT '["*"]'`
- `authenticateRequest` → 附加 projectScope
- `resolveAgentIdentity` → 附加 projectScope

**Phase 2**（2-3天）：DB 层
- `checkProjectAccess(agentId, projectId)` 方法
- `list()` / `create()` / `update()` / `delete()` 注入 project filter

**Phase 3**（2-3天）：端点门控
- 逐端添加 project access check（优先 mutating 端点）
- `readonly` 等级落地

**Phase 4**（1-2天）：管理工具
- `issue_agent_credential` 支持 project_scope 参数
- `list_agent_credentials` 显示 scope
