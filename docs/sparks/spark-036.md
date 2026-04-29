# SPARK-036 · 基于主动授权的 Agent 权限分级

**成熟度**：🟡 近期可做

## 核心问题

当前所有 Agent 可以读写任意数据，权限隔离完全缺失。Neil 愿意给 Agent 更高权限，但前提是他有**主动授权的能力**：

- 能看到哪个 Agent 请求了什么权限
- 能显式批准或拒绝
- 能随时撤销

没有这套机制，自动派单永远是纸上谈兵——权限失控的风险会阻止任何向 Agent 放权的决策。

## 核心设计：两轴独立配置

读和写是**两个独立字段**，由 Neil 在 WebUI 自由组合，不互相绑定：

| 字段 | 控制内容 | 枚举值 | 默认 |
|------|---------|--------|------|
| `permissionLevel` | 写操作范围 | `readonly \| task-self \| task-any \| admin` | `task-any` |
| `visibilityScope` | 读可见范围 | `own \| global` | `global` |

典型组合：

| Agent | permissionLevel | visibilityScope | 效果 |
|-------|----------------|-----------------|------|
| cursor / trae-solo（正常） | `task-self` | `own` | 只看自己任务，只写自己任务 |
| cursor（临时审查模式） | `task-self` | `global` | 看全部任务，只写自己任务 |
| claude-code | `task-any` | `global` | 全量读写 |
| claude-desktop | `admin` | `global` | 全量读写 + 管理权限 |

**为什么要独立而非绑定？** 特殊场景下（如临时让某个执行 Agent 做全局审查），需要提升读可见范围而不改变写权限边界。绑定设计会强迫要么给太多写权限，要么保持读隔离无法完成任务。两轴正交，Neil 授权时粒度更精准。

**读隔离实现**：`visibilityScope=own` 时在 DB 查询层强制 `WHERE (assignee=self OR assignee IS NULL)`，不依赖 Agent 自觉传参。实现两个目标：
1. **安全**：Agent 看不到不该看的任务
2. **关注点分离**：Agent 上下文窗口不被无关任务填满，减少注意力分散

## WebUI 交互设计

- Agent 详情页显示当前权限级别
- Neil 可一键升级/降级权限
- 权限变更记录在事件日志
- 可选：Agent 首次超出当前权限时自动挂起并通知 Neil

## 与其他 Spark 的关联

- **spark-020**（信任分级与熔断）：共享"信任"概念，但 020 聚焦异常时的自动降级，036 聚焦日常的人工授权管理。两者互补。
- **spark-019**（Agent 能力路由）：自动派单依赖权限系统——只有权限匹配的 Agent 才能被路由到特定任务类型。
- **spark-030**（多 Agent 协作安全体系）：036 是 030 的人工授权子集，聚焦于 Neil 作为授权中心的操作层。

## 来源

Neil，2026-04-29，INBOX 讨论，作为"下一阶段可信基础设施"的核心组件
