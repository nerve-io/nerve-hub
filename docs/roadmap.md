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

## 当前阶段：0 → 1 收尾（已完成），准备进入阶段 1

> 最后更新：2026-04-29

### 已稳定（基础设施）

- [x] SQLite 任务存储 + REST API + WebSocket 广播
- [x] MCP 工具集（28 tools）
- [x] Agent 注册、心跳、规则管理
- [x] Agent 间任务派发与验收流程
- [x] Web UI（看板、任务详情、事件日志、Agent 状态、Handoff Queue）
- [x] Inbox 协议（文件方式支持无法访问 localhost 的 Agent）
- [x] 每 Agent 独立 token + rotation（`077ac1b1` agent-setup）

### 已完成：可信 · 可观测 · 可上手

原"下一阶段"三个方向已全部落地：

**可信**
- [x] `7c1978f8` complete_task 硬门禁（三件套 + 反思字段必填）
- [x] `b4067322` + `71f0296b` Agent 权限分级（spark-036）：后端权限模型 + WebUI 授权管理页

**可观测**
- [x] `93d67f93` daemon 可观测性 WebUI（spark-028）：Agent 心跳、Runner 状态、错误日志展示
- [x] `0134b9e3` 安全旁路修复：10 个 MCP 工具权限漏洞修复，任务可见性隔离完整

**可上手**
- [x] `ba5b26a5` 统一配置中心 WebUI（spark-035）：MCP 配置生成器，替代命令行脚本
- [x] `22eb8e99` WebUI 4 项修复（视觉审查遗留问题）
- [x] WebUI 全面优化（排版基线、国际化、暗色主题、Kanban 分页、弹窗、菜单重设计等）

### 已完成：并行研究

- [x] `8de46fae` R10：LLM 底层架构演进与多 Agent 协作范式（spark-038）
- [x] `21f3650f` R11：OpenRouter 平台评估（成本模型 + API 供应商可行性）

### 待决策

- **竞争窗口与品类定义**（spark-032）：在找第一批用户之前，先想清楚找谁、凭什么。尚无对应任务。

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
