数据基准：2026-04-30

## 工具集成层总览

| 产品 | 集成方式 | 与 nerve-hub 协同价值 | 优先级 |
|------|---------|---------------------|--------|
| OpenClaw ⚠️行动前验证 | Webhook + MCP(MCPorter) + ACP | 通知层：结果推送至 IM 通道 | P1 |
| Hermes Plugin ⚠️行动前验证 | Plugin 系统 v0.11.0 | 执行层：nerve-hub webhook handler 插件 | P0 |
| MCP 生态 | STDIO/SSE/Streamable HTTP | 工具层：QA pipeline、代码质量、搜索 | P1 |
| Google Interactions API ⚠️行动前验证 | REST + background 模式 | 后台执行层：长任务异步运行 | P2 |
| SonarQube MCP | MCP 直连 | QA 工具链：代码质量门禁 | P1 |
| Cua Driver ⚠️行动前验证 | MCP + CLI + SDK | GUI 层：无 API 产品的桌面操控 | P1 |
| Browser-Use ⚠️行动前验证 | Python API | Web 自动化备选 | P2 |

## 关键发现

### OpenClaw（320K+ Stars ⚠️行动前验证, GitHub #1）
全平台最完整消息通道（22 通道）。ClawHub 5700-13700 skills，150M+ 下载 ⚠️行动前验证。**接入价值**：nerve-hub 完成通知 → OpenClaw 推送至 Neil 的 WhatsApp/Telegram。

**⚠️ 严重风险**：CVE-2026-25253 CVSS 8.8（93.4% 实例认证绕过），12-20% ClawHub skills 含恶意代码，Kaspersky 发现 512 漏洞。不建议授予敏感系统权限。

### Hermes Agent 通信栈
Generic Webhook adapter + OpenAI 兼容 `/v1/chat/completions` + MCP Client/Server + Plugin。8 worker 并发工具执行。接入路径最丰富。

### MCP 生态（2026年趋势）
MCP 正成为 Agent 工具层事实标准。Cursor 实现业界最优（全协议+全能力+auto-install）。Anthropic 控制协议定义，但实现层百花齐放。

### Google Antigravity Bridge ⚠️
本地 REST API(port 5000) + WebSocket(port 9812)。Antigravity 仍在 preview，API 可能变动。⚠️ 曾发生 `rmdir /s /q d:\` 事件。

## 数据新鲜度风险
- MCP 生态规模：周级别变化 ⚠️行动前验证
- OpenClaw 安全态势：CVE 每月新增，本报告数据截至 2026-04
- Google Antigravity：preview 阶段，功能和 API 不稳定 ⚠️行动前验证
- 所有 API 端点/端口号：实施前需做连接验证 ⚠️行动前验证
