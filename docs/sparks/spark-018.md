## SPARK-018 · Harness of Harnesses——元治理层

**日期**：2026-04-26
**来源**：与 Neil 讨论 nerve-hub 的本质定位

**洞见**：
每个 Agentic 产品（Claude、Cursor、Devin…）已经解决了"单 Agent 层面的可靠性"——
用 Harness Engineering 把裸 LLM 约束成可用的 Agent（工具、护栏、结构化输出、完成信号）。

**nerve-hub 是 Harness of Harnesses**——在多个已经可靠的 Agent 之间，
保证整体工作流不崩。这是完全不同的工程问题，目前几乎没有人认真做。

实践含义：
- nerve-hub 不关心 Cursor 内部怎么生成代码，只关心它的 **Harness 边界**：
  接受什么格式的任务输入、完成信号是什么、失败模式有哪些
- 各产品已有的 Harness 文件（`.cursor/rules`、`.agent/rules`）是接入的切入点，
  可直接转化为 nerve-hub 的 Agent capability 声明
- nerve-hub 不需要重造轮子，只需要在边界上做协议对齐

**核心挑战**：单 Agent Harness 失效在 nerve-hub 层面的处理——
这和微服务的 circuit breaker 是同一问题，粒度从 API 调用变成 Agent 任务。
现有的 `failed` / `blocked` 状态是起点，还缺"谁来决定重试、重试给谁、重试几次"的完整协议。

**延伸**：→ SPARK-019（Agent 能力路由），→ SPARK-006（门禁即护栏）

---
