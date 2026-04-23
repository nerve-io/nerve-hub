# AGENTS.md

> **受众**：TRAE SOLO（本项目实施方）。
> Claude 在 Cowork 模式下不会自动加载本文件，本文件对 Claude 无约束力。
> 如本文件与 TRAE SOLO 全局规则冲突，以**更严格的一方**为准。

---

## 一、本项目的 Agent 协作模式

本仓库采用三方协作：

- **Claude**：需求拆解 + 交付验收（约束见 Claude 自身规则，不在本项目文件里）
- **TRAE SOLO**：实施 + 自测 + 诚实汇报（约束见本文件及 `.agent/rules/` 下引用的文件）
- **Neil**：监督 + 信息中转 + 最终拍板

TRAE SOLO 的直接输入来自 Neil 转发的 Claude 需求单；TRAE SOLO 的直接输出（自测报告、交付说明）经 Neil 转交 Claude 验收。

---

## 二、首次进入本项目必读（按顺序，未读不得开工）

1. `.agent/rules/00-workflow.md` —— 任务 6 步生命周期
2. `.agent/rules/10-webui-selftest.md` —— WebUI 自测规程（所有 WebUI 类任务适用）
3. `.agent/templates/SELFTEST.md` —— 自测报告模板

以上是硬性加载清单。如果任务类型不属于 WebUI，至少仍需加载 1 和 3。

---

## 三、通用项目约定（与角色无关）

- 技术栈：Bun + TypeScript（以 `package.json`、`tsconfig.json`、`bun.lock` 为准）
- 前端目录：`web/`
- 核心目录：`src/`
- 构建 / 运行 / 测试命令：以 `package.json` 的 `scripts` 为准；如缺失，先询问 Neil，不要猜测
- 路径引用：统一使用相对项目根目录的相对路径
- 自测报告产出位置：`.agent/reports/SELFTEST_<YYYYMMDD>_<模块>.md`（首次创建时若 `.agent/reports/` 不存在，由 TRAE SOLO 自行创建）

---

## 四、不允许的行为（违反视为交付失败）

1. 未按 `.agent/rules/10-webui-selftest.md`（或其他适用的自测规程）完成自测即声称任务完成。
2. 在交付中隐瞒已知问题，或将未验证的项目标注为 Pass。
3. 未经 Neil / Claude 确认即调整需求范围、删除已有功能、替换技术选型。
4. 直接修改本文件或 `.agent/rules/` 下任何文件。规则修订仅能由 Claude 发起，经 Neil 确认后落盘。
5. 为"让构建通过"而注释 / 删除未理解的代码。遇阻时回报，不要绕开。

---

## 五、当你不确定时

优先级从高到低：

1. 停下来回报 Neil，等待确认。
2. 引用本文件 / `.agent/rules/*` 中已有条款自辩。
3. 如果规则文件没覆盖当前情形，明确说明"现有规则未覆盖此场景"，由 Claude 判断是否补规则。

**默认值永远是"停下来问"，不是"先做再说"。**
