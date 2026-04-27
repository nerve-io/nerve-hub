## SPARK-008 · 协议无关的调度层 + A2A 借鉴

**日期**：2026-04-24
**来源**：调研 MCP 之外的 Agent 互通协议（A2A、ACP、ANP、AG-UI）

**协议全景**：
- MCP：Agent ↔ 工具（纵向，Agent 向下调用工具/资源）
- A2A：Agent ↔ Agent（横向，Agent 平级委托任务）——Google 主导，50+ 合作伙伴
- ACP：已于 2025-08 合并进 A2A（Linux Foundation）
- ANP：去中心化 Agent 发现与协作（基于 DID，面向开放网络 Agent 市场）
- AG-UI：Agent 与前端界面交互标准

MCP 和 A2A 互补不竞争：MCP 解决"Agent 用什么工具"，A2A 解决"Agent 找谁干活"。

**核心洞见**：
nerve-hub 已经在做 A2A 在做的事——Briefing 派发 + complete_task 回填 = A2A 的任务委托模型。
区别是 nerve-hub 没有用标准化格式声明它。

**可借鉴的具体点**：

1. **Agent Card → Agent Profile 扩展**
   A2A 里每个 Agent 发布结构化能力声明（能做什么任务类型、接受什么格式）。
   nerve-hub 的 Agent 注册可扩展为 capability schema，支持调度时智能匹配：
   "这个 code 任务，派给声明了 code 能力的 Agent"。

2. **A2A 作为新 Agent 接入类型**
   现有类型：webhook / manual / cli(TODO)
   未来加入：a2a —— 对支持 A2A 的 Agent 直接机器派发，零人工中转。
   一旦 TRAE 或其他工具实现 A2A，Manual 类型可无缝升级为 a2a 类型。

3. **ANP 与 RuleStore 的远期呼应**
   ANP 做去中心化 Agent 发现，RuleStore（SPARK-003）做规则发现。
   未来两者可以合流：不只是规则可以被发现，Agent 本身也可以按需发现和接入。

**战略定位**：
nerve-hub 是**协议无关的调度层**——上面挂什么协议的 Agent 都能跑。
当前 Agent type 体系按"接入机制"分类，未来演进为按"协议"分类：
A2A / Webhook / MCP-native / Manual 并列，随协议生态成熟自然扩展，无需重构核心。

**近期不需要实现，但架构上要留位置。**

---
