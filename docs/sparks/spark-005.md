## SPARK-005 · AGENTS.md → nerve-hub 协议迁移

**日期**：2026-04-24
**来源**：反思当前工作流中语义约束的局限性

**洞见**：
当前 AGENTS.md 扮演两个角色：
- 协议层（如何完成任务、升级问题）→ 应该迁移进 nerve-hub，成为系统行为
- 项目层（项目特定技术约定）→ 迁移进 Project rules 字段，由 Briefing 自动分发

迁移完成后，每个 repo 的 AGENTS.md 极度精简，只剩"引导指针"：
"本项目使用 nerve-hub 协调任务，协议见 nerve-hub project context。"

**价值**：协议统一、跨项目复用、消除语义混淆（TRAE 误读 AGENTS.md 的根因）。

**迁移路径**：Project rules 字段 → Agent profile schema → Briefing 自动注入 → AGENTS.md 精简 → 跨项目验证

---
