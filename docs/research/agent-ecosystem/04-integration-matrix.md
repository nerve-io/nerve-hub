数据基准：2026-04-30

## nerve-hub 接入评估矩阵

框架：**协议无关任务交接**（SPARK-007）。标准：能否接收任务、执行、回传结果？

| 产品 | 接收 | 执行 | 回传 | 接入路径 | 推荐度 |
|------|------|------|------|---------|--------|
| Claude Code | ✅ CLI/MCP | ✅ 80.9% SWE-bench | ✅ MCP/API | daemon.ts 已接入 | 🔴 主力 |
| Hermes Agent ⚠️行动前验证 | ✅ Webhook/API | ✅ 自进化+8worker | ✅ API/MCP | Webhook→执行→API 回写 | 🔴 P0 |
| Codex CLI ⚠️行动前验证 | ✅ CLI | ✅ 72.8% SWE-bench | ✅ CLI/API | CLI 管道 | 🟠 P1 |
| OpenClaw ⚠️行动前验证 | ✅ Webhook | ✅ Gateway+ACP | ✅ MCP/WS | Webhook→执行→MCP 回写 | 🟠 P1 |
| Cursor Automations ⚠️行动前验证 | ✅ Webhook/API | ✅ Cloud VM 8并行 | ✅ PR/API | Webhook→VM→PR | 🟠 P1 |
| OpenHands ⚠️行动前验证 | ✅ SDK/REST | ✅ Docker 沙箱 | ✅ PR/API | Custom Action | 🟢 互补 |
| Copilot WS | ⚠️ Issue触发 | ✅ 计划→执行 | ✅ PR | GitHub Issue 间接 | 🟢 间接 |
| TRAE SOLO ⚠️行动前验证 | ✅ CLI/ACP | ✅ Subagent并行 | ✅ CLI/MCP | CLI 管道 | 🟢 P2 |
| Devin ⚠️行动前验证 | ✅ REST/Slack | ✅ 云沙箱 | ✅ API/Slack | REST API 下发 | 🟡 P2 |
| Aider | ✅ CLI | ✅ 轻量编码 | ✅ CLI | CLI 管道 | 🟢 备选 |

全部产品均具备至少一种通信能力（HTTP/MCP/CLI），技术上均可接入。差异在接入成本和匹配程度。

## 旧报告纠正

| 旧结论 | 新结论 | 依据 |
|--------|--------|------|
| Hermes Agent 不接入 | ✅ P0 | Webhook+API+MCP 完整栈 |
| OpenClaw 不接入 | ✅ P1 | Webhook+MCP 双向通信 |
| Cursor 不接入 | ✅ P1 | Automations webhook 触发 |
| Devin 不接入 | ✅ P2 | REST API 任务交接 |
| TRAE SOLO 不接入 | ✅ P2 | CLI+ACP 已可用 |

旧报告以「被动唤醒」为门槛、「角色不同」拒绝 10 款产品——框架性错误。正确框架：协议无关任务交接。

## 数据新鲜度风险
- 接入路径：月级别（API 变更）⚠️行动前验证
- 产品可用性：OpenClaw 创始人加入 OpenAI ⚠️行动前验证
- 所有接入建议：实施前需 web search 验证产品当前状态
