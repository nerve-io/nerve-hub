## SPARK-010 · CLI Agent 接入类型

**日期**：迁移自 README TODO
**来源**：Agent 类型规划，Webhook/Manual 之后的第三种本地接入方式

**设计方案**：
Runner spawn 子进程，将任务 Briefing 写入 stdin；
Agent 进程通过 stdout 输出 JSON 结果；
Runner 读取输出，回填 result + 更新状态。

适用场景：本地命令行工具、脚本、小型 LLM wrapper，无需搭 HTTP 服务即可接入 nerve-hub。

**已知挑战**：
- 进程生命周期管理（超时 kill、僵尸进程）
- stdin/stdout 编码 / 分隔符协议设计
- 进程崩溃恢复与重试策略

**实现前置条件**：Webhook 模式验证稳定后跟进。

**与 SPARK-008/009 的关系**：
CLI Agent 是"协议无关调度层"的组成部分——和 Webhook、Manual、A2A 并列，
覆盖本地进程这一接入场景，让 nerve-hub 真正做到零门槛接入任意可执行程序。

---
