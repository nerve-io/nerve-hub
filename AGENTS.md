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

### 依赖安装（跨架构隔离，必须遵守）

本项目在 **amd64 沙箱**（TRAE SOLO）和 **arm64 本地机**（Neil）之间共享目录。
`node_modules` 包含平台相关二进制（esbuild 等），两个架构的产物**不可混用**。

**规则：绝对不允许直接运行 `bun install`。**
必须通过以下命令安装依赖，脚本会自动隔离到 `node_modules.<arch>/` 并更新 symlink：

```bash
bun run setup          # 等价于 bash scripts/setup.sh
```

每次开始任务前，若 `bun.lock` 有变化（或不确定），先运行 `bun run setup`。
未执行 setup 直接运行的测试/构建结果视为无效。

---

## 四、任务回填 SOP

### 主路径：直接调用 MCP 工具（推荐）

你已通过 **MCP 软件集成**接入了 nerve-hub（与你使用其他 MCP 工具的方式完全相同）。
完成工作后，直接调用：

```
complete_task
  id:     "<任务简报中的任务 ID>"
  result: "一段话描述你完成了什么、关键输出是什么"
```

**重要区分：**
- ✅ 正确：通过你的 MCP 集成调用 `complete_task` 工具（软件层，nerve-hub 已配置好）
- ❌ 错误：`curl localhost:3141` 或任何 HTTP/CLI 命令（MCP 是 stdio 协议，不是 HTTP，CLI 调用不可行）
- ❌ 错误：试图在沙箱中启动或连接 MCP 进程（MCP server 运行在宿主机，不是你的沙箱）

### 备选路径：文件投递（MCP 集成不可用时）

如果你当前上下文中没有 `complete_task` 工具，在仓库中写入：

```
.nerve/inbox/<taskId>.done.json
```

```json
{
  "taskId": "<任务ID>",
  "result": "一段话描述结果"
}
```

nerve-hub 每 5 秒轮询该目录，自动完成回填，无需人工干预。

---

## 五、产品洞见提交（Spark Inbox）

在实施过程中，如果你对产品方向、架构设计、协作模式有任何想法或观察——
无论多粗糙，都可以追加到仓库根目录的 `SPARK-INBOX.md` 的"待 Review"区块：

```
- [TRAE SOLO] [YYYY-MM-DD] 一句话描述你的想法
```

这不是强制要求，但受欢迎。Neil 和 Claude 会定期 review，值得的会升格为正式 Spark。

---

## 七、不允许的行为（违反视为交付失败）

1. 未按 `.agent/rules/10-webui-selftest.md`（或其他适用的自测规程）完成自测即声称任务完成。
2. 在交付中隐瞒已知问题，或将未验证的项目标注为 Pass。
3. 未经 Neil / Claude 确认即调整需求范围、删除已有功能、替换技术选型。
4. 直接修改本文件或 `.agent/rules/` 下任何文件。规则修订仅能由 Claude 发起，经 Neil 确认后落盘。
5. 为"让构建通过"而注释 / 删除未理解的代码。遇阻时回报，不要绕开。

---

## 八、当你不确定时

优先级从高到低：

1. 停下来回报 Neil，等待确认。
2. 引用本文件 / `.agent/rules/*` 中已有条款自辩。
3. 如果规则文件没覆盖当前情形，明确说明"现有规则未覆盖此场景"，由 Claude 判断是否补规则。

**默认值永远是"停下来问"，不是"先做再说"。**
