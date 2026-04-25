import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// ─── Mock API plugin for demo when backend is not running ────────────────────

function mockApiPlugin(): Plugin {
  const PROJECTS = [
    { id: 'p1', name: 'Agent Runtime v2', description: 'Next-gen agent execution engine with streaming support', rules: '# Agent Runtime Rules\n\n1. All tasks must pass CI before merge\n2. Streaming responses must handle backpressure', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'p2', name: 'MCP Gateway', description: 'Unified Model Context Protocol gateway for multi-provider routing', rules: '', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'p3', name: 'Docs Overhaul', description: 'Rewrite documentation site with interactive examples', rules: '', createdAt: new Date(Date.now() - 1 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'p4', name: '多模态感知引擎', description: '支持图像、音频、视频输入的统一多模态理解模块，集成 CLIP + Whisper 架构', rules: '', createdAt: new Date(Date.now() - 14 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 'p5', name: '安全审计平台', description: 'Automated security scanning and vulnerability assessment for AI agent workflows — 包括 prompt injection 检测、权限越界审计、数据泄露防护', rules: '', createdAt: new Date(Date.now() - 10 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'p6', name: 'Performance Dashboard', description: 'Real-time metrics and observability for distributed agent deployments', rules: '', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 12 * 3600000).toISOString() },
  ];

  const TASKS = [
    // ── p1: Agent Runtime v2 ──
    { id: 't1', projectId: 'p1', title: 'Implement streaming response handler', description: 'Add SSE-based streaming for long-running agent tasks', status: 'running', priority: 'critical', type: 'code', assignee: 'agent-1', dependencies: [], result: '', creator: 'claude-code', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 't2', projectId: 'p1', title: 'Design task queue architecture', description: 'Define the priority queue and backpressure mechanism', status: 'done', priority: 'high', type: 'research', assignee: 'agent-2', dependencies: [], result: 'Completed: chose priority heap with backpressure via token bucket', creator: 'claude-desktop', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 't3', projectId: 'p1', title: 'Write unit tests for scheduler', description: 'Cover edge cases: task timeout, retry, cancellation', status: 'pending', priority: 'medium', type: 'test', assignee: 'agent-3', dependencies: ['t1'], result: '', creator: '', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 't4', projectId: 'p1', title: 'Setup CI/CD pipeline', description: 'GitHub Actions for build, test, and deploy', status: 'blocked', priority: 'high', type: 'deploy', assignee: 'agent-1', dependencies: ['t2'], result: '', creator: 'trae-solo', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 't5', projectId: 'p1', title: 'Code review: streaming module', description: 'Review PR #42 for the streaming handler implementation', status: 'pending', priority: 'medium', type: 'review', assignee: 'agent-2', dependencies: ['t1'], result: '', creator: '', createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
    // ── p2: MCP Gateway ──
    { id: 't6', projectId: 'p2', title: 'Implement provider routing logic', description: 'Route requests to correct LLM provider based on model name', status: 'running', priority: 'critical', type: 'code', assignee: 'agent-1', dependencies: [], result: '', creator: 'claude-code', createdAt: new Date(Date.now() - 4 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 't7', projectId: 'p2', title: 'Add rate limiting middleware', description: 'Per-provider rate limiting with configurable thresholds', status: 'pending', priority: 'high', type: 'code', assignee: 'agent-3', dependencies: ['t6'], result: '', creator: '', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 't8', projectId: 'p2', title: 'Load testing with 1000 concurrent', description: 'Benchmark gateway under high concurrency — failed: connection pool exhausted at 800 concurrent requests', status: 'failed', priority: 'medium', type: 'test', assignee: 'agent-2', dependencies: ['t6'], result: 'Failed: connection pool exhausted at 800 concurrent', creator: 'trae-solo', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 4 * 3600000).toISOString() },
    { id: 't9', projectId: 'p2', title: 'OAuth2 integration for Anthropic API', description: 'Implement OAuth2 client credentials flow for Anthropic Claude API authentication with automatic token refresh', status: 'done', priority: 'high', type: 'code', assignee: 'agent-1', dependencies: [], result: 'Implemented OAuth2 client credentials flow with automatic token refresh and retry logic', creator: 'claude-code', createdAt: new Date(Date.now() - 6 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 't10', projectId: 'p2', title: 'Add OpenAI provider support', description: 'Extend provider system to support OpenAI GPT-4o and GPT-4o-mini models', status: 'done', priority: 'medium', type: 'code', assignee: 'agent-3', dependencies: ['t6'], result: 'Added OpenAI provider with streaming support and function calling', creator: '', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    // ── p3: Docs Overhaul ──
    { id: 't11', projectId: 'p3', title: 'Migrate to Astro framework', description: 'Convert existing docs from Jekyll to Astro with MDX', status: 'running', priority: 'high', type: 'code', assignee: 'agent-1', dependencies: [], result: '', creator: 'claude-web', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 't12', projectId: 'p3', title: 'Write interactive code examples', description: 'Create runnable code playgrounds for key concepts', status: 'pending', priority: 'low', type: 'code', assignee: '', dependencies: ['t11'], result: '', creator: '', createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
    // ── p4: 多模态感知引擎 ──
    { id: 't13', projectId: 'p4', title: '集成 CLIP 视觉编码器', description: '将 OpenAI CLIP ViT-L/14 模型集成到推理管线中，支持图像特征提取和相似度计算', status: 'done', priority: 'critical', type: 'code', assignee: 'agent-1', dependencies: [], result: 'CLIP ViT-L/14 集成完成，推理延迟 < 200ms，准确率 92.3%', creator: 'claude-code', createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 6 * 86400000).toISOString() },
    { id: 't14', projectId: 'p4', title: '实现音频预处理管线', description: '构建音频输入的预处理管线：降噪 → 分段 → 特征提取（MFCC + spectrogram）', status: 'running', priority: 'high', type: 'code', assignee: 'agent-2', dependencies: [], result: '', creator: '', createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 't15', projectId: 'p4', title: 'Whisper ASR 模型集成', description: '集成 OpenAI Whisper large-v3 模型用于语音转文字，支持多语言识别', status: 'blocked', priority: 'high', type: 'code', assignee: 'agent-3', dependencies: ['t14'], result: '', creator: 'trae-solo', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 't16', projectId: 'p4', title: '多模态融合注意力机制', description: '设计并实现跨模态注意力融合模块，支持图像-文本、音频-文本的对齐和推理', status: 'pending', priority: 'critical', type: 'research', assignee: 'agent-1', dependencies: ['t13', 't14'], result: '', creator: '', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 't17', projectId: 'p4', title: '端到端多模态推理测试', description: '测试图像+文本、音频+文本、视频帧序列的端到端推理流程', status: 'pending', priority: 'medium', type: 'test', assignee: '', dependencies: ['t16'], result: '', creator: '', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 't18', projectId: 'p4', title: '模型量化与性能优化', description: '对 CLIP 和 Whisper 模型进行 INT8 量化，减少内存占用 50% 以上', status: 'failed', priority: 'medium', type: 'code', assignee: 'agent-2', dependencies: ['t13'], result: 'Failed: INT8 量化后 CLIP 精度下降 3.2%，超过 2% 阈值', creator: '', createdAt: new Date(Date.now() - 4 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    // ── p5: 安全审计平台 ──
    { id: 't19', projectId: 'p5', title: 'Prompt injection 检测引擎', description: '基于规则匹配 + LLM 判定的双层 prompt injection 检测系统', status: 'done', priority: 'critical', type: 'code', assignee: 'agent-1', dependencies: [], result: '检测准确率 98.7%，误报率 < 1%', creator: 'claude-code', createdAt: new Date(Date.now() - 9 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: 't20', projectId: 'p5', title: '权限越界审计模块', description: '监控 agent 工具调用链，检测超出预设权限范围的敏感操作（文件删除、网络访问、环境变量修改）', status: 'done', priority: 'high', type: 'code', assignee: 'agent-2', dependencies: [], result: '已覆盖 12 种敏感操作类型，实时告警延迟 < 100ms', creator: '', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 't21', projectId: 'p5', title: '数据泄露防护策略', description: '实现输出过滤层，防止 agent 在响应中泄露敏感信息（API key、密码、PII）', status: 'running', priority: 'high', type: 'code', assignee: 'agent-3', dependencies: ['t19'], result: '', creator: 'trae-solo', createdAt: new Date(Date.now() - 4 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 't22', projectId: 'p5', title: '安全报告自动生成', description: '根据审计日志自动生成结构化安全报告，包含风险等级、影响范围和修复建议', status: 'pending', priority: 'low', type: 'code', assignee: '', dependencies: ['t19', 't20', 't21'], result: '', creator: '', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    // ── p6: Performance Dashboard ──
    { id: 't23', projectId: 'p6', title: '设计仪表盘布局和组件', description: '设计实时监控仪表盘的布局：任务吞吐量、延迟分布、错误率、资源使用率', status: 'done', priority: 'high', type: 'research', assignee: 'agent-1', dependencies: [], result: '设计稿完成，采用 4 列布局 + 可折叠侧边栏', creator: 'claude-web', createdAt: new Date(Date.now() - 4 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 't24', projectId: 'p6', title: '实现实时指标采集 Agent', description: '开发指标采集 agent，定期从各节点收集 CPU、内存、网络、任务队列深度等指标', status: 'running', priority: 'critical', type: 'code', assignee: 'agent-2', dependencies: [], result: '', creator: '', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 12 * 3600000).toISOString() },
    { id: 't25', projectId: 'p6', title: 'WebSocket 实时推送', description: '实现 WebSocket 服务端，将指标变更实时推送到前端仪表盘', status: 'pending', priority: 'high', type: 'code', assignee: 'agent-3', dependencies: ['t24'], result: '', creator: '', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 't26', projectId: 'p6', title: '告警规则引擎', description: '支持自定义告警规则（阈值、趋势、异常检测），触发时发送通知', status: 'blocked', priority: 'medium', type: 'code', assignee: 'agent-1', dependencies: ['t24', 't25'], result: '', creator: 'trae-solo', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  ];

  const EVENTS = [
    // ── p1 events ──
    { id: 'e1', projectId: 'p1', taskId: 't1', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'e2', projectId: 'p1', taskId: 't2', actor: 'agent-2', action: 'task.status_changed', payload: '{"from":"running","to":"done"}', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'e3', projectId: 'p1', taskId: 't2', actor: 'agent-2', action: 'task.updated', payload: '{"result":"Completed: chose priority heap with backpressure via token bucket"}', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'e4', projectId: 'p1', taskId: 't3', actor: 'system', action: 'task.created', payload: '{"title":"Write unit tests for scheduler"}', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'e5', projectId: 'p1', taskId: 't4', actor: 'system', action: 'task.status_changed', payload: '{"from":"pending","to":"blocked"}', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'e6', projectId: 'p1', taskId: 't5', actor: 'system', action: 'task.created', payload: '{"title":"Code review: streaming module"}', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'e7', projectId: 'p1', taskId: 't1', actor: 'agent-1', action: 'task.updated', payload: '{"description":"Progress: SSE connection pooling implemented"}', createdAt: new Date(Date.now() - 7200000).toISOString() },
    // ── p2 events ──
    { id: 'e8', projectId: 'p2', taskId: 't6', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 'e9', projectId: 'p2', taskId: 't8', actor: 'agent-2', action: 'task.status_changed', payload: '{"from":"running","to":"failed"}', createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
    { id: 'e10', projectId: 'p2', taskId: 't9', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: 'e11', projectId: 'p2', taskId: 't9', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"running","to":"done"}', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'e12', projectId: 'p2', taskId: 't9', actor: 'agent-1', action: 'task.updated', payload: '{"result":"Implemented OAuth2 client credentials flow with automatic token refresh and retry logic"}', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'e13', projectId: 'p2', taskId: 't10', actor: 'agent-3', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'e14', projectId: 'p2', taskId: 't10', actor: 'agent-3', action: 'task.status_changed', payload: '{"from":"running","to":"done"}', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'e15', projectId: 'p2', taskId: 't10', actor: 'agent-3', action: 'task.updated', payload: '{"result":"Added OpenAI provider with streaming support and function calling"}', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    // ── p3 events ──
    { id: 'e16', projectId: 'p3', taskId: 't11', actor: 'agent-1', action: 'task.created', payload: '{"title":"Migrate to Astro framework"}', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'e17', projectId: 'p3', taskId: 't11', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'e18', projectId: 'p3', taskId: 't12', actor: 'system', action: 'task.created', payload: '{"title":"Write interactive code examples"}', createdAt: new Date(Date.now() - 3600000).toISOString() },
    // ── p4 events ──
    { id: 'e19', projectId: 'p4', taskId: 't13', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
    { id: 'e20', projectId: 'p4', taskId: 't13', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"running","to":"done"}', createdAt: new Date(Date.now() - 6 * 86400000).toISOString() },
    { id: 'e21', projectId: 'p4', taskId: 't13', actor: 'agent-1', action: 'task.updated', payload: '{"result":"CLIP ViT-L/14 集成完成，推理延迟 < 200ms，准确率 92.3%"}', createdAt: new Date(Date.now() - 6 * 86400000).toISOString() },
    { id: 'e22', projectId: 'p4', taskId: 't14', actor: 'agent-2', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'e23', projectId: 'p4', taskId: 't18', actor: 'agent-2', action: 'task.status_changed', payload: '{"from":"running","to":"failed"}', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'e24', projectId: 'p4', taskId: 't18', actor: 'agent-2', action: 'task.updated', payload: '{"result":"Failed: INT8 量化后 CLIP 精度下降 3.2%，超过 2% 阈值"}', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'e25', projectId: 'p4', taskId: 't15', actor: 'system', action: 'task.status_changed', payload: '{"from":"pending","to":"blocked"}', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    // ── p5 events ──
    { id: 'e26', projectId: 'p5', taskId: 't19', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"running","to":"done"}', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: 'e27', projectId: 'p5', taskId: 't19', actor: 'agent-1', action: 'task.updated', payload: '{"result":"检测准确率 98.7%，误报率 < 1%"}', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: 'e28', projectId: 'p5', taskId: 't20', actor: 'agent-2', action: 'task.status_changed', payload: '{"from":"running","to":"done"}', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'e29', projectId: 'p5', taskId: 't20', actor: 'agent-2', action: 'task.updated', payload: '{"result":"已覆盖 12 种敏感操作类型，实时告警延迟 < 100ms"}', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'e30', projectId: 'p5', taskId: 't21', actor: 'agent-3', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 86400000).toISOString() },
    // ── p6 events ──
    { id: 'e31', projectId: 'p6', taskId: 't23', actor: 'agent-1', action: 'task.status_changed', payload: '{"from":"running","to":"done"}', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'e32', projectId: 'p6', taskId: 't23', actor: 'agent-1', action: 'task.updated', payload: '{"result":"设计稿完成，采用 4 列布局 + 可折叠侧边栏"}', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'e33', projectId: 'p6', taskId: 't24', actor: 'agent-2', action: 'task.status_changed', payload: '{"from":"pending","to":"running"}', createdAt: new Date(Date.now() - 12 * 3600000).toISOString() },
    { id: 'e34', projectId: 'p6', taskId: 't26', actor: 'system', action: 'task.status_changed', payload: '{"from":"pending","to":"blocked"}', createdAt: new Date(Date.now() - 86400000).toISOString() },
  ];

  const AGENTS = [
    { id: 'claude-desktop', name: 'Claude Desktop', type: 'manual' as const, status: 'online' as const, lastSeen: new Date(Date.now() - 120000).toISOString(), capabilities: { taskTypes: ['code', 'review', 'research'], languages: ['English', 'Chinese'] }, rules: '# Claude Desktop Rules\n\n1. Always follow project conventions\n2. No direct file modifications without approval', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'trae-solo', name: 'TRAE SOLO', type: 'manual' as const, status: 'busy' as const, lastSeen: new Date(Date.now() - 60000).toISOString(), capabilities: { taskTypes: ['code', 'test', 'deploy'], languages: ['Chinese', 'English'] }, rules: '# TRAE SOLO Agent Rules\n\n## 交付三件套\n\n1. 自测报告\n2. 已知问题清单\n3. 未覆盖范围说明', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 'claude-code', name: 'Claude Code', type: 'webhook' as const, endpoint: 'https://hooks.example.com/claude-code', heartbeatInterval: 60, status: 'online' as const, lastSeen: new Date(Date.now() - 30000).toISOString(), capabilities: { taskTypes: ['code', 'test', 'custom'], languages: ['English'] }, rules: '', createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
  ];

  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        const method = (req.method || 'GET').toUpperCase();

        // Health
        if (url === '/health' && method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok' }));
          return;
        }

        // Only handle /api routes
        if (!url.startsWith('/api/')) {
          return next();
        }

        const path = url.replace(/^\/api/, '').split('?')[0];

        // ─── Projects ─────────────────────────────────────────────
        if (path === '/projects' && method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(PROJECTS));
          return;
        }
        if (path === '/projects' && method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const input = JSON.parse(body);
            const p = { id: 'p' + Date.now(), name: input.name, description: input.description || '', rules: input.rules || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            PROJECTS.unshift(p);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 201;
            res.end(JSON.stringify(p));
          });
          return;
        }
        const projectMatch = path.match(/^\/projects\/([^/]+)$/);
        if (projectMatch && method === 'GET') {
          const p = PROJECTS.find((x) => x.id === projectMatch[1]);
          if (!p) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(p));
          return;
        }
        if (projectMatch && method === 'PATCH') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const p = PROJECTS.find((x) => x.id === projectMatch[1]);
            if (!p) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
            const input = JSON.parse(body);
            Object.assign(p, input, { updatedAt: new Date().toISOString() });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(p));
          });
          return;
        }
        if (projectMatch && method === 'DELETE') {
          const idx = PROJECTS.findIndex((x) => x.id === projectMatch[1]);
          if (idx === -1) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          PROJECTS.splice(idx, 1);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ deleted: true }));
          return;
        }
        const projectCtxMatch = path.match(/^\/projects\/([^/]+)\/context$/);
        if (projectCtxMatch && method === 'GET') {
          const p = PROJECTS.find((x) => x.id === projectCtxMatch[1]);
          if (!p) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          const tasks = TASKS.filter((t) => t.projectId === p.id);
          const byStatus: Record<string, number> = {};
          for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ project: p, tasks, stats: { total: tasks.length, byStatus } }));
          return;
        }
        const projectBlockedStatusesMatch = path.match(/^\/projects\/([^/]+)\/blocked-statuses$/);
        if (projectBlockedStatusesMatch && method === 'GET') {
          const p = PROJECTS.find((x) => x.id === projectBlockedStatusesMatch[1]);
          if (!p) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          const tasks = TASKS.filter((t) => t.projectId === p.id);
          const map: Record<string, boolean> = {};
          for (const t of tasks) {
            if (t.dependencies.length > 0) {
              map[t.id] = t.dependencies.some((depId) => {
                const dep = TASKS.find((x) => x.id === depId);
                return dep && dep.status !== 'done';
              });
            } else {
              map[t.id] = false;
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(map));
          return;
        }

        // ─── Tasks ────────────────────────────────────────────────
        if (path === '/tasks' && method === 'GET') {
          const params = new URL(url, 'http://localhost').searchParams;
          let result = [...TASKS];
          if (params.get('projectId')) result = result.filter((t) => t.projectId === params.get('projectId'));
          if (params.get('status')) result = result.filter((t) => t.status === params.get('status'));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (path === '/tasks' && method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const input = JSON.parse(body);
            const t = { id: 't' + Date.now(), projectId: input.projectId || '', title: input.title, description: input.description || '', status: 'pending', priority: input.priority || 'medium', type: input.type || 'custom', assignee: input.assignee || '', dependencies: input.dependencies || [], result: '', creator: input.creator || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            TASKS.unshift(t);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 201;
            res.end(JSON.stringify(t));
          });
          return;
        }
        const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
        if (taskMatch && method === 'GET') {
          const t = TASKS.find((x) => x.id === taskMatch[1]);
          if (!t) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(t));
          return;
        }
        if (taskMatch && method === 'PATCH') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const t = TASKS.find((x) => x.id === taskMatch[1]);
            if (!t) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
            const input = JSON.parse(body);
            Object.assign(t, input, { updatedAt: new Date().toISOString() });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(t));
          });
          return;
        }
        const taskCtxMatch = path.match(/^\/tasks\/([^/]+)\/context$/);
        if (taskCtxMatch && method === 'GET') {
          const t = TASKS.find((x) => x.id === taskCtxMatch[1]);
          if (!t) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          const project = PROJECTS.find((p) => p.id === t.projectId) || null;
          const blockedBy = t.dependencies.map((d) => TASKS.find((x) => x.id === d)).filter((x) => x && x.status !== 'done');
          const events = EVENTS.filter((e) => e.taskId === t.id);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ task: t, project, blockedBy, events }));
          return;
        }
        const blockedByMatch = path.match(/^\/tasks\/([^/]+)\/blocked-by$/);
        if (blockedByMatch && method === 'GET') {
          const t = TASKS.find((x) => x.id === blockedByMatch[1]);
          if (!t) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          const blockedBy = t.dependencies.map((d) => TASKS.find((x) => x.id === d)).filter((x) => x && x.status !== 'done');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(blockedBy));
          return;
        }

        // ─── Events ───────────────────────────────────────────────
        if (path === '/events' && method === 'GET') {
          const params = new URL(url, 'http://localhost').searchParams;
          let result = [...EVENTS];
          if (params.get('projectId')) result = result.filter((e) => e.projectId === params.get('projectId'));
          if (params.get('taskId')) result = result.filter((e) => e.taskId === params.get('taskId'));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }

        // ─── Agents ────────────────────────────────────────────────
        if (path === '/agents' && method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(AGENTS));
          return;
        }
        if (path === '/agents' && method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const input = JSON.parse(body);
            const a = { id: input.id, name: input.name, type: input.type, endpoint: input.endpoint || '', heartbeatInterval: input.heartbeatInterval || 60, status: 'offline' as const, lastSeen: new Date().toISOString(), capabilities: input.capabilities || null, rules: input.rules || '', createdAt: new Date().toISOString() };
            AGENTS.push(a);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 201;
            res.end(JSON.stringify(a));
          });
          return;
        }
        const agentMatch = path.match(/^\/agents\/([^/]+)$/);
        if (agentMatch && method === 'GET') {
          const a = AGENTS.find((x) => x.id === agentMatch[1]);
          if (!a) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(a));
          return;
        }
        if (agentMatch && method === 'DELETE') {
          const idx = AGENTS.findIndex((x) => x.id === agentMatch[1]);
          if (idx === -1) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          AGENTS.splice(idx, 1);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ deleted: true }));
          return;
        }
        const agentRulesMatch = path.match(/^\/agents\/([^/]+)\/rules$/);
        if (agentRulesMatch && method === 'GET') {
          const a = AGENTS.find((x) => x.id === agentRulesMatch[1]);
          if (!a) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ rules: a.rules || '' }));
          return;
        }
        if (agentRulesMatch && method === 'PATCH') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const a = AGENTS.find((x) => x.id === agentRulesMatch[1]);
            if (!a) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
            const input = JSON.parse(body);
            a.rules = input.rules || '';
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(a));
          });
          return;
        }
        const agentStatusMatch = path.match(/^\/agents\/([^/]+)\/status$/);
        if (agentStatusMatch && method === 'PATCH') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const a = AGENTS.find((x) => x.id === agentStatusMatch[1]);
            if (!a) { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); return; }
            const input = JSON.parse(body);
            a.status = input.status;
            a.lastSeen = new Date().toISOString();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(a));
          });
          return;
        }

        next();
      });
    },
  };
}

// VITE_MOCK=true  → use mock plugin (no backend needed, demo/offline mode)
// default         → proxy to real backend at localhost:3141
const USE_MOCK = process.env.VITE_MOCK === 'true';

export default defineConfig({
  plugins: [tailwindcss(), react(), ...(USE_MOCK ? [mockApiPlugin()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: USE_MOCK ? {} : {
      '/api': {
        target: 'http://localhost:3141',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/health': {
        target: 'http://localhost:3141',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:3141',
        ws: true,
      },
    },
  },
})
