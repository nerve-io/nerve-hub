import path from "path";
import { NerveCore } from "../../core/engine.js";
import type { TaskStatus, TaskPriority, TaskType } from "../../core/models.js";

function getCore(): NerveCore {
  const dbPath = path.join(process.cwd(), ".nerve", "hub.db");
  return new NerveCore(dbPath);
}

function print(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

export async function taskListCommand(options: {
  projectId?: string;
 status?: string;
 assignee?: string;
 type?: string;
}) {
  const core = getCore();
  const tasks = core.queryTasks({
    projectId: options.projectId,
    status: options.status as TaskStatus | undefined,
    assignee: options.assignee,
    type: options.type as TaskType | undefined,
  });
  print(tasks);
  core.close();
}

export async function taskCreateCommand(options: {
  projectId: string;
 title: string;
 description?: string;
 type?: string;
 priority?: string;
 assignee?: string;
 tags?: string;
 dependencies?: string;
}) {
  const core = getCore();
  const tags = options.tags
    ? options.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const dependencies = options.dependencies
    ? options.dependencies.split(",").map((d) => d.trim()).filter(Boolean)
    : [];

  const task = core.createTask(
    {
      projectId: options.projectId,
      title: options.title,
      description: options.description || "",
      type: (options.type as TaskType) || "custom",
      priority: (options.priority as TaskPriority) || "medium",
      assignee: options.assignee || "",
      tags,
      dependencies,
    },
    "cli",
  );
  print(task);
  core.close();
}

export async function taskGetCommand(id: string) {
  const core = getCore();
  const task = core.getTask(id);
  if (!task) {
    console.error(`任务 ${id} 不存在`);
    process.exit(1);
  }
  print(task);
  core.close();
}

export async function taskUpdateCommand(id: string, options: {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  progress?: string;
  error?: string;
  tags?: string;
}) {
  const core = getCore();
  const task = core.getTask(id);
  if (!task) {
    console.error(`任务 ${id} 不存在`);
    process.exit(1);
  }

  const input: Record<string, unknown> = {};
  if (options.title !== undefined) input.title = options.title;
  if (options.description !== undefined) input.description = options.description;
  if (options.status !== undefined) input.status = options.status;
  if (options.priority !== undefined) input.priority = options.priority;
  if (options.assignee !== undefined) input.assignee = options.assignee;
  if (options.progress !== undefined) input.progress = parseInt(options.progress, 10);
  if (options.error !== undefined) input.error = options.error;
  if (options.tags !== undefined) {
    input.tags = options.tags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const updated = core.updateTask(id, input, "cli");
  if (!updated) {
    console.error(`更新失败`);
    process.exit(1);
  }
  print(updated);
  core.close();
}

export async function taskDeleteCommand(id: string) {
  const core = getCore();
  const deleted = core.deleteTask(id, "cli");
  if (!deleted) {
    console.error(`任务 ${id} 不存在`);
    process.exit(1);
  }
  console.log(`任务 ${id} 已删除`);
  core.close();
}

export async function taskLogsCommand(id: string) {
  const core = getCore();
  const logs = core.listStateLogs(id, 100);
  print(logs);
  core.close();
}

export async function taskClaimCommand(id: string, agent: string) {
  const core = getCore();
  const updated = core.updateTask(id, { status: "running", assignee: agent }, "cli");
  if (!updated) {
    console.error(`任务 ${id} 不存在`);
    process.exit(1);
  }
  print(updated);
  core.close();
}

export async function taskDoneCommand(id: string, options: {
  resultType?: string;
  resultPath?: string;
  resultSummary?: string;
}) {
  const core = getCore();
  const input: Record<string, unknown> = {
    status: "done",
    progress: 100,
  };
  if (options.resultType) {
    input.result = {
      type: options.resultType,
      path: options.resultPath || "",
      summary: options.resultSummary || "",
    };
  }
  const updated = core.updateTask(id, input, "cli");
  if (!updated) {
    console.error(`任务 ${id} 不存在`);
    process.exit(1);
  }
  print(updated);
  core.close();
}

export async function taskFailCommand(id: string, reason: string) {
  const core = getCore();
  const updated = core.updateTask(id, { status: "failed", error: reason }, "cli");
  if (!updated) {
    console.error(`任务 ${id} 不存在`);
    process.exit(1);
  }
  print(updated);
  core.close();
}

export async function taskContextCommand(id: string) {
  const core = getCore();
  const task = core.getTask(id);
  if (!task) {
    console.error(`任务 ${id} 不存在`);
    process.exit(1);
  }

  const project = core.getProject(task.projectId);
  const deps = task.dependencies
    .map((depId) => core.getTask(depId))
    .filter(Boolean);

  const output = {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee,
      tags: task.tags,
    },
    project: project ? { id: project.id, name: project.name, description: project.description } : null,
    dependencies: deps.map((d: any) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      result: d.result,
    })),
  };

  print(output);
  core.close();
}
