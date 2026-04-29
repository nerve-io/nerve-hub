# SPARK-038 · MoE 架构启示——多 Agent 协作的理论基础

**成熟度**：🟡 近期可做（作为产品叙事和设计原则的理论锚点）

## 核心洞察

混合专家（Mixture of Experts）是目前最主流的 LLM 底层架构。其核心机制：**稀疏激活**——每次推理只激活最匹配的专家子网络，而非全量激活。

这与 nerve-hub 多 Agent 协作的直觉高度吻合：

> 复杂任务的最优解不是一个全能模型，而是多个独立专家按需协作、形成互补。1+1>2。

## 对应关系

| MoE 概念 | nerve-hub 对应 |
|---------|---------------|
| 专家网络（Expert Network） | 专长 Agent（cursor/UI, claude-code/后端, claude-web/调研）|
| 门控网络（Gating Network） | Orchestrator（claude-desktop）路由决策 |
| 稀疏激活 | 按任务类型只派发给匹配的 Agent，不广播 |
| 专家容量上限 | Agent 并发任务数限制（WIP 控制）|
| 专家混合输出 | 多 Agent 交付合并（handoff queue → orchestrator 整合）|

## 延伸方向

**1. 从架构论文中提炼 Agent 协作范式**

MoE 的启示表明，顶级 LLM 学术论文往往蕴含多 Agent 系统设计的最佳实践。建议建立定期调研机制：
- 架构演进：Transformer → MoE → SSM/Mamba → 下一代
- 多 Agent 系统论文：AutoGen、AgentBench、Society of Mind 等
- 提炼可映射到 nerve-hub 的设计原则（见调研任务 R10）

**2. 产品叙事价值**

「nerve-hub 是 LLM 内部 MoE 架构在系统层的复现」——这句话可以成为对技术受众解释产品逻辑的有效切入点，尤其在 0→1 阶段找早期用户时。

**3. 对 Agent 能力路由的设计启示**

MoE 的门控网络需要学习"哪类输入送给哪个专家"。nerve-hub 的自动派单（spark-019）同理：需要积累任务-Agent 匹配的历史数据，才能做到精准路由。这意味着当前人工派单阶段积累的数据是未来自动路由的训练素材——应该有意识地记录。

## 关联

- **spark-019**（Agent 能力路由）：037 的理论基础
- **spark-007**（产品层协调，而非框架层协调）：MoE 也是在"协调层"做文章，不修改专家网络本身

## 来源

Neil，2026-04-29，观察 MoE 架构与 nerve-hub 多 Agent 协作的结构相似性
