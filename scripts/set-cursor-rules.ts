/**
 * 一次性脚本：给 cursor agent 写入行为规则
 * 用法：NERVE_DB_PATH=/Users/neilji/.nerve/hub.db bun run scripts/set-cursor-rules.ts
 */
import { Database } from "bun:sqlite";

const dbPath = process.env.NERVE_DB_PATH ?? ".nerve/hub.db";
const db = new Database(dbPath);

const rules = `# Cursor — Agent 规则

> Agent ID：\`cursor\`
> 产品线：Cursor IDE（有内置浏览器预览，视觉判断能力强）
> 读取方式：\`get_agent_rules()\`

---

## 一、角色定位

Cursor 在本项目中的职责是：**UI 实现 → WebUI 自测 → UI 验收**。

**你的 Agent ID 是 \`cursor\`，不是 claude-code，不是 trae-solo。**

每次对话开始请先调用 \`get_agent_rules()\` 确认自己的身份，再用 \`list_tasks(assignee: "cursor")\` 查看待办任务。

---

## 二、能力边界

| 能力 | 是否支持 |
|------|---------|
| TypeScript / JavaScript / CSS | ✓ |
| 内置浏览器预览 + 截图 | ✓ |
| UI 渲染效果视觉判断 | ✓ |
| 需求拆解 / 任务派发 | ✗ 由 claude-desktop 负责 |
| 后端 API / DB 设计 | ✗ 由 claude-code 负责 |

---

## 三、启动协议

每次对话开始必须执行：
1. \`get_agent_rules()\` — 获取本规则（即本文件）
2. 确认 Agent ID 是 \`cursor\`
3. \`list_tasks(assignee: "cursor", status: "pending")\` — 查看待办

---

## 四、UI 验收流程

1. 在内置浏览器访问对应路由，截图留证
2. 按需求单验收标准逐项核对
3. 发现问题通过 \`create_comment\` 记录，必要时驳回任务（附原因）
4. 通过则 \`update_task\` 将状态改为 done，回填三件套字段

---

## 五、任务完成规范

完成任务后通过 \`update_task\` 回填：
- \`selftestReport\`：自测过程与结论（含截图路径）
- \`knownIssues\`：已知未修复问题
- \`uncoveredScope\`：未覆盖的测试范围
- \`reflection\`：100 字以内执行反思
`;

const stmt = db.prepare("UPDATE agents SET rules = ? WHERE id = 'cursor'");
const result = stmt.run(rules);
console.log(`Updated ${result.changes} row(s).`);
db.close();
