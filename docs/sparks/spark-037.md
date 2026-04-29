# SPARK-037 · Task 四元组——多 Agent 协作的可执行任务原语

**成熟度**：🔵 中期规划

## 核心洞察

当前 Task 是描述性的（title/description/assignee/status），缺少机器可执行的验收语义。Harness 工程（R9）的 feature_list.json 启示：任务应是**调度、验证、handoff 的单一事实源**。

## 四元组扩展

| 字段 | 含义 | 示例 |
|------|------|------|
| `behavior` | 任务应做什么（当前 description） | "给 /tasks 路由添加列表页" |
| `verification` | 机器可执行的验收命令 | `"curl localhost:3141/api/tasks \| jq 'length > 0'"` |
| `evidence` | Agent 提交的证明（截图路径、测试输出、日志片段） | `".agent/reports/assets/tasks-list.png"` |
| `state` | 受控状态迁移（pending → claimed → verified → done） | 当前 status 字段的严格化版本 |

## 价值

- **complete_task 门禁**（spark-006）从"字段非空"升级为"验收命令真正通过"
- **Agent 自测**从主观文字描述升级为可重现的命令证据
- **Orchestrator** 可以在不阅读全文的情况下，通过 verification 字段快速判断任务是否真完成
- 与 Harness 工程的外部强制执行原则高度吻合

## 实施前置条件

1. complete_task 硬门禁（`7c1978f8`）先跑稳，确认基础字段校验有效
2. 至少 10 个任务积累 evidence 字段的真实数据，再设计 verification 格式

## 关联

- **spark-006**（门禁即护栏）：037 是 006 的升级版，从"格式门禁"到"语义门禁"
- **spark-018**（Harness of Harnesses）：037 的设计灵感直接来源于 Harness feature_list 模式

## 来源

cursor 观察，2026-04-29，INBOX 讨论，基于 R9 Harness 工程调研结论
