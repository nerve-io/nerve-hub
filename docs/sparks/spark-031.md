# SPARK-031 · 非 VLM 低延时 GUI 图像识别引擎

**成熟度**：🔵 中期规划

## 背景

wake-claude 链路目前是"盲打"：脚本直接发 Cmd+V+Enter，假设 Claude Desktop 当前处于对话输入页。如果用户恰好在设置页、侧边栏、或其他 Agent 的会话，消息会发错地方或失败。

## 需求

能在 wake-claude 执行前识别 Claude Desktop 的当前 GUI 状态：
- 当前是否处于对话输入页
- 输入框位置（用于精确 click 而非盲打 Cmd+V）
- 能识别页面上的关键文本/颜色/形状要素

## 约束

- **不依赖 VLM**：不调用任何大语言模型 / 视觉模型，零 token 消耗
- **低延时**：识别耗时 < 100ms，不影响 wake 链路响应速度
- **纯本地**：macOS 优先，无网络依赖
- 失败时优雅降级（回退到当前盲打模式，不崩溃）

## 调研方向

| 方案 | 原理 | 评估维度 |
|------|------|---------|
| OpenCV template matching | 截图与模板图对比 | 延时、稳定性、macOS 兼容 |
| SikuliX | Java + OpenCV GUI 识别 | 依赖复杂度 |
| PyAutoGUI screenshot compare | PIL 像素比对 | 延时、精度 |
| Apple Vision framework | macOS 原生文本识别 | 延时、语言绑定 |
| Accessibility API (AXUIElement) | macOS 原生无障碍树 | 精度、获取难度 |

**优先看 macOS Accessibility API**：可直接拿到 UI 元素树，无需图像识别，延时极低，比截图比对更可靠。

## 与 SPARK-028 的关系

SPARK-028 解决 daemon 可观测性，SPARK-031 解决 wake-claude 的"眼睛"问题——两者都属于从能跑到可靠这个大方向，但实现路径完全独立。

## 2026-04-27 更新（基于 R8 调研）

**优先级降低**。R8 调研发现：

- **Windows-MCP**（★5.4K）已证明 macOS Accessibility API（AXUIElement）路径可行，且无需 VLM
- **Cua** 若顺利接入，wake-claude 的"眼睛"问题可直接借助 Cua 的 UI 理解能力解决，不需要单独的识别引擎

**调整方向**：
1. 待 Cua 可行性调研（R9）完成后，重新评估本 SPARK 是否仍有独立价值
2. 若 Cua 无法满足 wake-claude 场景（低延时 <100ms 要求），再启动本 SPARK 的自研方向
3. 成熟度：🔵 → 暂缓，依赖 R9 结论

## 来源

Neil，2026-04-27，SPARK-INBOX
