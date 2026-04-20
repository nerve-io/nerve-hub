/**
 * Nerve Hub MVP 端到端测试
 * 测试场景：Claude Desktop (模拟) ↔ Nerve Hub ↔ MuleRun (模拟 REST API 调用)
 */
import { NerveCore } from '../src/core/engine.js';
import { createApp } from '../src/api/index.js';
import Fastify from 'fastify';

const DB_PATH = './test-e2e.db';
let core: NerveCore;
let api: Fastify.FastifyInstance;

async function setup() {
  core = new NerveCore(DB_PATH);
  api = Fastify();
  await createApp(api, core);
  await api.listen({ port: 0 }); // 随机端口
  const port = (api.server.address() as any).port;
  console.log(`API server on http://127.0.0.1:${port}`);
  return port;
}

async function teardown() {
  await api.close();
  core.close();
  // 清理测试 DB
  const fs = await import('fs');
  try { fs.unlinkSync(DB_PATH); } catch {}
}

async function fetchJSON(port: number, path: string, options: RequestInit = {}) {
  const url = `http://127.0.0.1:${port}${path}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  return { status: res.status, body: await res.json() };
}

// ========== 测试用例 ==========

async function testProjectCRUD(port: number) {
  console.log('\n📋 测试: 项目 CRUD');

  // 创建项目
  const { status, body: proj } = await fetchJSON(port, '/projects', {
    method: 'POST',
    body: JSON.stringify({ name: 'nerve-demo', description: 'Nerve Hub 演示项目' }),
  });
  console.assert(status === 201, `创建项目应返回 201，实际 ${status}`);
  console.assert(proj.name === 'nerve-demo', `项目名应为 nerve-demo，实际 ${proj.name}`);
  console.assert(!!proj.id, '项目应有 ID');
  console.log(`  ✅ 创建项目: ${proj.id}`);

  // 查询项目列表
  const { body: projects } = await fetchJSON(port, '/projects');
  console.assert(projects.length >= 1, '项目列表应至少有 1 个');
  console.log(`  ✅ 查询项目列表: ${projects.length} 个`);

  return proj.id;
}

async function testTaskCRUD(port: number, projectId: string) {
  console.log('\n📋 测试: 任务 CRUD');

  // Claude Desktop 创建任务
  const { status, body: task } = await fetchJSON(port, '/tasks', {
    method: 'POST',
    headers: { 'X-Nerve-Agent': 'claude-desktop' },
    body: JSON.stringify({
      projectId,
      title: '实现 JWT 认证模块',
      description: '基于 jsonwebtoken 实现 login/register/refresh',
      type: 'code',
      priority: 'high',
      assignee: 'claude-desktop',
      tags: ['auth', 'backend'],
    }),
  });
  console.assert(status === 201, `创建任务应返回 201，实际 ${status}`);
  console.assert(task.status === 'pending', `初始状态应为 pending，实际 ${task.status}`);
  console.assert(task.assignee === 'claude-desktop', `分配者应为 claude-desktop`);
  console.log(`  ✅ Claude Desktop 创建任务: "${task.title}" [${task.id}]`);

  // 查询任务
  const { body: tasks } = await fetchJSON(port, `/tasks?projectId=${projectId}`);
  console.assert(tasks.length >= 1, '任务列表应至少有 1 个');
  console.log(`  ✅ 查询任务列表: ${tasks.length} 个`);

  // Claude Desktop 更新任务状态为 running
  const { body: running } = await fetchJSON(port, `/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'X-Nerve-Agent': 'claude-desktop' },
    body: JSON.stringify({ status: 'running', progress: 30 }),
  });
  console.assert(running.status === 'running', `状态应为 running，实际 ${running.status}`);
  console.assert(running.progress === 30, `进度应为 30，实际 ${running.progress}`);
  console.assert(!!running.startedAt, '开始时间应自动设置');
  console.log(`  ✅ 更新为 running, progress=30, startedAt=${running.startedAt}`);

  // MuleRun 通过 REST API 查询 Claude Desktop 的任务
  const { body: claudeTasks } = await fetchJSON(port, `/tasks?assignee=claude-desktop&projectId=${projectId}`);
  console.assert(claudeTasks.length >= 1, 'MuleRun 应能查询到 claude-desktop 的任务');
  console.log(`  ✅ MuleRun 查询 claude-desktop 任务: ${claudeTasks.length} 个`);

  // Claude Desktop 完成任务
  const { body: done } = await fetchJSON(port, `/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'X-Nerve-Agent': 'claude-desktop' },
    body: JSON.stringify({
      status: 'done',
      progress: 100,
      result: { type: 'file', path: '/src/auth/jwt.ts', summary: 'JWT 认证模块完成' },
    }),
  });
  console.assert(done.status === 'done', `状态应为 done，实际 ${done.status}`);
  console.assert(!!done.completedAt, '完成时间应自动设置');
  console.assert(done.result?.summary === 'JWT 认证模块完成', '结果应正确保存');
  console.log(`  ✅ Claude Desktop 完成任务, completedAt=${done.completedAt}`);

  return task.id;
}

async function testMultiAgent(port: number, projectId: string) {
  console.log('\n📋 测试: 多 Agent 协作');

  // Claude Desktop 创建任务
  const { body: task1 } = await fetchJSON(port, '/tasks', {
    method: 'POST',
    headers: { 'X-Nerve-Agent': 'claude-desktop' },
    body: JSON.stringify({ projectId, title: '编写认证单元测试', type: 'test', assignee: 'claude-desktop', priority: 'medium' }),
  });

  // MuleRun 创建任务
  const { body: task2 } = await fetchJSON(port, '/tasks', {
    method: 'POST',
    headers: { 'X-Nerve-Agent': 'mulerun' },
    body: JSON.stringify({ projectId, title: '生成 API 文档', type: 'research', assignee: 'mulerun', priority: 'low' }),
  });

  // Claude Desktop 完成自己的任务
  await fetchJSON(port, `/tasks/${task1.id}`, {
    method: 'PATCH',
    headers: { 'X-Nerve-Agent': 'claude-desktop' },
    body: JSON.stringify({ status: 'done', progress: 100 }),
  });

  // MuleRun 查询项目看板，看到 Claude Desktop 已完成
  const { body: board } = await fetchJSON(port, `/projects/${projectId}/board`);
  console.assert(board.done.length >= 1, `看板 done 列应至少有 1 个，实际 ${board.done.length}`);
  console.log(`  ✅ MuleRun 查看项目看板: done=${board.done.length}, pending/running=${board.pending.length + board.running.length}`);

  // MuleRun 开始执行自己的任务
  await fetchJSON(port, `/tasks/${task2.id}`, {
    method: 'PATCH',
    headers: { 'X-Nerve-Agent': 'mulerun' },
    body: JSON.stringify({ status: 'running', progress: 60 }),
  });

  // Claude Desktop 查询 MuleRun 的任务状态
  const { body: mulerunTasks } = await fetchJSON(port, `/tasks?assignee=mulerun&projectId=${projectId}`);
  console.assert(mulerunTasks[0].status === 'running', 'Claude Desktop 应看到 MuleRun 任务为 running');
  console.log(`  ✅ Claude Desktop 查看 MuleRun 任务: status=${mulerunTasks[0].status}, progress=${mulerunTasks[0].progress}`);

  // MuleRun 完成任务
  await fetchJSON(port, `/tasks/${task2.id}`, {
    method: 'PATCH',
    headers: { 'X-Nerve-Agent': 'mulerun' },
    body: JSON.stringify({ status: 'done', progress: 100, result: { type: 'file', path: '/docs/api.md', summary: 'API 文档生成完成' } }),
  });

  // 最终看板
  const { body: finalBoard } = await fetchJSON(port, `/projects/${projectId}/board`);
  console.log(`  ✅ 最终看板: done=${finalBoard.done.length}, 其他=${finalBoard.pending.length + finalBoard.running.length + finalBoard.blocked.length + finalBoard.waiting.length}`);
}

async function testMCPModule() {
  console.log('\n📋 测试: MCP Server 模块');
  // 验证 MCP 模块可以正常导入
  const mcp = await import('../src/mcp/index.js');
  console.assert(typeof mcp.startMcpServer === 'function', 'startMcpServer 应导出');
  console.log(`  ✅ MCP Server 模块加载成功，导出: ${Object.keys(mcp).join(', ')}`);
}

async function testStateLog(port: number, projectId: string) {
  console.log('\n📋 测试: 状态变更日志');

  // 创建任务
  const { body: task } = await fetchJSON(port, '/tasks', {
    method: 'POST',
    headers: { 'X-Nerve-Agent': 'test' },
    body: JSON.stringify({ projectId, title: '日志测试任务', type: 'code' }),
  });

  // 更新多次
  await fetchJSON(port, `/tasks/${task.id}`, {
    method: 'PATCH', headers: { 'X-Nerve-Agent': 'test' },
    body: JSON.stringify({ status: 'running' }),
  });
  await fetchJSON(port, `/tasks/${task.id}`, {
    method: 'PATCH', headers: { 'X-Nerve-Agent': 'test' },
    body: JSON.stringify({ progress: 50 }),
  });
  await fetchJSON(port, `/tasks/${task.id}`, {
    method: 'PATCH', headers: { 'X-Nerve-Agent': 'test' },
    body: JSON.stringify({ status: 'done', progress: 100 }),
  });

  // 查询状态日志
  const logs = core.listStateLogs(task.id);
  console.assert(logs.length >= 3, `应有至少 3 条日志，实际 ${logs.length}`);
  console.log(`  ✅ 状态变更日志: ${logs.length} 条记录`);
  for (const log of logs) {
    console.log(`     ${log.field}: ${JSON.stringify(log.oldValue)} → ${JSON.stringify(log.newValue)} (by ${log.actor})`);
  }
}

async function testErrorHandling(port: number) {
  console.log('\n📋 测试: 错误处理');

  // 查询不存在的任务
  const { status: s1 } = await fetchJSON(port, '/tasks/nonexistent-id');
  console.assert(s1 === 404, `不存在的任务应返回 404，实际 ${s1}`);
  console.log(`  ✅ GET /tasks/:id 404`);

  // 无效的创建请求
  const { status: s2 } = await fetchJSON(port, '/tasks', {
    method: 'POST',
    body: JSON.stringify({}), // 缺少必填字段
  });
  console.assert(s2 === 400, `缺少必填字段应返回 400，实际 ${s2}`);
  console.log(`  ✅ POST /tasks 400 (缺少必填字段)`);
}

// ========== 主流程 ==========

async function main() {
  console.log('🧪 Nerve Hub MVP 端到端测试');
  console.log('='.repeat(50));

  let port: number;
  try {
    port = await setup();
  } catch (e) {
    console.error('❌ 启动失败:', e);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  try {
    const projectId = await testProjectCRUD(port); passed++;
    await testTaskCRUD(port, projectId); passed++;
    await testMultiAgent(port, projectId); passed++;
    await testMCPModule(); passed++;
    await testStateLog(port, projectId); passed++;
    await testErrorHandling(port); passed++;
  } catch (e) {
    failed++;
    console.error('❌ 测试失败:', e);
  }

  await teardown();

  console.log('\n' + '='.repeat(50));
  console.log(`📊 结果: ${passed} 通过, ${failed} 失败`);
  console.log(failed === 0 ? '✅ 全部通过！' : '❌ 有测试失败');
  process.exit(failed > 0 ? 1 : 0);
}

main();
