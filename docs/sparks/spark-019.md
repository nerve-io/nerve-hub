## SPARK-019 · Agent 能力路由——自动派单市场

**日期**：2026-04-26
**来源**：黑灯工厂讨论中识别的关键缺失

**洞见**：
黑灯工厂的核心瓶颈之一：现在 `assignee` 是人工指定的，
但真正的自动化需要 **Task → Agent 的自动匹配**：
- 这个 task 需要什么能力（coding / research / review / deploy）？
- 哪个在线 Agent 最适合（能力匹配 + 当前负载）？
- 依赖链上谁先谁后（有 DAG 支撑）？

这本质上是一个 **Agent 能力市场的雏形**——
比 Slack Bot 生态高一个维度，因为是机器对机器的能力协商，而不是人去配置集成。

**技术路径**：
1. Agent 注册时声明 capability schema（taskTypes、languages、priorities）——数据库已有 `capabilities` 字段
2. Runner 派单时按 capability 匹配而非随机分配
3. 加入负载感知：`busy` 状态的 Agent 不接新任务
4. 长期：能力声明标准化，对齐 A2A Agent Card 格式（→ SPARK-008/009）

**最小可行**：Runner 的 webhook 派发逻辑加一层 capability filter，
`pending` task 的 `type` 字段与 Agent 的 `taskTypes` 做交集匹配。

**延伸**：→ SPARK-008（A2A 借鉴），→ SPARK-020（信任分级与熔断）

---
