# cua-agent

通过 cua-driver CLI 在 macOS 上执行 GUI 自动化任务。cua-agent 是一个 Bun HTTP 守护进程，接收 Runner 派发的 webhook 任务并逐步调用 cua-driver 工具。

## 何时使用本 SKILL

| 场景 | 推荐方式 |
|------|----------|
| 需要操控 macOS GUI 应用（点击、输入、截图） | 创建带 GUI_TASK 块的任务，由 cua-agent 执行 |
| 需要自动化测试桌面应用 | 同上 |
| 需要获取应用 UI 树状态 | 使用 get_window_state 步骤 |
| 纯代码、无 GUI 需求 | 使用 claude-code daemon 或 trae-solo |

## 前置条件

1. **cua-driver 已安装**：`~/.local/bin/cua-driver`（运行 `bun run setup:cua` 安装）
2. **Accessibility 权限已授权**：系统设置 → 隐私与安全性 → 辅助功能
3. **nerve-hub 已启动**：`bun run start` 或 `bun run dev`

## 启动

```bash
bun run cua
```

启动后会自动：
- 检查 Accessibility 权限
- 启动 cua-driver daemon（如需）
- 注册为 webhook agent 到 hub
- 每 30s 发送心跳

端口：`127.0.0.1:3143`（`CUA_PORT` 环境变量可覆盖）

## GUI_TASK 任务格式

在任务描述（description / briefing）中嵌入 `GUI_TASK:` 块。Runner 会将任务的 briefing 字段通过 webhook 发送给 cua-agent。

### 基本格式

```
GUI_TASK:
app: <应用名 或 bundle_id>
steps:
  - launch_app: {bundle_id: "com.apple.calculator"}
  - click: {pid: auto, x: 100, y: 200}
  - type_text: {text: "hello"}
  - get_window_state: {pid: auto}
```

### app 字段

- **bundle_id**（推荐）：如 `com.apple.calculator`、`com.google.Chrome`
- **应用名**：如 `Calculator`、`Google Chrome`（通过 `/Applications` 解析）

### steps 字段

每条步骤格式：`  - <工具名>: <JSON 参数>`

### PID auto 解析

`pid: auto` 表示 cua-agent 自动查找应用的进程 ID：
1. 如果 `app` 是 bundle_id，通过 `list_apps` 查找对应 PID
2. 如果步骤中包含 `launch_app`，cua-agent 会从 `launch_app` 的返回值中获取 PID 并用于后续步骤
3. 如果应用未运行，应先使用 `launch_app` 步骤启动

## 常用工具速查

### launch_app — 启动应用

后台启动 macOS 应用（不激活窗口）。

```yaml
- launch_app: {bundle_id: "com.apple.calculator"}
- launch_app: {name: "Calculator"}
```

**参数**：`bundle_id`（推荐）或 `name`，可选 `urls`、`electron_debugging_port`、`webkit_inspector_port`、`additional_arguments`、`creates_new_application_instance`

**返回**：`{pid, bundle_id, name, active, windows: [{window_id, title, bounds, ...}]}`

### list_apps — 列出所有应用

列出已安装和运行中的应用。

```yaml
- list_apps: {}
```

**返回**：`{apps: [{bundle_id, name, pid, running, active}]}`

### get_window_state — 获取窗口 UI 树

获取指定窗口的 Accessibility 树和截图。

```yaml
- get_window_state: {pid: 12345, window_id: 42}
- get_window_state: {pid: auto}
```

**参数**：`pid`（必填）、`window_id`（如不指定则使用应用的主窗口）、可选 `query`（过滤 UI 树）、`javascript`（在浏览器中执行 JS）

**返回**：包含 `tree_markdown`（可操作的 UI 元素，每个带 `[element_index N]`）、`screenshot_base64`、`element_count` 等

### click — 点击

两种模式：
1. **坐标点击**（推荐简单场景）：指定 `x`、`y`（窗口截图坐标，以左上角为原点）
2. **元素点击**：指定 `element_index`（来自 `get_window_state` 的索引）+ `window_id`

```yaml
# 坐标点击
- click: {pid: auto, x: 200, y: 150}

# 元素点击（需先 get_window_state）
- click: {pid: auto, window_id: 42, element_index: 5}

# 双击
- click: {pid: auto, x: 200, y: 150, count: 2}

# 右键（通过 element_index）
- click: {pid: auto, window_id: 42, element_index: 5, action: show_menu}
```

### type_text — 输入文本

向目标应用的当前焦点元素插入文本。

```yaml
- type_text: {pid: auto, text: "Hello World"}
```

**参数**：`pid`（必填）、`text`（必填）、可选 `element_index` + `window_id`（先聚焦指定元素再输入）

注意：不模拟按键，特殊键（回车、方向键等）需用 `press_key` 或 `hotkey`。

### press_key — 按键

```yaml
- press_key: {pid: auto, key: "return"}
- press_key: {pid: auto, key: "escape"}
```

### hotkey — 组合键

```yaml
- hotkey: {pid: auto, key: "q", modifier: ["cmd"]}
- hotkey: {pid: auto, key: "c", modifier: ["cmd"]}
```

### screenshot — 截图

```yaml
- screenshot: {pid: auto}
```

## 超时

GUI 任务默认超时 **120 秒**。可通过 `DAEMON_TIMEOUT_GUI` 环境变量设置（单位：秒）：

```bash
DAEMON_TIMEOUT_GUI=300 bun run cua
```

## 任务回填

cua-agent 执行完成后，通过 **inbox 文件协议**回填结果：
- 写入 `.nerve/inbox/<taskId>.done.json`
- 服务端每 5 秒轮询，自动将任务标记为 done/failed

## 完整示例

### 示例 1：打开计算器并输入

```
GUI_TASK:
app: com.apple.calculator
steps:
  - launch_app: {bundle_id: "com.apple.calculator"}
  - click: {pid: auto, x: 200, y: 150}
  - type_text: {pid: auto, text: "123+456"}
  - press_key: {pid: auto, key: "return"}
  - get_window_state: {pid: auto}
```

### 示例 2：获取 Finder 窗口状态

```
GUI_TASK:
app: com.apple.finder
steps:
  - get_window_state: {pid: auto}
```

### 示例 3：Safari 打开网页

```
GUI_TASK:
app: com.apple.Safari
steps:
  - launch_app: {bundle_id: "com.apple.Safari", urls: ["https://example.com"]}
  - get_window_state: {pid: auto, query: "address"}
```

## 可用工具完整列表

| 工具 | 说明 |
|------|------|
| `check_permissions` | 检查权限状态 |
| `click` | 左键点击（坐标或元素索引） |
| `double_click` | 双击 |
| `right_click` | 右键点击 |
| `get_accessibility_tree` | 获取完整 AX 树 |
| `get_window_state` | 获取窗口 UI 树 + 截图 |
| `get_screen_size` | 获取屏幕尺寸 |
| `get_cursor_position` | 获取鼠标位置 |
| `hotkey` | 组合键 |
| `launch_app` | 启动应用 |
| `list_apps` | 列出应用 |
| `list_windows` | 列出窗口 |
| `move_cursor` | 移动鼠标 |
| `page` | 浏览器页面操作（CDP） |
| `press_key` | 按键 |
| `screenshot` | 截图 |
| `scroll` | 滚动 |
| `set_value` | 设置控件值 |
| `type_text` | 输入文本 |
| `type_text_chars` | 逐字符输入 |
| `zoom` | 缩放截图区域 |

## 健康检查

```bash
curl http://localhost:3143/health
# {"ok":true,"agent":"cua-agent","online":true,"active":0,"driver":"/Users/xxx/.local/bin/cua-driver"}
```
