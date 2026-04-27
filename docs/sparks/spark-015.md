## SPARK-015 · 魔法书归位——Task 状态流转动画

**日期**：2026-04-25
**来源**：Neil，看板 task card 瞬移体验太生硬，想要哈利波特魔法图书馆既视感

**洞见**：
当 task card 状态变更时（如 pending→running、running→done），
card 不应该"消失再出现"，而应该**飞跃**——从原来的列物理移动到目标列，
带着弧线轨迹、缓动曲线、轻微旋转，像一本书自己飞回书架归位。

这不只是视觉炫技，而是**传达语义**：用户能直觉感知到"是哪张 card 动了、去了哪里"，
比瞬移更清晰，比文字提示更生动。状态机的流转在视觉上得到了真实呈现。

**技术路径**：
- **FLIP 动画**（First-Last-Invert-Play）：记录 card 初始位置 → DOM 重排 → 计算位移差 → CSS transform 反向播放
  - 库选项：`@formkit/auto-animate`（一行接入）、`framer-motion` 的 `layoutId`（最强但最重）、手写 FLIP
- **弧线轨迹**：纯 CSS transform 只能走直线；弧线需要 JS 控制中间帧（keyframes + cubic-bezier），或 SVG path 动画
- **旋转 + 缩放**：card 飞行途中轻微旋转（±5°）+ 先缩小后放大，模拟书翻飞的立体感
- **目标列高亮**：card 落入目标列的瞬间，目标列闪烁一下（pulse），强化"归位"的满足感

**实现难度分级**：
1. 🟢 简单版：`@formkit/auto-animate`，直线移动 + 淡入淡出，1小时内接入
2. 🟡 进阶版：`framer-motion` layoutId，跨列平滑移动，半天工作量
3. 🔴 魔法版：FLIP + 自定义弧线轨迹 + 旋转 + 目标列 pulse，接近哈利波特既视感，1-2天

**产品价值**：
nerve-hub 的主要用户是 AI Agent，但看板是给**人**看的。
炫酷的动画让"看着 Agent 干活"这件事变得有趣、有仪式感——
这是从工具向**体验**跨越的关键一步，也是差异化记忆点。

**延伸**：
- 任务完成时的"烟花/粒子"庆祝特效（done 状态专属）
- Agent 上线时的"入场动画"（Agents 列表）
- 整体引入 Motion Design System，让所有状态变更都有统一的动效语言

---
