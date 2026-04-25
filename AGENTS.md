# AGENTS.md

> **受众**：TRAE SOLO（本项目主力实施方）
> 本文件是规则入口指针，规则本体存储在 nerve-hub 中。
> 历史版本：`.agent/archive/AGENTS_v1_20260425.md`

---

## 启动任何任务的前三步（硬性要求，不得跳过）

```
1. get_project_rules
   → 读取项目级规则（技术栈、依赖安装、目录约定等）

2. get_agent_rules(agentId: "trae-solo")
   → 读取你自己的行为规则（交付标准、编码规范、禁止行为等）

3. 如涉及 WebUI，额外读取本地文件：
   .agent/rules/10-webui-selftest.md
   → WebUI 自测规程详细检查清单
```

未完成以上步骤，不得开工。

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
| `trae-solo` | TRAE / SOLO | **主力实施方**，自测并交付 |
| `trae-ide` | TRAE / IDE | 交互式编码辅助 |

每个 Agent 可通过 `get_agent_rules(agentId: "<id>")` 读取专属规则。

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
- [TRAE SOLO] [YYYY-MM-DD] 一句话描述想法
```
