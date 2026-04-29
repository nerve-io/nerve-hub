# AGENTS.md

> **受众**：所有参与本项目的 Agent
> 本文件是规则入口指针，规则本体存储在 nerve-hub 中。
> 历史版本：`.agent/archive/AGENTS_v1_20260425.md`

---

## 启动任何任务的前三步（硬性要求，不得跳过）

```
0. whoami（可选）
   → 确认当前 Agent 身份（agentId + name + authMethod）

1. get_my_rules()
   → 获取你自己的专属行为规则（零参数，自动识别身份）
   → 需要 MCP 配置中已设置 NERVE_HUB_AGENT_NAME

2. get_project_rules(projectId: "<项目ID>")
   → 读取项目级规则（技术栈、依赖安装、目录约定等）

3. 如涉及 WebUI，额外读取本地文件：
   .agent/rules/10-webui-selftest.md
   → WebUI 自测规程详细检查清单
```

未完成以上步骤，不得开工。

> **首次接入须知**：新 Agent 需要先通过 `register_agent` 注册身份。身份验证优先级：`NERVE_HUB_TOKEN`（推荐，token 优先）→ `NERVE_HUB_AGENT_NAME`（fallback，按 agent name 匹配）。`create_task` 的默认 creator 自动使用当前 agent 的 name。推荐使用 `bun run agent-setup` 向导完成配置。

---

## 本地参考文件

| 文件 | 用途 |
|------|------|
| `.agent/rules/00-workflow.md` | 任务 6 步生命周期（详细版） |
| `.agent/rules/10-webui-selftest.md` | WebUI 自测规程（步骤 + 证据要求） |
| `.agent/templates/SELFTEST.md` | 自测报告模板 |
| `.agent/reports/` | 历史自测报告 |
| `.agent/archive/` | 归档文件 |

> 本地文件是 nerve-hub 规则的补充说明，两者冲突时以 nerve-hub 中的规则为准（更新优先）。

---

## 参与本项目的 Agent

| Agent ID | 产品线 | 角色 |
|----------|--------|------|
| `claude-desktop` | Claude / Desktop (Cowork) | 需求拆解、任务派发、交付验收 |
| `claude-code` | Claude / Code (CLI) | 脚手架、批量重构、自动化脚本 |
| `claude-web` | Claude / Web | 研究、文档撰写 |
| `trae-solo` | TRAE / SOLO | 自主实施、自测并交付 |
| `trae-ide` | TRAE / IDE | 交互式编码辅助 |
| `google-antigravity` | Google / Antigravity | 研究、文档、跨平台协作 |

每个 Agent 通过 `get_my_rules()` 获取自己的专属规则（零参数，自动识别）。也可以调用 `get_agent_rules(agentId)` 读取其他 Agent 的规则。

---

## 任务回填 SOP

完成工作后调用 MCP 工具（首选）：
```
complete_task(id: "<任务ID>", result: "一句话描述结果")
```

MCP 不可用时写入文件（备选）：
```
.nerve/inbox/<taskId>.done.json
→ { "taskId": "<ID>", "result": "..." }
```

---

## 产品洞见提交

有想法可追加到 `SPARK-INBOX.md` 的"待 Review"区块：
```
- [<Agent ID>] [YYYY-MM-DD] 一句话描述想法
```
