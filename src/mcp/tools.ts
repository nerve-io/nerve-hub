import type { NerveCore } from "../core/engine.js";
import { z } from "zod";

export function registerTools(server: any, core: NerveCore) {
  // create_task
  server.tool(
    "create_task",
    "Create a new task in a project",
    {
      projectId: z.string().uuid().describe("The project ID to create the task in"),
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      type: z
        .enum(["code", "review", "test", "deploy", "research", "custom"])
        .optional()
        .describe("Task type"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Task priority"),
      assignee: z.string().optional().describe("Agent or user assigned to the task"),
      dependencies: z.array(z.string()).optional().describe("List of task IDs this task depends on"),
    },
    async (args) => {
      try {
        const task = core.createTask(
          {
            projectId: args.projectId,
            title: args.title,
            description: args.description,
            type: args.type,
            priority: args.priority,
            assignee: args.assignee,
            dependencies: args.dependencies,
          },
          "mcp-tool"
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // update_task
  server.tool(
    "update_task",
    "Update an existing task",
    {
      taskId: z.string().uuid().describe("The task ID to update"),
      status: z
        .enum(["pending", "running", "blocked", "waiting", "done", "failed", "archived"])
        .optional()
        .describe("New task status"),
      progress: z.number().int().min(0).max(100).optional().describe("Task progress (0-100)"),
      result: z
        .object({
          type: z.string().optional(),
          path: z.string().optional(),
          content: z.unknown().optional(),
          summary: z.string().optional(),
        })
        .optional()
        .describe("Task result"),
      error: z.string().optional().describe("Error message if task failed"),
      title: z.string().optional().describe("Updated title"),
      description: z.string().optional().describe("Updated description"),
      assignee: z.string().optional().describe("Updated assignee"),
    },
    async (args) => {
      try {
        const { taskId, ...updateData } = args;
        const task = core.updateTask(taskId, updateData, "mcp-tool");
        if (!task) {
          return {
            content: [{ type: "text" as const, text: `Error: Task ${taskId} not found` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // query_tasks
  server.tool(
    "query_tasks",
    "Query tasks with optional filters",
    {
      projectId: z.string().uuid().optional().describe("Filter by project ID"),
      status: z
        .enum(["pending", "running", "blocked", "waiting", "done", "failed", "archived"])
        .optional()
        .describe("Filter by status"),
      assignee: z.string().optional().describe("Filter by assignee"),
      type: z
        .enum(["code", "review", "test", "deploy", "research", "custom"])
        .optional()
        .describe("Filter by task type"),
    },
    async (args) => {
      try {
        const tasks = core.queryTasks({
          projectId: args.projectId,
          status: args.status,
          assignee: args.assignee,
          type: args.type,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // get_task
  server.tool(
    "get_task",
    "Get a single task by ID",
    {
      taskId: z.string().uuid().describe("The task ID to retrieve"),
    },
    async (args) => {
      try {
        const task = core.getTask(args.taskId);
        if (!task) {
          return {
            content: [{ type: "text" as const, text: `Error: Task ${args.taskId} not found` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // get_project_context
  server.tool(
    "get_project_context",
    "Get project information and task summary",
    {
      projectId: z.string().uuid().describe("The project ID"),
    },
    async (args) => {
      try {
        const context = core.getProjectContext(args.projectId);
        if (!context.project) {
          return {
            content: [{ type: "text" as const, text: `Error: Project ${args.projectId} not found` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(context, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
