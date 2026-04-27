# SPARK-030 · 多 Agent 协作安全体系

**成熟度**：🔵 中期规划

## 洞见

随着 nerve-hub 自动化程度提升（daemon 全自动执行、多 Agent 并发），当前"所有 Agent 权限等同"的设计越来越危险。一个低质量或被劫持的 Agent 可以 delete 任何任务、revoke 任何凭证。

## 核心约束

> **自动化是第一要务**。安全机制不得中断自动流程。高风险自动化功能需人类主动确认是否启用，而非默认拦截。

## 四个方向

### ① Agent 权限分级
- WebUI 手动设置每个 Agent 的信任等级（建议：低 / 中 / 高 / 超级）
- 不同等级对应不同操作权限：
  - 低：只能 claim/complete 自己的任务，只读其他
  - 中：可 create/update 任务，不可 delete/revoke
  - 高：完整操作，除 revoke 高级 Agent
  - 超级：无限制（仅限 claude-desktop 级别）
- 自动化管道不受等级限制（daemon 是受信任的系统组件，不是 Agent）

### ② WebUI 用户登录系统
- 支持用户注册/登录，区分人类用户与 Agent 身份
- 人类操作留审计日志，Agent 操作已有 event log
- Session token 管理（避免凭证泄漏）

### ③ SQLite 容灾
- 调研并备案 DB 文件被异常删除/损坏的极端场景
- 方案候选：WAL checkpoint + 定时备份 + 备份恢复 CLI 命令
- 目标：从灾难到恢复 < 5 分钟，数据丢失窗口 < 1 小时

### ④ 审计与可见性
- 所有破坏性操作（delete、revoke、status 强制变更）记录到专用审计表
- WebUI 提供审计日志视图

## 来源

Neil，2026-04-26，SPARK-INBOX
