# Sparks — 产品灵感记录

> 头脑风暴中闪现的产品方向、架构洞见、商业化思路。
> 这些是 nerve-hub 未来演进路线的原材料，不是 TODO，不是 Roadmap。
> 每条 Spark 代表一个值得深入的方向，后续产品决策在这些 Spark 之间展开。

---

## SPARK-001 · 约定中心化

**日期**：2026-04-24
**来源**：讨论 AGENTS.md 范式与 nerve-hub 的重叠与融合

**洞见**：
AGENTS.md 是静态文档，散落在各 repo，靠 Agent 读懂才能生效——这是软约束。
如果把"约定"变成 nerve-hub 的结构化数据（Project rules 字段、Agent profile），
由 Briefing 生成时自动注入，约定就从"建议"变成"硬注入"，Agent 无法忽略也无需主动寻找。

**价值**：跨项目一致性、协议可版本化、冷启动成本趋近于零。

**延伸**：→ SPARK-002，→ SPARK-003

---

## SPARK-002 · 出厂约定

**日期**：2026-04-24
**来源**：约定中心化讨论

**洞见**：
nerve-hub 可以内置一批经过实际工作流验证的"出厂约定"——
新用户装上就能得到一套行之有效的多智能体协作模式，不需要自己摸索。
积累的出厂约定本身就是护城河：背后是真实跑通的经验，不是拍脑袋的文档。

**价值**：解决冷启动问题，降低新用户门槛，沉淀产品 IP。

**延伸**：→ SPARK-003

---

## SPARK-003 · RuleStore

**日期**：2026-04-24
**来源**：出厂约定讨论，类比 AppStore / npm

**洞见**：
规则（Rule）可以成为 nerve-hub 的一等公民——可以被发现、安装、评分、fork、组合。
RuleStore 是规则的市场：
- 免费层：通用基础规则，社区贡献
- 付费层：针对特定 Agent 组合深度调优的规则包，或企业私有规则空间

用户每跑通一个工作流，就沉淀一条规则；规则越多，新用户起步越快；用户越多，规则迭代越快。
这是典型的飞轮，也是最自然的商业化入口。

**护城河**：不是规则文本（可被复制），而是规则的验证历史、组合关系、运行数据。
→ 见 SPARK-004

**价值**：网络效应、商业化路径、行业定位（多智能体协作操作知识库）。

---

## SPARK-004 · 机器可执行规则

**日期**：2026-04-24
**来源**：讨论 RuleStore 护城河时的关键洞见

**洞见**：
规则的价值分三层：
1. **文本层**（可复制）：规则的自然语言表达，注入进 Briefing。零保护。
2. **数据层**（难复制）：规则在哪些 Agent 组合下跑通、失效、与哪些规则冲突。活在运行历史里，不在文本里。
3. **执行层**（不可复制）：规则绑定系统行为——校验门禁（`complete_task` 拒绝不合格结果）、自动触发（code 任务完成后自动创建 review 子任务）、状态副作用（critical 任务进入 running 时通知指定 Agent）。

**核心结论**：规则必须有机器可执行的部分，护城河才成立。
文本只是声明，执行引擎才是载体。让规则离开 nerve-hub 就失活，才是真正的产品壁垒。

**实现方向**：
- `complete_task` 增加 Rule 校验钩子
- 任务状态变更触发 Rule 副作用引擎
- Rule schema 包含 `checks`（校验）和 `triggers`（触发）两个可执行字段

---

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

## SPARK-006 · Harness Engineering — 门禁即护栏

**日期**：2026-04-24
**来源**：讨论机器可执行规则时，从"校验门禁"延伸出的设计哲学

**洞见**：
nerve-hub 主动拒绝不合规 Agent 调用，体现的是 Harness Engineering 思想：
让正确行为成为**唯一可能的行为**，而不是最推荐的行为。

类比：
- 文档说明 ≈ 注释里写"请传正确类型" → 可被忽略
- nerve-hub 门禁 ≈ 编译器类型检查 → 结构性阻止

对多 Agent 系统的核心价值：
Agent 的自由度被协议层硬性约束，"理解偏差"这个失败模式从根本上消失。
不管 Agent 有没有读懂规则、有没有遵守约定，系统行为是确定的。

**实现方向**：
- Rule 的 `checks` 字段定义完成条件，`complete_task` 执行前校验，不通过则 4xx 拒绝
- 未来可扩展至 `claim_task`（认领前校验 Agent 资质）、`create_task`（创建前校验项目规则）
- 错误响应携带拒绝原因，Agent 可据此自我修正后重试

**与 SPARK-004 的关系**：
SPARK-004 说"规则需要机器可执行部分"，SPARK-006 说明了为什么——
执行的本质不是"帮 Agent 做事"，而是"阻止 Agent 做错事"。

---

## SPARK-007 · 产品层协调，而非框架层协调

**日期**：2026-04-24
**来源**：Neil 对自身使用场景的深度复盘 + 市场现状调研

**背景/用户故事**：
Neil 想用 Claude Pro 做大脑/嘴替，指挥 TRAE SOLO（免费额度）执行编码任务，
在两者之间做能力套利：Claude 的推理+规划能力 × TRAE 的免费执行容量 = 可靠且低成本的工程输出。
但现有方案（LangGraph、CrewAI、A2A 协议）都无法解决这个问题——它们要求从零构建 Agent，
不支持"让两个已有的 AI 产品直接协作"。

**洞见**：
市场上存在两个层次的 Agent 协作方案：
- **框架层**（LangGraph、CrewAI、AutoGen）：给开发者构建新 Agent 用的 SDK，要求所有 Agent 使用同一套框架
- **协议层**（MCP、A2A、ACP）：Agent 互通的通信规范，要求 Agent 实现协议接口

**两者都不解决"现成 AI 产品之间的协作"问题。**

nerve-hub 的定位是第三层：**产品层协调基础设施**
- 不要求 Agent 实现任何协议，只要求能收任务、出结果
- 最低门槛：人工中转也是合法的接入方式（Manual Agent）
- 上限无限：支持 MCP、Webhook、未来的 A2A——有什么用什么
- 任何用户、任何 AI 产品组合，都能被纳入统一的协调体系

**商业模式的底层逻辑**：
用户做的是能力套利——用高推理能力 AI 做调度（Claude），用专项/低成本 AI 做执行（TRAE、未来更多）。
nerve-hub 是让这种套利可持续、可扩展、可积累的基础设施。
用户越多，覆盖的 Agent 产品组合越多，网络价值越高。

**市场验证**：
- "模型分层"（高能力调度 + 低成本执行）已是 2026 年多 Agent 生产实践的标准模式
- A2A 协议（Google，50+ 合作伙伴）在解决协议互通，但无法解决产品级接入
- 目前无成熟方案覆盖 nerve-hub 所在的产品层

---

## SPARK-008 · 协议无关的调度层 + A2A 借鉴

**日期**：2026-04-24
**来源**：调研 MCP 之外的 Agent 互通协议（A2A、ACP、ANP、AG-UI）

**协议全景**：
- MCP：Agent ↔ 工具（纵向，Agent 向下调用工具/资源）
- A2A：Agent ↔ Agent（横向，Agent 平级委托任务）——Google 主导，50+ 合作伙伴
- ACP：已于 2025-08 合并进 A2A（Linux Foundation）
- ANP：去中心化 Agent 发现与协作（基于 DID，面向开放网络 Agent 市场）
- AG-UI：Agent 与前端界面交互标准

MCP 和 A2A 互补不竞争：MCP 解决"Agent 用什么工具"，A2A 解决"Agent 找谁干活"。

**核心洞见**：
nerve-hub 已经在做 A2A 在做的事——Briefing 派发 + complete_task 回填 = A2A 的任务委托模型。
区别是 nerve-hub 没有用标准化格式声明它。

**可借鉴的具体点**：

1. **Agent Card → Agent Profile 扩展**
   A2A 里每个 Agent 发布结构化能力声明（能做什么任务类型、接受什么格式）。
   nerve-hub 的 Agent 注册可扩展为 capability schema，支持调度时智能匹配：
   "这个 code 任务，派给声明了 code 能力的 Agent"。

2. **A2A 作为新 Agent 接入类型**
   现有类型：webhook / manual / cli(TODO)
   未来加入：a2a —— 对支持 A2A 的 Agent 直接机器派发，零人工中转。
   一旦 TRAE 或其他工具实现 A2A，Manual 类型可无缝升级为 a2a 类型。

3. **ANP 与 RuleStore 的远期呼应**
   ANP 做去中心化 Agent 发现，RuleStore（SPARK-003）做规则发现。
   未来两者可以合流：不只是规则可以被发现，Agent 本身也可以按需发现和接入。

**战略定位**：
nerve-hub 是**协议无关的调度层**——上面挂什么协议的 Agent 都能跑。
当前 Agent type 体系按"接入机制"分类，未来演进为按"协议"分类：
A2A / Webhook / MCP-native / Manual 并列，随协议生态成熟自然扩展，无需重构核心。

**近期不需要实现，但架构上要留位置。**

---

## SPARK-009 · 借鉴 A2A 数据模型，而非实现 A2A

**日期**：2026-04-24
**来源**：Briefing 机制与 A2A 高度一致，讨论是否直接采用 A2A 协议

**关键区分**：
A2A 是点对点协议，假设每个 Agent 是可寻址的 HTTP 服务器。
nerve-hub 是中心辐射架构，Manual Agent（TRAE、Claude.ai）根本不是服务器。
**完全实现 A2A = 放弃 Manual 接入 = 放弃最低门槛**，这与产品定位相悖。

**正确姿势：借鉴数据模型，不绑定传输协议。**

| A2A 概念 | nerve-hub 现状 | 对齐方向 |
|---------|--------------|---------|
| Agent Card（能力声明） | metadata 字段（非结构化） | 扩展为结构化 capability schema |
| Task 状态（submitted/working/completed） | pending/running/done/failed/blocked | 参考对齐，保留 blocked |
| Artifact（结构化产出物） | result 字段（纯字符串） | 扩展为结构化 artifact 对象 |
| Message history | Events ✅ | 基本一致，无需改动 |

**数据模型对齐的价值**：
- 概念上与行业标准接轨，降低开发者的理解成本
- 为未来加 A2A 原生接入类型铺路——届时只需加协议层，不需重构核心数据结构
- Artifact 结构化后，规则校验（SPARK-004/006）有了更精确的作用对象

**定位**：nerve-hub 是 A2A 生态的**网关**，而非 A2A 的一个节点。
对外可暴露 A2A 兼容接口（任何 A2A 客户端能推任务进来），
对内继续用现有架构管理所有 Agent，包括永远不会支持 A2A 的 Manual Agent。

**不做的事**：不强制要求 Agent 实现 A2A 接口，不废弃 Manual/Webhook 类型，不现在就加 SSE 流式传输。

---

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

## SPARK-011 · 多 Agent 内容质量漏斗

**日期**：2026-04-24
**来源**：讨论如何管理来自不同 Agent 的产品洞见

**问题**：
多 Agent 协作产生的内容（洞见、规则、代码、建议）质量参差不齐。
不能事先屏蔽任何来源（偶尔有好想法），但也不能让低质量内容污染核心资产。

**解决模式：两级漏斗，宽进严出。**

```
任意 Agent 的原始想法
        ↓
  SPARK-INBOX.md       ← 宽进，格式轻量，来者不拒
        ↓
   Editorial Review    ← Neil + Claude 定期 triage
        ↓
    SPARKS.md          ← 严出，完整格式，经过确认
```

**关键原则**：
- 质量控制发生在**升格**这一步，不是收集这一步
- Editorial 判断不能自动化——"这个洞见值不值得留"需要人的产品直觉
- Claude 负责快速筛选、补完格式、找关联；Neil 做最终拍板

**同构性**：
这个模式和代码 PR review、任务验收（三件套）是同一结构——
多源输入 → 质量门禁 → 核心资产。nerve-hub 的任务 inbox 也是同一个模式的实例。

**产品延伸**：
Rule 的提交与审核（RuleStore，SPARK-003）可以复用同一套漏斗逻辑：
任何 Agent 可以提交候选 Rule 到 Rule Inbox，经审核后才进入 RuleStore 正式发布。

---

*新增 Spark 请按 SPARK-XXX 编号，日期 + 来源 + 洞见 + 价值 + 延伸方向。*
