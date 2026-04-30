数据基准：2026-04-30

## Agent 框架对比

| 产品 | 类型 | 通信协议 | nerve-hub 接入路径 | 推荐度 |
|------|------|---------|-------------------|--------|
| Claude Code | CLI Agent | CLI -p, MCP, Hooks | ✅ daemon.ts 已接入 | 🔴 主力 |
| Hermes Agent ⚠️行动前验证 | Agent OS | Webhook, API, MCP C/S | Webhook→Agent→API 回写 | 🔴 P0 |
| Codex CLI ⚠️行动前验证 | CLI Agent | CLI exec, FuncCall | CLI 管道 | 🟠 P1 |
| Cursor Automations ⚠️行动前验证 | Cloud Agent | Webhook, API, Cron | Webhook→VM→PR | 🟠 P1 |
| OpenHands ⚠️行动前验证 | 自治框架 | SDK, REST, MCP | Custom Action | 🟢 互补 |
| TRAE SOLO CLI ⚠️行动前验证 | CLI Agent | CLI, ACP, MCP | CLI 管道 | 🟢 P2 |
| Devin ⚠️行动前验证 | 云 Agent | REST API, Slack | API 下发 | 🟡 P2 |
| Copilot Workspace | Cloud Agent | Issue→PR | GitHub Issue 间接 | 🟢 间接 |

## 关键简评

**Hermes Agent**（~66K Stars ⚠️行动前验证）：自进化闭环（GEPA, ICLR 2026 Oral）+ webhook adapter + API server + MCP + plugin + 17 通道。⚠️ 自进化可能静默引入错误。

**Claude Code**（81.6K Stars ⚠️行动前验证）：SWE-bench 80.9%。保持主力但不要单点依赖。⚠️ 源码泄露(2026-03-31)，thinking depth 下降。

**Cursor Automations**（1M+ DAU ⚠️行动前验证）：webhook 触发 + Cloud VM 8 并行 + MCP 业界最优。⚠️ v2.4-v2.6 活跃回退 bug。

**OpenHands**（72K Stars ⚠️行动前验证）：MIT 开源，模型无关。定性：框架层编码工具，与 nerve-hub 产品层正交。

**OpenClaw**（320K+ Stars ⚠️行动前验证）：22 通道 IM + webhook + MCP(MCPorter) + ACP。⚠️ CVE-2026-25253 CVSS 8.8，安全风险严重。

## 数据新鲜度风险
- Stars/DAU：月级别过期风险 ⚠️行动前验证
- 产品功能：Hermes Agent 42 天 9 大版本，功能周级别变化
- 产品可用性：OpenClaw 创始人加入 OpenAI，治理方向不确定
