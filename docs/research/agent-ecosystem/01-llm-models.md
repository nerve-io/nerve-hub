数据基准：2026-04-30

## LLM API 定价对比

| 模型 | 输入$ | 输出$ | 上下文 | 缓存折扣 |
|------|-------|-------|--------|---------|
| DeepSeek V4 Flash ⚠️行动前验证 | 0.14 | 0.28 | 1M | 90%→$0.028 |
| DeepSeek V4 Pro ⚠️行动前验证 | 1.74 | 3.48 | 1M | — |
| GPT-5.4 Nano ⚠️行动前验证 | 0.20 | 1.25 | 400K | Auto |
| GPT-5.4 Mini ⚠️行动前验证 | 0.75 | 4.50 | 400K | Auto |
| GPT-5.4 ⚠️行动前验证 | 2.50 | 15.00 | 272K | — |
| GPT-5.5 ⚠️行动前验证 | 5.00 | 30.00 | 1M | — |
| Gemini 3.1 Flash Lite ⚠️行动前验证 | 0.25 | 1.50 | 1M | 分级 |
| Gemini 3 Flash ⚠️行动前验证 | 0.50 | 3.00 | 1M | 分级 |
| Gemini 3.1 Pro ⚠️行动前验证 | 2.00 | 12.00 | 1M | 分级 |
| Claude Haiku 4.5 ⚠️行动前验证 | 1.00 | 5.00 | 200K | Manual |
| Claude Sonnet 4.6 ⚠️行动前验证 | 3.00 | 15.00 | 1M | Manual |
| Claude Opus 4.7 ⚠️行动前验证 | 5.00 | 25.00 | 1M | Manual |

> 美元/百万tokens。DeepSeek V4 Pro 为 2.5 折促销价（截至 2026-05-31）⚠️行动前验证。

## 推荐组合（高消耗 Prose 任务）

### 极致性价比 ★★★★★
**DeepSeek V4 Flash + Claude Code 框架**。V4 Flash 执行高消耗调研（90% 缓存折扣后近乎免费），Claude Opus 做最终产出。月成本 ~$30-50。

### 品质优先 ★★★★
**Claude Sonnet 4.6 + Gemini 3 Flash 混合**。Gemini 处理大文档/多源信息（1M 上下文），Sonnet 负责分析报告。月成本 ~$200-300。

### 零成本探索 ★★★
**Gemini 2.5 Flash 免费层**（仅此模型仍免费）。适合 prototyping，500 req/天。

## 数据新鲜度风险
- **API 定价**：周级别过期风险。DeepSeek V4 Pro 促销 2026-05-31 过期后恢复 ¥12/¥24 ⚠️行动前验证
- **模型版本**：月级别过期风险。GPT/Claude/Gemini 每 2-4 月发新版
- **旧版下线**：DeepSeek 旧模型名（deepseek-chat/reasoner）将于 2026-07-24 弃用 ⚠️行动前验证
- **Gemini 免费层**：2026-04-01 起 Pro/Flash 全部转付费，仅 2.5 Flash 仍免费 ⚠️行动前验证
