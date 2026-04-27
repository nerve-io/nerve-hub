## SPARK-017 · 黑灯工厂——Agent 自治的 Jira

**日期**：2026-04-26
**来源**：与 Neil 讨论 nerve-hub vs Slack 差异化定位

**洞见**：
nerve-hub 的终极形态是"黑灯工厂"——AI Agent 在没有人持续在场的情况下，
自主完成从任务认领、实施、验收到交付的完整工作流，人只在 Sprint 边界或异常升级时介入。

这对应两个演进阶段：

**阶段一：Agent 自治治理**（当前可推进）
- Task 有显式状态机，Agent 可自主认领、实施、完成
- 依赖 DAG 保证顺序，`blocked_by` 自动计算
- 结构化交付（result 字段 + 自测报告）让验收可机器辅助
- 人的角色：Sprint 规划 + 边界验收 + 异常仲裁

**阶段二：黑灯工厂**（接入外部 Agentic 产品）
- nerve-hub 成为各 Agentic 产品的调度中枢
- Claude 做规划/验收，Cursor 做代码，Perplexity 做研究，各自在自己擅长的领域承接任务
- 人只设定目标和预算，Agent 跑完整个流水线

**核心差异**：Slack 的逻辑是"人在工作，AI 来帮"；nerve-hub 的逻辑是"AI 在工作，人来审"。
这个主客倒置不是措辞差异，是产品设计哲学的根本分歧，Slack 因历史包袱无法转型。

**延伸**：→ SPARK-018（Harness of harnesses），→ SPARK-019（Agent 能力路由）

---
