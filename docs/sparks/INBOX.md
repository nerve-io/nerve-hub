# Spark Inbox — 原始灵感收件箱

> 任何 Agent、任何时候冒出的想法都先扔这里。格式轻量，无需完整。
> 定期与 Claude 一起 review，值得的升格到 docs/sparks/ 下的独立 spark-NNN.md 文件（经 INDEX.md 索引），其余丢弃或合并。
> 质量控制发生在升格这一步，不是在收集这一步。

## 提交格式

```
- [来源] [日期] 一句话描述想法
```

---

## 待 Review

- [cursor] [2026-04-29] R10：MoE 的负载均衡辅助损失（Switch 等）可映射为 nerve-hub 的「派发均衡 KPI」——webhook 排队时长、Agent 并发饱和度、失败重派次数；可作为 spark-019 自动路由前的显式度量面板，不等同于路由模型本身。

- [cursor] [2026-04-29] R11 小结：OpenRouter 榜单可作采纳度/路由风向的补充信号（非离线基准替代品）；Guardrails 仅能约束经 OR 的开销；GPT-4o 标价与直连列表价同档（例：$2.50/$10 per M），加权均价可能略低；全链路 Agent 成本账本仍以直连计量为主。

- [Neil] [2026-04-29] 廉价模型 × Prose 结构 = 低成本高质量 Agent——国产便宜 LLM/VLM（DeepSeek/Qwen 等）per-token 成本比 Claude 低一个数量级，但自由发挥时质量不稳定。Prose 轻量 contract（Requires/Ensures/Strategies）提供外部结构约束，补偿模型自我管控能力的不足——这与 Harness 工程原则一致：不靠模型自觉，靠结构强制。组合方案：openclaw 或 Hermes agent 作为 agent 软件层，接入廉价国产 API，安装 Prose skill，通过 nerve-hub inbox 协议接收任务。高 token 消耗（Prose 开销）× 极低 per-token 价格 = 总成本仍远低于 Claude，但质量可控。这解决了"秘书"问题的完整架构：成本问题（廉价 API）+ 质量问题（Prose 结构）+ 集成问题（inbox 协议）三者同时解决。关联 spark-019（能力路由）、spark-034（成本度量）、Prose EXP。

- [Neil] [2026-04-29] 任务路由的双维度决策：模型能力 × Agent 产品成熟度——国产 LLM（DeepSeek/Qwen 等）原始模型能力已很强，但配套软件生态薄弱（对比 Claude = 模型 + Claude Code + Cowork = 完整成熟 agentic 产品）。openclaw/hermes 等开源 agent 知名度高，实际业务场景体验远不如商业产品。因此路由任务时，"模型够不够用"之外还要评估"agent 产品稳不稳"——廉价模型能力足够，但若配套软件不成熟，执行质量反而更差。nerve-hub 的职责是协调层稳定性，不保证各 agent 内部稳定性。低成本任务路由的前提是找到"能力强且产品成熟"的廉价 agent 产品，当前这个交叉点尚待出现。关联 spark-019（能力路由）、spark-034（成本度量）、spark-033（借力策略）。

- [claude-desktop] [2026-04-29] Per-task Agent 成本归因——R11 确认 OpenRouter 只能管自己出口的费用，nerve-hub 需要自己建 per-task 成本层：记录每个任务用了哪个 Agent、推测使用的模型、大致 token 量（可从 result 字段长度估算或由 Agent 自报）。这是 spark-034（工作量从"人天"到"Agent 成本"）的基础数据，也是 0→1 商业化验证的必要依据。

- [claude-desktop] [2026-04-29] OpenRouter 多 provider 路由设计可参考 spark-019——OpenRouter 的核心能力是"同一模型多 provider 路由 + 自动 fallback + 加权均价"。若 nerve-hub 未来做 Agent 能力路由（spark-019）时扩展到 LLM 层（不同任务自动选不同模型），可参考其路由策略设计，而不必重新发明。

- [Neil] [2026-04-29] MoE 架构对多 Agent 协作的启示 → **升格为 SPARK-038**

- [Neil] [2026-04-29] 持续调研 LLM 底层架构论文，提炼 Agent 协作范式 → **任务 R10 已完成**（`8de46fae`）

- [Neil] [2026-04-29] OpenRouter 平台调研 → **任务 R11 已完成**（`21f3650f`）

- [Neil] [2026-04-29] React Ink 作为 TUI CLI 框架——Claude Code 用 React Ink 构建了 TUI CLI 界面，如果 nerve-hub 未来打造 CLI 工具（如 Agent 本地接入 CLI、任务管理 CLI），React Ink 是值得参考的技术路线。与 spark-010（CLI Agent 接入类型）相关。

- [Neil] [2026-04-29] 开源 CLI 产品（open-cli 等）作为打磨 nerve-hub CLI 的参考——现有成熟开源 CLI 产品在 UX 设计、命令结构、帮助文档等方面有大量可借鉴的实践，待 nerve-hub CLI 方向明确后系统参考。

- [Neil] [2026-04-29] 基于主动授权的 Agent 权限分级 → **升格为 SPARK-036**

- [cursor] [2026-04-29] Task 作为多 Agent 版 feature_list → **升格为 SPARK-037**

- [cursor] [2026-04-29] Agent 交付门禁的错误消息应面向自修复 → **已并入 `7c1978f8`（Strategies 字段），门禁已实现**

- [claude-desktop] [2026-04-29] Prose 进阶用法（Usage 2）：`prose run xxx.md` 将 Agent 作为 VM，自动按 service 边界拆分子 agent、并行执行、写运行轨迹到 `.prose/runs/`。适合 feature factory（多服务并行实现）、评审循环（reviewer service + implementor service 轮转）、大型平行调研（多个 research service 同时爬取不同领域）等场景。当前 nerve-hub 任务规模不需要此能力，但若未来任务数量、并行 Agent 数、调研复杂度显著上升，Prose VM 模式是天然的多 Agent 编排层，值得在 1-2 个 critical 任务上验证后决定是否固化进 agent.rules。token/时间开销约 1.5x-3x，仅在高价值任务上使用。

- [Neil] [2026-04-25] nerve-hub 的目标用户是谁？→ **已决策**：a→b→c 完整演进路线，当前阶段为 a（自用验证），目标 b（小团队付费），roadmap 已更新

---

## 已处理

- [Neil] [2026-04-25] 主流项目管理 SaaS 横评 → **调研任务 R5**（nerve-hub 任务 ID: 3fb64d0a）
- [Neil] [2026-04-25] AI Agent 全景研究报告（17款横评）→ **调研任务 R6**（nerve-hub 任务 ID: 68e77333）
- [Neil] [2026-04-25] 三款 Agent 产品体验横评 → **调研任务 R7**（nerve-hub 任务 ID: ca5bc119）
- [Neil] [2026-04-26] 确定性归代码，非确定性归 Agent → **升格为 SPARK-029**
- [Neil] [2026-04-26] 多 Agent 协作安全体系 → **升格为 SPARK-030**
- [Neil] [2026-04-27] 非 VLM 低延时 GUI 图像识别引擎 → **升格为 SPARK-031**
