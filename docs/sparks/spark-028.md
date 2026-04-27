## SPARK-028 · 从能跑到可运营——daemon 可观测性与可配置性

**日期**：2026-04-27
**来源**：Neil，全自动流水线跑通后的第一个真实痛点反馈：魔法太多，黑盒，不可配置、不可监控、不可回溯
**成熟度**：🟡 近期可做

**洞见**：
"能跑"和"可运营"之间差一大截。当前 daemon 是按"跑起来"设计的——路径硬编码、日志飞走、执行过程不可见、出了问题无从追查。
这不只是技术债，而是 nerve-hub 作为基础设施**走向生产可用的门槛**：
一个你不敢在离开时让它跑的系统，本质上还是个 demo。

**三个维度的具体问题**：

**① 不可配置（Hardcoded Magic）**
- 文件路径硬编码：`/Users/neilji/AIGC/nerve-hub`、`/opt/homebrew/bin/cliclick`
- 超时写死：5min/10min，没有按任务类型或项目级覆盖的机制
- 并发数写死：MAX_CONCURRENT=3，无法根据机器负载动态调整
- 模型名和 env 变量写死在代码里，换模型需要改代码
- Hub URL 硬编码，无法跨机器部署

**② 不可监控（Invisible Execution）**
- daemon 日志只输出到终端 stdout，手动运行时飞走，launchd 运行时才写文件
- claude CLI 执行中发生了什么完全不可见——在想什么、调用了哪些工具、卡在哪里
- Hub WebUI 只显示任务状态（pending/running/done），不显示执行细节
- on_batch_complete 重复触发无告警，批次边界模糊
- 无法知道当前有多少 claude 进程在跑、各自的资源占用

**③ 不可回溯（No Forensic Trail）**
- claude CLI 的完整输出（思考过程、工具调用、中间结果）没有持久化
- 不知道某个任务改了哪些文件、执行了哪些命令
- 任务失败时只有 stderr 片段，没有完整的执行上下文
- API 消耗（token 数、费用）没有记录，无法做成本分析
- session ID 存在但没有和日志、文件变更关联起来

**其他黑盒问题**：
- wake 机制依赖 cliclick + 剪贴板，换机器或升级 macOS 可能静默失效
- 无法暂停或取消正在执行的任务
- DEEPSEEK_API_KEY 在 Keychain 里，daemon 健康检查无法验证 key 是否有效

**解决方向（分层，从易到难）**：

**L1 — 配置外化（今天可做）**
- 引入 `~/.nerve/daemon.config.json` 或环境变量覆盖所有硬编码值
- 关键配置项：`NERVE_HUB_URL`、`WORKDIR`、`CLICLICK_PATH`、`TIMEOUT_DEFAULT`、`MAX_CONCURRENT`
- 模型配置独立为 `~/.nerve/models.json`，daemon 启动时加载

**L2 — 执行日志持久化（近期）**
- 每个任务创建独立日志目录：`.nerve/logs/<taskId>/`
  - `claude.stdout.log`：claude CLI 完整输出
  - `claude.stderr.log`：错误输出
  - `exec.json`：执行元数据（开始时间、结束时间、退出码、token 消耗、文件变更列表）
- Hub WebUI 任务详情页新增"执行日志"面板，实时 tail
- daemon 日志统一写入 `.nerve/daemon.log`，无论启动方式

**L3 — 运行时可观测（中期）**
- daemon 暴露 `GET /status` 端点：当前运行任务数、各任务状态、资源占用
- Hub WebUI 新增 daemon 健康看板：online/offline、当前并发、队列积压
- on_batch_complete 去重：记录最后触发的任务集合快照，避免重复唤醒
- 任务取消 API：`POST /tasks/:id/cancel`，daemon 收到后 SIGTERM 对应 claude 进程

**L4 — 成本与审计（长期）**
- 每个任务的 token 消耗、API 费用记录进 task 的 metadata
- 项目级、时间段级成本聚合视图
- 文件变更审计：git diff 快照与任务 ID 关联，可追溯"这个提交是哪个任务做的"

**最小可行改造（能立即解决最大痛点）**：
1. 配置外化：消灭所有硬编码路径（30 分钟，一个任务）
2. 执行日志持久化：每个任务的 stdout/stderr 写文件（1 小时，一个任务）
3. daemon 统一日志：无论手动还是 launchd 启动，日志都写 `.nerve/daemon.log`（15 分钟）

这三件事做完，从"黑盒"变成"灰盒"，大部分调试场景就够用了。

**根本原则**：
> 一个你不敢在离开时让它跑的系统，本质上还是个 demo。
> nerve-hub 要成为真正的基础设施，可运营性必须和功能性同等对待。

**与其他 SPARK 的关系**：
→ SPARK-017（黑灯工厂）：黑灯工厂的前提是你敢关灯——关灯前必须先有监控
→ SPARK-020（信任分级与熔断）：熔断的前提是能观测到异常，L2/L3 是熔断机制的数据基础
→ SPARK-026（倾听机器的声音）：执行日志本身就是 Agent 反思的原材料，L2 的日志可以驱动自动反思生成

---

*新增 Spark 请按 SPARK-XXX 编号，日期 + 来源 + 洞见 + 价值 + 延伸方向。*
