# nerve-hub 产品路线图

## 产品主张

nerve-hub 是一个 **多产品协同系统**——让不同的 AI 产品（Claude、TRAE、Google Antigravity 等）通过统一的任务总线协作完成工作。

**人的角色是暂时性的**：当前 Neil 作为"掮客"手动拆解需求、派发任务、验收交付。长期目标是把这个掮客角色也交给 AI，让产品之间自己流转任务。

核心理念：**产品层协调，而非框架层协调**。不改造任何 Agent 的内部实现，只在任务分配和交付验收层面建立协议。

---

## 三段演进路线

### 阶段 0 → 1（当前）：可行性验证

**目标**：打磨到「第二个人能在 30 分钟内上手，且觉得值得」。

评判标准只有一个：有没有人愿意为它付费或持续使用。自用 dogfooding 是手段，不是终点。

### 阶段 1 → 2（活下去）：小团队验证

**目标**：服务 5-10 个小团队，找到重复付费的使用模式，验证「人 + Agent 混合协作」的经济模型。

### 阶段 2 → 3（活得好）：规模扩张

**目标**：Agent 自治比例提升，人的角色从任务级介入退到 Sprint 级。

---

## 当前阶段：0 → 1 收尾 + 下一阶段准备

### 已稳定（基础设施）

- [x] SQLite 任务存储 + REST API + WebSocket 广播
- [x] MCP 工具集（23 tools）
- [x] Agent 注册、心跳、规则管理
- [x] Agent 间任务派发与验收流程
- [x] Web UI（看板、任务详情、事件日志、Agent 状态、Handoff Queue）
- [x] Inbox 协议（文件方式支持无法访问 localhost 的 Agent）
- [x] 每 Agent 独立 token + rotation（agent-setup）

### 进行中

- [ ] `22eb8e99` WebUI 4 项修复（cursor）
- [ ] `077ac1b1` agent-setup 每 Agent 独立 token + rotation（claude-code）
- [ ] `7c1978f8` complete_task 硬门禁（claude-code）

---

## 下一阶段：可信 · 可观测 · 可上手

0→1 的门槛不是功能不够，而是系统还不够可信、可观测、可上手。三个方向并行推进：

### 可信（让 Agent 交付有质量保证）

- complete_task 硬门禁（进行中）
- **Agent 主动授权 + 权限分级**（spark-036）：Neil 能看到哪个 Agent 请求什么权限，能显式批准/拒绝/撤销。没有这个，自动派单无法安全推进。

### 可观测（让系统状态透明）

- **daemon 可观测性**（spark-028）：Agent 心跳、Runner 状态、错误日志的 WebUI 展示。第二个用户遇到问题，必须能自己排查。

### 可上手（降低接入门槛）

- **统一配置中心**（spark-035）：WebUI 驱动的 Agent 配置，替代命令行 agent-setup 脚本。
- **竞争窗口与品类定义**（spark-032）：在找第一批用户之前，先想清楚找谁、凭什么。

---

## 并行研究

- **R10** LLM 底层架构论文调研（claude-web）：从 MoE、SSM 等架构演进中提炼多 Agent 协作范式，见 spark-038
- **R11** OpenRouter 平台调研（cursor）：LLM 评级数据 + 成本模型 + API 供应商可行性

---

## 中期规划（阶段 1 → 2）

- Agent 能力路由——自动派单市场（spark-019）
- 信任分级与熔断机制（spark-020）
- 低峰期 API 资源调度（spark-021）
- Task 四元组扩展——behavior/verification/evidence/state（spark-037）

---

## 暂缓

- **GUI 自动化（cua / cliclick）**：时机不成熟。详见 `docs/deprecated/automation-cua-cliclick.md`
- **Prose VM 模式**（多 service 子 agent 流水线）：轻量 contract 未跑满 3 个任务，过早全量接入成本高
- **React Ink TUI / CLI 接入**：CLI 方向取决于 target user 是否真的需要，WebUI 优先
