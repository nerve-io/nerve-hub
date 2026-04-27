## SPARK-014 · 局域网多设备协作——nerve-hub 作为局域网任务中枢

**日期**：2026-04-25
**来源**：Neil 提出，考虑不同设备（Mac、iPad、手机等）在局域网内共享同一个 nerve-hub 实例

**洞见**：
nerve-hub 目前默认绑定 `localhost`，只有启动它的那台设备能访问。
但实际协作场景里，Neil 可能在 Mac 上运行 nerve-hub，同时想在 iPad 上看任务看板，
或者 TRAE SOLO 跑在另一台机器上，需要通过网络访问 nerve-hub MCP。

**局域网协作的几个子问题**：
1. **WebUI 访问**：`dev server` 改为监听 `0.0.0.0` 即可，局域网内任意设备打开 `192.168.x.x:5173` 就能看到看板——这是最低成本的方案
2. **MCP 访问**：MCP 目前是 stdio 协议（本机进程间通信），不能直接跨网络。跨设备 MCP 需要转成 HTTP/SSE transport（MCP 规范已支持），这是中等复杂度的改造
3. **身份与安全**：局域网内是否需要认证？多个用户同时操作如何防冲突？
4. **移动端体验**：WebUI 是否响应式？在 iPad/手机上是否可用？

**近期可做（低成本）**：
- `dev server` 和 `api server` 支持通过环境变量 `NERVE_HOST=0.0.0.0` 监听所有接口
- WebUI 适配移动端（响应式布局）
- 文档：说明如何在局域网内访问

**中期可做**：
- MCP over HTTP/SSE transport，让其他设备上的 AI 工具也能接入 nerve-hub MCP
- 简单的 token 认证（`NERVE_TOKEN` 环境变量），避免局域网内任意人访问

**产品价值**：
nerve-hub 从"单机工具"变成"家庭/小团队任务中枢"，一台 Mac mini 或树莓派常驻运行，
任何设备都能查看和管理 AI Agent 的工作进展——这是从个人工具到团队工具的关键一跳。

---

---
