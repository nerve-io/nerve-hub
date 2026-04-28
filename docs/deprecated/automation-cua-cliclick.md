# automation-cua-cliclick

## 特性目标

让 AI Agent 能够通过 GUI 自动化（cua-driver + cliclick）操作 macOS 原生应用，打通 Agent 自动化的"最后一米"——即 Agent 可以直接点击、输入、读取 UI 元素，而不需要人工介入操作 GUI。

核心场景：让 CUA Agent 自动执行 GUI 测试任务（如操作计算器验证 UI 交互）。

## 实现摘要

### 新增文件
- **`src/cua-agent.ts`**（~1020 行） — CUA GUI Agent daemon
  - HTTP server on port 3143，接收 webhook 任务
  - 解析 `GUI_TASK` YAML 格式的任务描述
  - 支持 `launch_app`、`click`、`click_element`（按 label 查找元素并点击）、`get_window_state` 等步骤
  - 通过 inbox 文件协议回写结果到 nerve-hub
  - 自动注册为 webhook agent，发送心跳
  - 启动时检查 Accessibility 权限
  - App 白名单机制（通过 env var 或 hub metadata 配置）
- **`scripts/setup-cua.sh`** — cua-driver 安装与权限配置脚本
- **`package.json`** — 新增 `cua` 和 `setup:cua` 脚本

### 修改文件
- `src/daemon.ts` — 类型超时分级（research/code/critical/default），`type` 字段透传（通用改进，保留）
- `src/runner.ts` — dispatch payload 中新增 `type` 字段（通用改进，保留）

### 关键 commit
- `732968e` — fix: daemon reliability + cua-agent + inbox path decoupling + docs restructure

## 下线原因

时机不对。当前产品阶段是"核心任务调度稳定 + 人工掮客流程跑通"，GUI 自动化属于过早投入。核心多产品任务协调流程尚未稳定运行，在 GUI 自动化上继续深入会分散注意力。

产品复盘判断：应等核心任务调度和人工掮客流程稳定运行后再考虑捡回此特性。

## 关键引用

- 相关 SPARK：022（GUI 自动化脚本）、023（GUI 自动化的编译模型）、024（审批感知监控）
- 已被移除的文件：`src/cua-agent.ts`、`scripts/setup-cua.sh`
- 相关测试任务：`9df4c0d5`、`cc66a2aa`、`8347e621`、`4c0d7414`、`db4bc65a`、`0d9bb581`、`5812b361`（均为 CUA 测试任务，状态 done/failed）

## 重新引入的前置条件

1. 核心任务调度在多 Agent 协作下稳定运行 ≥2 周
2. 人工掮客流程（需求拆解 → 派发 → 验收）已跑通，不再需要 Neil 频繁介入
3. 有明确的 GUI 自动化需求（例如需要操作无法通过 API 交互的第三方应用）
4. 确认 cua-driver CLI 的 API 稳定，不会频繁 breaking change
