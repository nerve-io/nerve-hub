import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { NerveCore } from "../core/engine.js";
import type { Task } from "../core/models.js";

export function createMCPServer(core: NerveCore): McpServer {
  const server = new McpServer({
    name: "nerve-hub",
    version: "0.1.0",
  });

  // ── Tools ─────────────────────────────────────────────────────────

  server.tool(
    "create_task",
    "Create a new task in the Nerve Hub",
    {
      projectId: z.string().describe("The project ID"),
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      type: z.enum(["code", "review", "test", "deploy", "research", "custom"]).optional().describe("Task type"),
      priority: z.enum(["critical", "high", "medium", "low"]).optional().describe("Task priority"),
      assignee: z.string().optional().describe("Agent or person assigned to the task"),
      dependencies: z.array(z.string()).optional().describe("List of task IDs this task depends on"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
    },
    async (params) => {
      const task = core.tasks.create({
        projectId: params.projectId,
        title: params.title,
        description: params.description ?? null,
        type: params.type ?? "custom",
        priority: params.priority ?? "medium",
        assignee: params.assignee ?? null,
        dependencies: params.dependencies ?? [],
        tags: params.tags ?? [],
        metadata: {},
        parentId: null,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
      };
    },
  );

  server.tool(
    "update_task",
    "Update an existing task",
    {
      id: z.string().describe("Task ID to update"),
      status: z.enum(["pending", "running", "blocked", "waiting", "done", "failed", "archived"]).optional(),
      progress: z.number().min(0).max(100).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      result: z.object({
        type: z.enum(["file", "url", "text", "artifact"]),
        path: z.string().optional(),
        content: z.string().optional(),
        summary: z.string().optional(),
      }).nullable().optional(),
      error: z.string().nullable().optional(),
    },
    async (params) => {
      const { id, ...updates } = params;
      const task = core.tasks.update(id, updates, "mcp-client");
      if (!task) {
        return {
          content: [{ type: "text" as const, text: `Task ${id} not found` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
      };
    },
  );

  server.tool(
    "query_tasks",
    "Query tasks with optional filters",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
      status: z.enum(["pending", "running", "blocked", "waiting", "done", "failed", "archived"]).optional(),
      assignee: z.string().optional().describe("Filter by assignee"),
      type: z.enum(["code", "review", "test", "deploy", "research", "custom"]).optional(),
    },
    async (params) => {
      const tasks = core.tasks.query(params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
      };
    },
  );

  server.tool(
    "get_task",
    "Get a single task by ID",
    {
      id: z.string().describe("Task ID"),
    },
    async (params) => {
      const task = core.tasks.get(params.id);
      if (!task) {
        return {
          content: [{ type: "text" as const, text: `Task ${params.id} not found` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
      };
    },
  );

  server.tool(
    "publish_event",
    "Publish an event to the event bus",
    {
      projectId: z.string().describe("Project ID"),
      channel: z.string().describe("Event channel (e.g. 'tasks', 'deployments', 'alerts')"),
      type: z.string().describe("Event type (e.g. 'task.completed', 'deploy.started')"),
      source: z.string().describe("Source of the event (e.g. agent ID)"),
      payload: z.record(z.unknown()).optional().describe("Event payload data"),
    },
    async (params) => {
      const event = core.events.publish(
        params.projectId,
        params.channel,
        params.type,
        params.source,
        params.payload,
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(event, null, 2) }],
      };
    },
  );

  server.tool(
    "get_project_context",
    "Get full project context including board view and recent events",
    {
      projectId: z.string().describe("Project ID"),
    },
    async (params) => {
      const project = core.projects.get(params.projectId);
      if (!project) {
        return {
          content: [{ type: "text" as const, text: `Project ${params.projectId} not found` }],
          isError: true,
        };
      }
      const board = core.projects.getBoard(params.projectId);
      const events = core.events.list(params.projectId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ project, board, recentEvents: events.slice(0, 20) }, null, 2),
        }],
      };
    },
  );

  // ── Resources ─────────────────────────────────────────────────────

  server.resource(
    "taskboard",
    new ResourceTemplate("taskboard://{projectId}", { list: undefined }),
    async (uri, { projectId }) => {
      const project = core.projects.get(projectId as string);
      if (!project) {
        return { contents: [{ uri: uri.href, text: `Project ${projectId} not found` }] };
      }
      const board = core.projects.getBoard(projectId as string);
      const summary = Object.entries(board)
        .filter(([, tasks]) => tasks.length > 0)
        .map(([status, tasks]) => `## ${status.toUpperCase()} (${tasks.length})\n${tasks.map((t: Task) => `- [${t.priority}] ${t.title} (${t.id})`).join("\n")}`)
        .join("\n\n");
      return {
        contents: [{
          uri: uri.href,
          text: `# Project: ${project.name}\n\n${summary || "No tasks found."}`,
        }],
      };
    },
  );

  server.resource(
    "agent-tasks",
    new ResourceTemplate("tasks://{agentId}", { list: undefined }),
    async (uri, { agentId }) => {
      const tasks = core.tasks.query({ assignee: agentId as string });
      const text = tasks.length > 0
        ? tasks.map((t) => `- [${t.status}] ${t.title} (${t.id})`).join("\n")
        : `No tasks assigned to ${agentId}`;
      return {
        contents: [{ uri: uri.href, text }],
      };
    },
  );

  return server;
}

export async function startMCPStdio(core: NerveCore): Promise<void> {
  const server = createMCPServer(core);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Nerve Hub MCP server running in stdio mode");
}

export async function startMCPHttp(core: NerveCore, port: number = 3142): Promise<void> {
  const { default: Fastify } = await import("fastify");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamablehttp.js"
  );

  const app = Fastify({ logger: false });
  const server = createMCPServer(core);

  app.post("/mcp", async (request, reply) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  app.get("/mcp", async (request, reply) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw);
  });

  app.delete("/mcp", async (request, reply) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw);
  });

  await app.listen({ port, host: "0.0.0.0" });
  console.error(`Nerve Hub MCP server running in HTTP mode on port ${port}`);
}
