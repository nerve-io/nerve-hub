# SPARK-035 · nerve-hub 统一配置中心

> 状态：草稿
> 日期：2026-04-28
> 来源：cua-agent 白名单配置体验讨论

---

## 背景

当前 nerve-hub 有 18 个可配置项，分散在三个地方：

1. **环境变量**（14 个）：终端设置，重启失效，改一次很麻烦
2. **DB agents.metadata**（1 个）：WebUI 可编辑，但格式无校验、无引导
3. **DB agents.rules/capabilities**（2 个）：WebUI 可编辑，内容靠人肉维护

用户调整一个 agent 的行为需要同时操作终端 + WebUI，没有统一心智模型。

## 核心主张

**一切可配置项必须有一个统一的入口，这个入口就是 WebUI。** env var 降级为开发者 escape hatch 和出厂默认值。

## 设计方案

### 三层配置模型

```
WebUI（用户入口，编辑后持久化到 DB）
  ↓ 覆盖
Agent 本地配置（启动时从 hub API 拉取，运行时使用）
  ↓ 覆盖
环境变量（出厂默认值 + 开发者 escape hatch）
```

优先级：**WebUI > env var > 硬编码默认值**

### 存储位置

| 配置项 | 存储 | 原因 |
|--------|------|------|
| Agent 行为规则 | `agents.rules` | 已有，不变 |
| Agent 能力声明 | `agents.capabilities` | 已有，不变 |
| **所有其他配置** | `agents.metadata`（JSON） | 白名单、超时、端口、API key 等统一收敛 |

`metadata` 字段已经是 JSON，天然支持结构化配置。用一个字段兜住所有 Agent 级配置，避免炸裂出更多 env var 和 DB 列。

### WebUI 交互

**Agent 详情页新增「配置」Tab**

- 以表单形式展示 metadata 中的配置项
- 每个配置项有：名称、说明、当前值、类型约束
- 修改后点保存，调用 `PATCH /api/agents/:id` 更新 metadata
- Agent 下一次 heartbeat 响应中带有配置版本号，检测到变更后自动重载

### CLI 工具

新增 `nerve-hub config` 子命令，让非 WebUI 用户也能快速配置：

```bash
# 查看当前 agent 配置
nerve-hub config get cua-agent

# 设置白名单
nerve-hub config set cua-agent allowedBundleIds '["com.apple.calculator"]'

# 删除配置项，回退到 env var / 默认值
nerve-hub config unset cua-agent timeoutGui

# 导出当前有效配置（含优先级标注）
nerve-hub config export cua-agent
```

### 配置 schema 定义

每个 Agent 类型声明自己支持的配置项 schema（存在 `agents.metadata.configSchema` 或单独的 `skills/` 文件中）：

```json
{
  "configSchema": {
    "allowedBundleIds": {
      "type": "array",
      "items": { "type": "string" },
      "description": "允许操控的 macOS 应用 bundle ID 列表。空数组 = 全部拒绝。",
      "default": []
    },
    "timeoutGui": {
      "type": "number",
      "minimum": 10,
      "maximum": 600,
      "description": "GUI 任务超时时间（秒）",
      "default": 120
    }
  }
}
```

WebUI 根据 schema 自动渲染表单控件（文本输入、数值滑块、数组编辑器、下拉选择等）。

### 实现路径

**Phase 1**（最小可用）：
1. cua-agent 启动时从 hub API 拉取 metadata，读取配置
2. WebUI Agent 详情页展示 metadata JSON（可编辑）

**Phase 2**（表单化）：
3. Agent metadata 中定义 `configSchema`
4. WebUI 根据 schema 渲染表单控件

**Phase 3**（CLI 工具）：
5. MCP 新增 `config_get` / `config_set` 工具
6. 支持通过 `nerve-hub config` CLI 命令操作

## 非目标

- 不做「配置版本管理」（git 跟踪 env 文件即可）
- 不做「配置热更新推送」（heartbeat 轮询已够用）
- 不做「多项目配置继承」（当前只一个项目）

## 关联

- SPARK-005：「确定性归代码，非确定性归 Agent」
- cua-agent app whitelist 是此设计的第一批受益者
- 与 OCR/GUI 自动化配合：用户通过 WebUI 定义「允许操控哪些 app」
