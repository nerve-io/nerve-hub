## SPARK-016 · 从同步调度到异步审核——Neil 从任务级到 Sprint 级

**日期**：2026-04-26
**来源**：Neil 复盘当前工作流瓶颈：注意力消耗、手动复制粘贴、工具批准频次过高

**问题描述**：
当前模式里 Neil 是**同步调度者**——每一轮迭代都需要 Neil 主动发起对话：
"有完成的任务吗？" → Claude 检查 → 验收 → 派下一个任务。
这让 Neil 的注意力成为系统的节拍器，每个任务都需要他在场。

**洞见**：
瓶颈不在工具，在角色定位。只要 Neil 仍是同步调度者，自动化程度的上限就是"更快地等待 Neil"。
**升级路径：Neil 从任务级参与者，退到 Sprint 级决策者。**

三个解耦点：

1. **任务发现与认领解耦**：backlog 提前写满一个 Sprint 的任务；
   TRAE 完成当前任务后，按规则自主认领下一个 pending 任务，无需等待 Neil 派单。
   nerve-hub 的 `claim_task` 已经支持，缺的只是 TRAE agent rules 里的一条自主认领规则。

2. **完成通知与验收解耦**：用 Cowork schedule skill 定时轮询 hub，
   有 done 任务时主动在对话里呈现验收清单——Neil 不需要记得去问，完成了自然来找他。
   验收本身仍然是 Neil 的决策权，但触发方式从"主动轮询"变成"被动接收"。

3. **工具批准与执行解耦**：computer-use 是平台硬约束，无法绕过；
   但文件工具 + bash + MCP 工具一旦 session 开始就无需逐次批准。
   设计工作流时优先用后三者，把 computer-use 降到只在真正需要操作桌面时才触发。

**目标状态**：
- Neil 的介入点：Sprint 规划（写 backlog）+ 批量验收（Sprint 结束时）+ 异常处理
- TRAE 的自治范围：认领 → 实施 → 完成 → 认领下一个，循环直到 backlog 清空
- Claude 的角色：异步监控者 + 验收触发器，而非每次都等 Neil 来叫它

**与现有机制的对应**：
- `claim_task` MCP 工具 → TRAE 自主认领已有基础
- `.agent/rules/` → 加一条 "完成后自动认领下一个同优先级任务" 规则即可激活
- Cowork schedule skill → 定时检查 done 任务，批量推送给 Neil
- nerve-hub `get_handoff_queue` → 已有积压队列视图，可作为 Sprint 结束验收的入口

**最小可行改造（今天就能做）**：
1. 更新 TRAE 的 agent rules，加自主认领逻辑
2. 在 Cowork 里设一个定时提醒（每日或每 N 小时）检查 done 任务
3. 提前把下一批任务全部写进 backlog

**延伸**：→ SPARK-004（规则自动触发），→ SPARK-006（门禁即护栏）

---
