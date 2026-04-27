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
