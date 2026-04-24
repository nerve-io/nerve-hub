/**
 * mcp.ts — MCP server over stdio. Same DB, same operations.
 *
 * Tools:
 *   create_project       — create a project
 *   list_projects        — list all projects
 *   get_project_context  — project context (tasks + stats)
 *   create_task          — create a task
 *   list_tasks           — list tasks (optional projectId/status/priority/type/assignee filter)
 *   get_task             — get one task by id
 *   get_task_context     — full task context (project + blockedBy + events)
 *   update_task          — update task fields
 *   get_blocked_by       — get unfinished dependencies of a task
 *   get_events           — query event log
 *   claim_task           — claim a task (set running + assignee, atomic)
 *   complete_task        — complete a task (set done + result, atomic)
 *   delete_task          — delete a task
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { TaskDB } from "./db.js";

const STATUS_ENUM = z.enum(["pending", "running", "done", "failed", "blocked"]);
const PRIORITY_ENUM = z.enum(["critical", "high", "medium", "low"]);
const TYPE_ENUM = z.enum(["code", "review", "test", "deploy", "research", "custom"]);

export async function startMcp(db: TaskDB) {
  // Keep stdin open so the Node.js event loop never exits prematurely.
  // This is critical: some MCP clients (e.g. 悟空钉钉) spawn the process
  // and expect it to stay alive until the client closes the pipe.
  process.stdin.resume();

  const server = new McpServer(
    { name: "nerve-hub", version: "0.2.0" },
    { capabilities: { tools: {} } }
  );

  // ─── Project Tools ─────────────────────────────────────────────────────

  server.tool(
    "create_project",
    "Create a new project to group tasks",
    {
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
    },
    async (args) => {
      const project = db.createProject({ name: args.name, description: args.description });
      return { content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }] };
    }
  );

  server.tool(
    "list_projects",
    "List all projects",
    {},
    async () => {
      const projects = db.listProjects();
      return { content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }] };
    }
  );

  server.tool(
    "get_project_context",
    "Get project context: project info, all tasks, and status statistics. Use this to inject project state into a new conversation.",
    {
      projectId: z.string().describe("Project ID"),
    },
    async (args) => {
      const ctx = db.getProjectContext(args.projectId);
      if (!ctx) return { content: [{ type: "text" as const, text: "Error: project not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(ctx, null, 2) }] };
    }
  );

  // ─── Task Tools ────────────────────────────────────────────────────────

  server.tool(
    "create_task",
    "Create a new task",
    {
      title: z.string().describe("Task title"),
      projectId: z.string().optional().describe("Project ID to assign this task to"),
      description: z.string().optional().describe("Task description"),
      priority: PRIORITY_ENUM.optional().describe("Priority: critical, high, medium (default), low"),
      type: TYPE_ENUM.optional().describe("Task type: code, review, test, deploy, research, custom (default)"),
      assignee: z.string().optional().describe("Agent or person responsible for this task"),
      dependencies: z.array(z.string()).optional().describe("List of prerequisite task IDs — these tasks must be done before this one can start"),
    },
    async (args) => {
      const task = db.create({ title: args.title, projectId: args.projectId, description: args.description, priority: args.priority, type: args.type, assignee: args.assignee, dependencies: args.dependencies });
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "list_tasks",
    "List tasks, optionally filtered by projectId, status, priority, type, and/or assignee",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
      status: STATUS_ENUM.optional().describe("Filter by status: pending, running, done, failed, blocked"),
      priority: PRIORITY_ENUM.optional().describe("Filter by priority: critical, high, medium, low"),
      type: TYPE_ENUM.optional().describe("Filter by type: code, review, test, deploy, research, custom"),
      assignee: z.string().optional().describe("Filter by assignee name"),
    },
    async (args) => {
      const tasks = db.list({ projectId: args.projectId, status: args.status, priority: args.priority, type: args.type, assignee: args.assignee });
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
    "get_task_context",
    "Get full task context: the task itself, its project (if any), unfinished dependencies, and recent event history. Call this before starting work on a task to inject full context into the current conversation.",
    {
      id: z.string().describe("Task ID"),
    },
    async (args) => {
      const ctx = db.getTaskContext(args.id);
      if (!ctx) return { content: [{ type: "text" as const, text: "Error: task not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(ctx, null, 2) }] };
    }
  );

  server.tool(
    "update_task",
    "Update task fields (title, description, status, priority, type, assignee, dependencies, result)",
    {
      id: z.string().describe("Task ID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: STATUS_ENUM.optional().describe("New status"),
      priority: PRIORITY_ENUM.optional().describe("New priority"),
      type: TYPE_ENUM.optional().describe("New type"),
      assignee: z.string().optional().describe("New assignee"),
      dependencies: z.array(z.string()).optional().describe("New dependency list — prerequisite task IDs"),
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
    "get_blocked_by",
    "Get unfinished dependencies of a task. Returns a list of tasks that must be completed before this task can start. Use this to check if a task is ready to begin.",
    {
      id: z.string().describe("Task ID"),
    },
    async (args) => {
      const task = db.get(args.id);
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      const blockedBy = db.getBlockedBy(args.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(blockedBy, null, 2) }] };
    }
  );

  server.tool(
    "get_events",
    "Query event log: task creations, status changes, updates, and deletions. Use this to understand what happened in a project or task.",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
      taskId: z.string().optional().describe("Filter by task ID"),
      limit: z.number().optional().describe("Max events to return (default 50, max 200)"),
    },
    async (args) => {
      const events = db.getEvents({ projectId: args.projectId, taskId: args.taskId, limit: args.limit });
      return { content: [{ type: "text" as const, text: JSON.stringify(events, null, 2) }] };
    }
  );

  server.tool(
    "claim_task",
    "Claim a task: atomically set status to 'running' and assign it to an agent. Use this to pick up a task before starting work.",
    {
      id: z.string().describe("Task ID"),
      assignee: z.string().describe("Your name or agent identifier (e.g. claude, cursor, gpt)"),
    },
    async (args) => {
      const task = db.update(args.id, { status: "running", assignee: args.assignee });
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "complete_task",
    "Complete a task: atomically set status to 'done' and write the result. Use this when work is finished.",
    {
      id: z.string().describe("Task ID"),
      result: z.string().describe("What was accomplished — summary, PR URL, output, etc."),
    },
    async (args) => {
      const task = db.update(args.id, { status: "done", result: args.result });
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

  // ─── Agent Tools ───────────────────────────────────────────────────────

  const AGENT_TYPE_ENUM = z.enum(["webhook", "manual"]);

  server.tool(
    "register_agent",
    "Register or update an Agent profile. If the id already exists, fields are updated (created_at and status are preserved).",
    {
      id: z.string().describe("Agent unique identifier (same as assignee field)"),
      name: z.string().describe("Display name"),
      type: AGENT_TYPE_ENUM.describe("Agent type: webhook (HTTP callback) or manual (human-operated)"),
      endpoint: z.string().optional().describe("Webhook URL (required when type=webhook)"),
      heartbeat_interval: z.number().optional().describe("Heartbeat interval in seconds (default 60, webhook only)"),
      metadata: z.string().optional().describe("JSON string for extension fields (e.g. capabilities)"),
    },
    async (args) => {
      const agent = db.registerAgent({
        id: args.id,
        name: args.name,
        type: args.type,
        endpoint: args.endpoint,
        heartbeatInterval: args.heartbeat_interval,
        metadata: args.metadata,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(agent, null, 2) }] };
    }
  );

  server.tool(
    "list_agents",
    "List all registered Agents and their current status",
    {},
    async () => {
      const agents = db.listAgents();
      return { content: [{ type: "text" as const, text: JSON.stringify(agents, null, 2) }] };
    }
  );

  // ─── Sprint 3 Backfill Tools ──────────────────────────────────────────

  server.tool(
    "search_tasks",
    "Search tasks across projects by keyword (matches title and description)",
    {
      query: z.string().describe("Search keyword"),
      project_id: z.string().optional().describe("Limit to a specific project"),
    },
    async (args) => {
      const tasks = db.list({ search: args.query, projectId: args.project_id });
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  server.tool(
    "list_comments",
    "Get all comments for a task (chronological order)",
    {
      task_id: z.string().describe("Task ID"),
    },
    async (args) => {
      const comments = db.listComments(args.task_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(comments, null, 2) }] };
    }
  );

  server.tool(
    "create_comment",
    "Add a comment/note to a task",
    {
      task_id: z.string().describe("Task ID"),
      body: z.string().describe("Comment content (max 2000 chars)"),
    },
    async (args) => {
      try {
        const comment = db.createComment({ taskId: args.task_id, body: args.body }, "mcp-agent");
        return { content: [{ type: "text" as const, text: JSON.stringify(comment, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "delete_comment",
    "Delete a comment",
    {
      comment_id: z.string().describe("Comment ID"),
    },
    async (args) => {
      const ok = db.deleteComment(args.comment_id);
      if (!ok) return { content: [{ type: "text" as const, text: "Error: comment not found" }], isError: true };
      return { content: [{ type: "text" as const, text: "Deleted" }] };
    }
  );

  // ─── Handoff Tools ────────────────────────────────────────────────────

  server.tool(
    "get_agent_briefing",
    "Get a structured briefing for a task, including full context (description, blockers, events, comments) and action guide. Use this as working context for an AI Agent.",
    {
      task_id: z.string().describe("Task ID"),
    },
    async (args) => {
      const briefing = db.generateBriefing(args.task_id);
      if (!briefing) return { content: [{ type: "text" as const, text: "Error: task not found" }], isError: true };
      return { content: [{ type: "text" as const, text: briefing }] };
    }
  );

  server.tool(
    "get_handoff_queue",
    "Get all tasks assigned to Manual-type Agents that are pending (Handoff Queue).",
    {},
    async () => {
      const tasks = db.getHandoffQueue();
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  // ─── Connect ─────────────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
