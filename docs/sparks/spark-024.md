## SPARK-024 · 审批感知监控——GUI 自动化脚本作为 Agentic 软件的"神经末梢"

**日期**：2026-04-26
**来源**：Neil，观察到 Agentic 软件（Cursor、Claude Code 等）在执行高风险操作时会弹出审批提示，这类事件目前对 nerve-hub 完全不可见
**成熟度**：🔵 中期规划

**问题**：
黑灯工厂的最大瓶颈之一是**审批弹窗把人重新拉回同步循环**。
Cursor 执行某段代码前弹出"Allow execute"，Claude Code 要求确认某个操作——
这些事件发生在各产品的 GUI 里，nerve-hub 对此一无所知，无法在任务维度上呈现和管理。

**洞见：GUI 自动化脚本作为神经末梢，持续监听 Agentic 软件界面**

GUI 自动化脚本不只能"执行操作"，还能"监听状态"——
以极低成本（截图 + 关键词识别，无需 LLM）持续扫描各 Agentic 产品的界面，
一旦检测到审批类标识（"Allow execute"、"Confirm"、"Approve"、"需要确认"等），
立刻向 nerve-hub 推送事件，nerve-hub 同步更新对应 task 的状态为 `awaiting_approval`，
并在看板上呈现：
> Cursor 执行 `npm run build` **待批准**
> Claude Code 删除 `legacy/` 目录 **待批准**

**价值**：
1. **可观测性**：所有 Agent 的审批事件从"人去各软件碰运气"变成"nerve-hub 统一汇报"
2. **批量决策**：Neil 可以在一个界面批量看到所有待批准项，集中处理而非逐个软件跳转
3. **审计留存**：每次审批事件进入 event log，形成完整决策记录

**演进路径**：

**阶段一：监听 + 通知**（最小可行）
GUI 自动化脚本轮询截图 → 关键词匹配 → 推送到 nerve-hub → 看板展示 `awaiting_approval` 状态
无需 LLM，纯确定性脚本，延迟低，成本趋近于零

**阶段二：上下文关联**
nerve-hub 将审批事件与具体 task 关联——知道"Cursor 的这个执行请求"属于哪个任务，
让 Neil 在审批时有完整的 task 上下文（背景、目标、依赖链），而不是面对孤立的一行命令

**阶段三：LLM 决策智能——自动批准**
引入专用 LLM 判断层，接收审批请求 + task 上下文 + 预设策略，自动做出批准/拒绝决策：
- 低风险操作（读文件、运行测试、lint）→ 自动批准
- 中风险操作（写文件、安装依赖）→ 按 task 上下文判断
- 高风险操作（删除、外部 API 写操作、生产部署）→ 强制上报人工

这一能力在业界已有先例（部分产品内置"Agent Decide"类功能），nerve-hub 的差异在于：
**跨产品统一策略**——不同 Agentic 软件的审批请求，都经过同一套规则引擎处理，策略一处配置，全局生效。

**技术实现要点**：
- 监听脚本：截图 + OCR / 模板匹配，识别审批弹窗；轮询间隔 500ms-2s 可接受
- 推送协议：POST 到 nerve-hub REST API，携带 `agent_name`、`action_description`、`screenshot_hash`
- 新 task 状态：`awaiting_approval`（介于 `running` 和 `done` 之间的中间态）
- 看板展示：新增"待批准"泳道，或在 running 任务卡上叠加醒目角标

**调研补充（trae-solo · 2026-04-26）**：

覆盖 10 款产品的市场调研（Cursor / Claude Code / Devin / Copilot Workspace / Windsurf / Aider / OpenHands / Continue.dev / Amazon Q / SWE-agent）确认以下关键结论：

1. **蓝海确认**：没有任何现有产品在做跨工具统一审批策略，nerve-hub 的定位无直接竞争者。

2. **最短接入路径**：Claude Code 已有 `--permission-prompt-tool` 参数，可将审批决策**委托给外部 MCP 工具**。nerve-hub 今天就能通过此钩子接入 Claude Code 的审批流，无需等 GUI 自动化脚本——比原计划更直接。

3. **六大审批范式**：建议式 / 逐次确认 / 规则引擎 / LLM 安全分析 / 分阶段审批 / 沙箱优先。nerve-hub 的目标是做跨范式的统一编排层。

4. **分层策略模型**（与 SPARK-020 合并设计）：
   ```
   第 1 层：组织策略（全局强制）
   第 2 层：项目策略（项目级覆盖）
   第 3 层：工具策略（按 Agent 产品差异化）
   第 4 层：LLM 审批层（智能决策）
   第 5 层：人工兜底（高风险转人工）
   第 6 层：审计层（全量记录，兼容 OpenTelemetry）
   ```

5. **时间窗口**：各产品权限系统正在快速演进，跨产品空白不会永远存在。Claude Code MCP 接入路径应尽快推进。

完整报告见 `.agent/reports/research_agent_decide_20260426.md`

**与其他 SPARK 的关系**：
→ SPARK-016（从同步调度到异步审核）：本 Spark 解决的正是 016 中"工具批准"这个最后的同步瓶颈
→ SPARK-017（黑灯工厂）：自动批准是黑灯工厂阶段三的必要条件
→ SPARK-020（信任分级与熔断）：六层策略模型与信任分级合并设计
→ SPARK-022/023（GUI 自动化脚本）：本 Spark 是 GUI 脚本"监听"能力的具体应用场景

---
