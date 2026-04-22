/**
 * mcp.ts — MCP server over stdio. Same DB, same operations.
 *
 * Tools:
 *   create_task   — create a task
 *   list_tasks    — list tasks (optional status filter)
 *   get_task      — get one task by id
 *   update_task   — update task fields
 *   delete_task   — delete a task
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { TaskDB } from "./db.js";

export async function startMcp(db: TaskDB) {
  // Keep stdin open so the Node.js event loop never exits prematurely.
  // This is critical: some MCP clients (e.g. 悟空钉钉) spawn the process
  // and expect it to stay alive until the client closes the pipe.
  process.stdin.resume();

  const server = new McpServer(
    { name: "nerve-hub", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  // ─── Tools ───────────────────────────────────────────────────────────────

  server.tool(
    "create_task",
    "Create a new task",
    {
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
    },
    async (args) => {
      const task = db.create({ title: args.title, description: args.description });
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "list_tasks",
    "List all tasks, optionally filtered by status",
    {
      status: z.enum(["pending", "done", "failed"]).optional().describe("Filter by status"),
    },
    async (args) => {
      const tasks = db.list(args.status);
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  server.tool(
    "get_task",
    "Get a task by ID",
    {
      id: z.string().describe("Task ID"),
    },
    async (args) => {
      const task = db.get(args.id);
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "update_task",
    "Update task fields (title, description, status, result)",
    {
      id: z.string().describe("Task ID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z.enum(["pending", "done", "failed"]).optional().describe("New status"),
      result: z.string().optional().describe("Task result — summary, URL, or any text"),
    },
    async (args) => {
      const { id, ...updates } = args;
      const task = db.update(id, updates);
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "delete_task",
    "Delete a task",
    {
      id: z.string().describe("Task ID"),
    },
    async (args) => {
      const ok = db.delete(args.id);
      if (!ok) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: "Deleted" }] };
    }
  );

  // ─── Connect ─────────────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
