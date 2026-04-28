# nerve-hub 产品路线图

## 产品主张

nerve-hub 是一个 **多产品协同系统**——让不同的 AI 产品（Claude、TRAE、Google Antigravity 等）通过统一的任务总线协作完成工作。

**人的角色是暂时性的**：当前 Neil 作为"掮客"手动拆解需求、派发任务、验收交付。长期目标是把这个掮客角色也交给 AI，让产品之间自己流转任务。

核心理念：**产品层协调，而非框架层协调**。不改造任何 Agent 的内部实现，只在任务分配和交付验收层面建立协议。

---

## 当前阶段：核心任务调度稳定 + 人工掮客流程跑通

**目标**：让 nerve-hub 自身的开发流程在多 Agent 协作下稳定运转。

### 进行中

- [x] 建立项目文档机制（decisions、deprecated、roadmap）
- [x] 回退 GUI 自动化（cua/cliclick），聚焦核心流程
- [x] 用 TipTap 替换 MD 编辑器，降低任务编辑门槛

### 已稳定

- [x] SQLite 任务存储 + REST API + WebSocket 广播
- [x] MCP 工具集（23 tools）
- [x] Agent 注册、心跳、规则管理
- [x] Agent 间任务派发与验收流程
- [x] Web UI（看板、任务详情、事件日志、Agent 状态、Handoff Queue）
- [x] Inbox 协议（文件方式支持无法访问 localhost 的 Agent）

---

## 下一阶段：减少人工掮客负载

- 自动派单市场（Agent 能力路由）
- 信任分级与熔断机制
- 低峰期 API 资源调度

---

## 暂缓

- **GUI 自动化（cua / cliclick）**：时机不成熟，核心任务调度尚未稳定前过早投入。详见 `docs/deprecated/automation-cua-cliclick.md`
