#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { mcpCommand } from "./commands/mcp.js";
import {
  projectListCommand,
  projectCreateCommand,
  projectInfoCommand,
  projectBoardCommand,
  projectContextCommand,
} from "./commands/project.js";
import {
  taskListCommand,
  taskCreateCommand,
  taskGetCommand,
  taskUpdateCommand,
  taskDeleteCommand,
  taskLogsCommand,
  taskClaimCommand,
  taskDoneCommand,
  taskFailCommand,
  taskContextCommand,
} from "./commands/task.js";
import { eventListCommand } from "./commands/event.js";

const program = new Command();

program
  .name("nerve-hub")
  .description("AI Agent 状态总线 — 多智能体协作的神经系统")
  .version("0.1.0");

// ─── init ──────────────────────────────────────────────────────────────────

program
  .command("init [name]")
  .description("初始化 Nerve Hub 项目（创建 .nerve/ 目录）")
  .action((name?: string) => {
    initCommand(name);
  });

// ─── start ─────────────────────────────────────────────────────────────────

program
  .command("start")
  .description("启动 HTTP + Web UI 服务")
  .option("-p, --port <number>", "端口号", "3141")
  .option("-h, --host <string>", "绑定地址", "0.0.0.0")
  .action(async (options: { port?: string; host?: string }) => {
    await startCommand({
      port: options.port ? parseInt(options.port, 10) : undefined,
      host: options.host,
    });
  });

// ─── mcp ───────────────────────────────────────────────────────────────────

program
  .command("mcp")
  .description("以 MCP stdio 模式启动（用于 Claude Desktop）")
  .action(async () => {
    await mcpCommand();
  });

// ─── project ───────────────────────────────────────────────────────────────

const project = program.command("project").description("项目管理");

project
  .command("list")
  .alias("ls")
  .description("列出所有项目")
  .action(async () => {
    await projectListCommand();
  });

project
  .command("create")
  .alias("new")
  .description("创建项目")
  .requiredOption("-n, --name <name>", "项目名称")
  .option("-d, --description <desc>", "项目描述")
  .action(async (options: { name: string; description?: string }) => {
    await projectCreateCommand(options);
  });

project
  .command("info <id>")
  .description("查看项目详情")
  .action(async (id: string) => {
    await projectInfoCommand(id);
  });

project
  .command("board <id>")
  .description("查看项目看板（任务按状态分组）")
  .action(async (id: string) => {
    await projectBoardCommand(id);
  });

project
  .command("context <id>")
  .description("获取项目上下文（项目信息 + 任务汇总）")
  .action(async (id: string) => {
    await projectContextCommand(id);
  });

// ─── task ──────────────────────────────────────────────────────────────────

const task = program.command("task").description("任务管理");

task
  .command("list")
  .alias("ls")
  .description("查询任务")
  .option("--project-id <id>", "按项目过滤")
  .option("--status <status>", "按状态过滤 (pending|running|blocked|waiting|done|failed|archived)")
  .option("--assignee <name>", "按负责人过滤")
  .option("--type <type>", "按类型过滤 (code|review|test|deploy|research|custom)")
  .action(async (options: {
    projectId?: string; status?: string; assignee?: string; type?: string;
  }) => {
    await taskListCommand(options);
  });

task
  .command("create")
  .alias("new")
  .description("创建任务")
  .requiredOption("--project-id <id>", "所属项目 ID")
  .requiredOption("-t, --title <title>", "任务标题")
  .option("-d, --description <desc>", "详细描述")
  .option("--type <type>", "任务类型 (code|review|test|deploy|research|custom)", "custom")
  .option("--priority <p>", "优先级 (critical|high|medium|low)", "medium")
  .option("--assignee <name>", "负责人")
  .option("--tags <tags>", "标签，逗号分隔")
  .option("--dependencies <ids>", "依赖任务 ID，逗号分隔")
  .action(async (options: {
    projectId: string; title: string; description?: string;
    type?: string; priority?: string; assignee?: string;
    tags?: string; dependencies?: string;
  }) => {
    await taskCreateCommand(options);
  });

task
  .command("get <id>")
  .description("查看任务详情")
  .action(async (id: string) => {
    await taskGetCommand(id);
  });

task
  .command("update <id>")
  .alias("edit")
  .description("更新任务")
  .option("--title <title>", "任务标题")
  .option("--description <desc>", "详细描述")
  .option("--status <status>", "状态")
  .option("--priority <p>", "优先级")
  .option("--assignee <name>", "负责人")
  .option("--progress <n>", "进度 0-100")
  .option("--error <msg>", "错误信息")
  .option("--tags <tags>", "标签，逗号分隔")
  .action(async (id: string, options: {
    title?: string; description?: string; status?: string;
    priority?: string; assignee?: string; progress?: string;
    error?: string; tags?: string;
  }) => {
    await taskUpdateCommand(id, options);
  });

task
  .command("delete <id>")
  .alias("rm")
  .description("删除任务")
  .action(async (id: string) => {
    await taskDeleteCommand(id);
  });

task
  .command("logs <id>")
  .description("查看任务变更历史")
  .action(async (id: string) => {
    await taskLogsCommand(id);
  });

task
  .command("claim <id>")
  .description("认领任务（状态 → running）")
  .option("-a, --agent <name>", "认领者名称", "cli")
  .action(async (id: string, options: { agent: string }) => {
    await taskClaimCommand(id, options.agent);
  });

task
  .command("done <id>")
  .description("完成任务（状态 → done，进度 100%）")
  .option("--result-type <type>", "成果类型 (git|doc|url|output)")
  .option("--result-path <path>", "成果地址（如 git 仓库 URL）")
  .option("--result-summary <text>", "成果摘要")
  .action(async (id: string, options: {
    resultType?: string; resultPath?: string; resultSummary?: string;
  }) => {
    await taskDoneCommand(id, options);
  });

task
  .command("fail <id>")
  .description("标记任务失败")
  .option("-r, --reason <text>", "失败原因", "执行失败")
  .action(async (id: string, options: { reason: string }) => {
    await taskFailCommand(id, options.reason);
  });

task
  .command("context <id>")
  .description("获取任务上下文（用于注入到新会话）")
  .action(async (id: string) => {
    await taskContextCommand(id);
  });

// ─── event ─────────────────────────────────────────────────────────────────

const event = program.command("event").description("事件日志");

event
  .command("list")
  .alias("ls")
  .description("查看项目事件日志")
  .requiredOption("--project-id <id>", "项目 ID")
  .option("--limit <n>", "返回条数", "50")
  .action(async (options: { projectId: string; limit?: string }) => {
    await eventListCommand(options);
  });

// ─── parse ─────────────────────────────────────────────────────────────────

program.parse();
