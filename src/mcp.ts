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
 *   delete_comment       — delete a comment
 *   whoami               — return current agent identity (name + uid)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import type { TaskDB } from "./db.js";

// ─── Token Helpers ──────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readTokenFromCredentialsFile(): string | null {
  // 1. Check NERVE_HUB_CREDENTIALS_FILE
  if (process.env.NERVE_HUB_CREDENTIALS_FILE) {
    const file = process.env.NERVE_HUB_CREDENTIALS_FILE;
    if (existsSync(file)) {
      try {
        const content = readFileSync(file, 'utf-8');
        const data = JSON.parse(content);
        if (data.entries) {
          // Use default_agent_id if set
          if (data.default_agent_id && data.entries[data.default_agent_id]) {
            return data.entries[data.default_agent_id].token;
          }
          // Fallback to first entry
          const firstAgentId = Object.keys(data.entries)[0];
          if (firstAgentId) {
            return data.entries[firstAgentId].token;
          }
        }
      } catch (err) {
        console.error(`[mcp] Error reading credentials file: ${err}`);
      }
    }
  }
  
  // 2. Check ~/.nerve/credentials.json
  const defaultCredentialsFile = join(homedir(), '.nerve', 'credentials.json');
  if (existsSync(defaultCredentialsFile)) {
    try {
      const content = readFileSync(defaultCredentialsFile, 'utf-8');
      const data = JSON.parse(content);
      if (data.entries) {
        // Use default_agent_id if set
        if (data.default_agent_id && data.entries[data.default_agent_id]) {
          return data.entries[data.default_agent_id].token;
        }
        // Fallback to agent name from NERVE_HUB_AGENT_NAME
        const agentName = process.env.NERVE_HUB_AGENT_NAME;
        if (agentName) {
          // Find agent by name (assuming entries are keyed by agentId, not name)
          // This is a fallback and may not work if agentId != name
          for (const [agentId, entry] of Object.entries(data.entries)) {
            if (agentId === agentName) {
              return (entry as any).token;
            }
          }
        }
      }
    } catch (err) {
      console.error(`[mcp] Error reading default credentials file: ${err}`);
    }
  }
  
  return null;
}

function getToken(): string | null {
  // 1. Check NERVE_HUB_TOKEN
  if (process.env.NERVE_HUB_TOKEN) {
    return process.env.NERVE_HUB_TOKEN;
  }
  
  // 2. Check credentials files
  return readTokenFromCredentialsFile();
}

// ─── Long-text offload ──────────────────────────────────────────────────────
// Some MCP clients (e.g. TRAE SOLO) have dynamic response length limits.
// When a text response exceeds this threshold, write it to a local file and
// return a short anchor instead. The agent can then read the file with its
// own file-reading tool (no context-length risk).
//
// Cache directory: derived from NERVE_DB_PATH (same dir as the DB),
// falling back to ~/.nerve/cache/.  NOT process.cwd() — the binary
// may run with cwd=/ (EROFS).
const OFFLOAD_THRESHOLD = 800; // characters
const CACHE_DIR = (() => {
  if (process.env.NERVE_DB_PATH) {
    return join(dirname(process.env.NERVE_DB_PATH), "cache");
  }
  return join(homedir(), ".nerve", "cache");
})();

function offloadIfLong(content: string, filename: string): string {
  if (content.length <= OFFLOAD_THRESHOLD) return content;
  mkdirSync(CACHE_DIR, { recursive: true });
  const filePath = join(CACHE_DIR, filename);
  writeFileSync(filePath, content, "utf-8");
  return `[内容较长，已写入本地文件，请用文件读取工具读取完整内容]\n文件路径：${filePath}`;
}

const STATUS_ENUM = z.enum(["pending", "running", "done", "failed", "blocked"]);
const PRIORITY_ENUM = z.enum(["critical", "high", "medium", "low"]);
const TYPE_ENUM = z.enum(["code", "review", "test", "deploy", "research", "custom"]);

export function registerMcpTools(server: McpServer, db: TaskDB, agentInfo: { name?: string; uid?: string }) {
  let _toolCount = 0;
  let _totalDescChars = 0;

  // ─── Core Task Tools ───────────────────────────────────────────────────

  server.tool(
    "create_task",
    "Create a new task",
    {
      title: z.string(),
      projectId: z.string().optional(),
      description: z.string().optional(),
      priority: PRIORITY_ENUM.optional(),
      type: TYPE_ENUM.optional(),
      assignee: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
      creator: z.string().optional(),
    },
    async (args) => {
      const creator = args.creator || agentInfo.uid || undefined;
      const task = db.create({ title: args.title, projectId: args.projectId, description: args.description, priority: args.priority, type: args.type, assignee: args.assignee, dependencies: args.dependencies, creator });
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Create a new task".length;

  server.tool(
    "complete_task",
    "Complete a task: atomically set status to 'done' and write the result. Use this when work is finished.",
    {
      id: z.string(),
      result: z.string(),
    },
    async (args) => {
      const task = db.update(args.id, { status: "done", result: args.result });
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Complete a task: atomically set status to 'done' and write the result. Use this when work is finished.".length;

  server.tool(
    "get_agent_briefing",
    "Get a structured briefing for a task, including full context (description, blockers, events, comments) and action guide. Use this as working context for an AI Agent.",
    {
      task_id: z.string(),
    },
    async (args) => {
      const briefing = db.generateBriefing(args.task_id);
      if (!briefing) return { content: [{ type: "text" as const, text: "Error: task not found" }], isError: true };
      return { content: [{ type: "text" as const, text: briefing }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get a structured briefing for a task, including full context (description, blockers, events, comments) and action guide. Use this as working context for an AI Agent.".length;

  server.tool(
    "claim_task",
    "Claim a task: atomically set status to 'running' and assign it to an agent. Use this to pick up a task before starting work.",
    {
      id: z.string(),
      assignee: z.string(),
    },
    async (args) => {
      const task = db.update(args.id, { status: "running", assignee: args.assignee });
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Claim a task: atomically set status to 'running' and assign it to an agent. Use this to pick up a task before starting work.".length;

  server.tool(
    "update_task",
    "Update task fields (title, description, status, priority, type, assignee, dependencies, result)",
    {
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: STATUS_ENUM.optional(),
      priority: PRIORITY_ENUM.optional(),
      type: TYPE_ENUM.optional(),
      assignee: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
      result: z.string().optional(),
      reflection: z.string().optional(),
      selftestReport: z.string().optional(),
      knownIssues: z.string().optional(),
      uncoveredScope: z.string().optional(),
    },
    async (args) => {
      const { id, ...updates } = args;
      const task = db.update(id, updates);
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Update task fields (title, description, status, priority, type, assignee, dependencies, result, reflection, selftestReport, knownIssues, uncoveredScope)".length;

  server.tool(
    "get_task_context",
    "Get full task context: the task itself, its project (if any), unfinished dependencies, and recent event history. Call this before starting work on a task to inject full context into the current conversation.",
    {
      id: z.string(),
    },
    async (args) => {
      const ctx = db.getTaskContext(args.id);
      if (!ctx) return { content: [{ type: "text" as const, text: "Error: task not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(ctx, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get full task context: the task itself, its project (if any), unfinished dependencies, and recent event history. Call this before starting work on a task to inject full context into the current conversation.".length;

  server.tool(
    "list_tasks",
    "List tasks, optionally filtered by projectId, status, priority, type, and/or assignee",
    {
      projectId: z.string().optional(),
      status: STATUS_ENUM.optional(),
      priority: PRIORITY_ENUM.optional(),
      type: TYPE_ENUM.optional(),
      assignee: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (args) => {
      const tasks = db.list({ projectId: args.projectId, status: args.status, priority: args.priority, type: args.type, assignee: args.assignee, limit: args.limit, offset: args.offset });
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "List tasks, optionally filtered by projectId, status, priority, type, and/or assignee".length;

  server.tool(
    "get_task",
    "Get a task by ID",
    {
      id: z.string(),
    },
    async (args) => {
      const task = db.get(args.id);
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get a task by ID".length;

  server.tool(
    "get_blocked_by",
    "Get unfinished dependencies of a task. Returns a list of tasks that must be completed before this task can start. Use this to check if a task is ready to begin.",
    {
      id: z.string(),
    },
    async (args) => {
      const task = db.get(args.id);
      if (!task) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      const blockedBy = db.getBlockedBy(args.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(blockedBy, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get unfinished dependencies of a task. Returns a list of tasks that must be completed before this task can start. Use this to check if a task is ready to begin.".length;

  server.tool(
    "get_events",
    "Query event log: task creations, status changes, updates, and deletions. Use this to understand what happened in a project or task.",
    {
      projectId: z.string().optional(),
      taskId: z.string().optional(),
      limit: z.number().optional(),
    },
    async (args) => {
      const events = db.getEvents({ projectId: args.projectId, taskId: args.taskId, limit: args.limit });
      return { content: [{ type: "text" as const, text: JSON.stringify(events, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Query event log: task creations, status changes, updates, and deletions. Use this to understand what happened in a project or task.".length;

  server.tool(
    "search_tasks",
    "Search tasks across projects by keyword (matches title and description)",
    {
      query: z.string(),
      project_id: z.string().optional(),
    },
    async (args) => {
      const tasks = db.list({ search: args.query, projectId: args.project_id });
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Search tasks across projects by keyword (matches title and description)".length;

  // ─── Project Tools ─────────────────────────────────────────────────────

  server.tool(
    "create_project",
    "Create a new project to group tasks",
    {
      name: z.string(),
      description: z.string().optional(),
      rules: z.string().optional(),
    },
    async (args) => {
      const project = db.createProject({ name: args.name, description: args.description, rules: args.rules });
      return { content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Create a new project to group tasks".length;

  server.tool(
    "list_projects",
    "List all projects",
    {},
    async () => {
      const projects = db.listProjects();
      return { content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "List all projects".length;

  server.tool(
    "get_project_rules",
    "Get project rules/collaboration guidelines. Returns '(此项目暂无协作规则)' if no rules set.",
    {
      projectId: z.string(),
    },
    async (args) => {
      const project = db.getProject(args.projectId);
      if (!project) return { content: [{ type: "text" as const, text: "Error: project not found" }], isError: true };
      const rules = project.rules || "(此项目暂无协作规则)";
      const safeId = args.projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
      return { content: [{ type: "text" as const, text: offloadIfLong(rules, `rules-project-${safeId}.md`) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get project rules/collaboration guidelines. Returns '(此项目暂无协作规则)' if no rules set.".length;

  server.tool(
    "get_project_context",
    "Get project context: project info, all tasks, and status statistics. Use this to inject project state into a new conversation.",
    {
      projectId: z.string(),
    },
    async (args) => {
      const ctx = db.getProjectContext(args.projectId);
      if (!ctx) return { content: [{ type: "text" as const, text: "Error: project not found" }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(ctx, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get project context: project info, all tasks, and status statistics. Use this to inject project state into a new conversation.".length;

  // ─── Agent Tools ───────────────────────────────────────────────────────

  const AGENT_TYPE_ENUM = z.enum(["webhook", "manual"]);

  server.tool(
    "register_agent",
    "Register or update an Agent profile. If the id already exists, fields are updated (created_at and status are preserved).",
    {
      id: z.string(),
      name: z.string(),
      type: AGENT_TYPE_ENUM,
      endpoint: z.string().optional(),
      heartbeat_interval: z.number().optional(),
      metadata: z.string().optional(),
      capabilities: z.string().optional(),
    },
    async (args) => {
      const agent = db.registerAgent({
        id: args.id,
        name: args.name,
        type: args.type,
        endpoint: args.endpoint,
        heartbeatInterval: args.heartbeat_interval,
        metadata: args.metadata,
        capabilities: args.capabilities,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(agent, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Register or update an Agent profile. If the id already exists, fields are updated (created_at and status are preserved).".length;

  server.tool(
    "list_agents",
    "List all registered Agents and their current status",
    {},
    async () => {
      const agents = db.listAgents();
      return { content: [{ type: "text" as const, text: JSON.stringify(agents, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "List all registered Agents and their current status".length;

  // ─── Agent Credential Tools ─────────────────────────────────────────────

  server.tool(
    "issue_agent_credential",
    "Issue a new agent credential (token). Returns the token only once.",
    {
      agentId: z.string(),
      expiresIn: z.number().optional(),
    },
    async (args) => {
      // Generate token
      const crypto = await import('crypto');
      const randomBytes = new Uint8Array(32);
      crypto.webcrypto.getRandomValues(randomBytes);
      const token = `nh_${btoa(String.fromCharCode(...randomBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
      const keyId = `kid_${crypto.randomUUID().slice(0, 12)}`;
      const tokenHash = hashToken(token);
      
      // Calculate expiration
      let expiresAt: string | undefined;
      if (args.expiresIn) {
        const expiration = new Date();
        expiration.setSeconds(expiration.getSeconds() + args.expiresIn);
        expiresAt = expiration.toISOString();
      }
      
      // Create credential
      const credential = db.createAgentCredential({
        agentId: args.agentId,
        keyId,
        tokenHash,
        expiresAt,
      });
      
      return { content: [{ type: "text" as const, text: JSON.stringify({
        kid: keyId,
        token,
        issued_at: credential.issuedAt,
        expires_at: credential.expiresAt,
      }, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Issue a new agent credential (token). Returns the token only once.".length;

  server.tool(
    "revoke_agent_credential",
    "Revoke an agent credential by key ID",
    {
      kid: z.string(),
    },
    async (args) => {
      const success = db.revokeAgentCredential(args.kid);
      if (!success) {
        return { content: [{ type: "text" as const, text: "Error: credential not found or already revoked" }], isError: true };
      }
      return { content: [{ type: "text" as const, text: "Revoked" }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Revoke an agent credential by key ID".length;

  server.tool(
    "list_agent_credentials",
    "List all credentials for an agent (excludes token plaintext)",
    {
      agentId: z.string(),
    },
    async (args) => {
      const credentials = db.listAgentCredentials(args.agentId);
      // Remove tokenHash for security
      const safeCredentials = credentials.map((cred) => {
        const { tokenHash, ...safe } = cred;
        return safe;
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(safeCredentials, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "List all credentials for an agent (excludes token plaintext)".length;

  server.tool(
    "get_agent_rules",
    "Get the specified Agent's behavior rules (Markdown plain text). Called by Agent on startup to get its own behavior constraints. If agentId is omitted, returns the current agent's rules (based on NERVE_HUB_AGENT_NAME).",
    {
      agentId: z.string().optional(),
    },
    async (args) => {
      const id = args.agentId || agentInfo.name;
      if (!id) return { content: [{ type: "text" as const, text: "Error: no agentId provided and NERVE_HUB_AGENT_NAME is not set. Please set NERVE_HUB_AGENT_NAME in your MCP config, or pass an agentId." }], isError: true };
      const agent = db.getAgent(id);
      if (!agent) return { content: [{ type: "text" as const, text: `Error: agent "${id}" not found. Check your NERVE_HUB_AGENT_NAME or the agentId you passed.` }], isError: true };
      const rules = agent.rules || "(此 Agent 暂无行为规则)";
      const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
      return { content: [{ type: "text" as const, text: offloadIfLong(rules, `rules-agent-${safeId}.md`) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get the specified Agent's behavior rules (Markdown plain text). Called by Agent on startup to get its own behavior constraints. If agentId is omitted, returns the current agent's rules (based on NERVE_HUB_AGENT_NAME).".length;

  server.tool(
    "get_my_rules",
    "Use this on startup to get your own behavior rules. No parameters needed — identifies you automatically via token or NERVE_HUB_AGENT_NAME.",
    {},
    async () => {
      let agentId: string | null = null;
      let authMethod: string = "legacy-env";
      
      // Try token authentication first
      const token = getToken();
      if (token) {
        const tokenHash = hashToken(token);
        const credential = db.getAgentCredentialByTokenHash(tokenHash);
        if (credential) {
          agentId = credential.agentId;
          authMethod = "token";
        }
      }
      
      // Fallback to legacy env
      if (!agentId) {
        agentId = agentInfo.name || null;
      }
      
      if (!agentId) return { content: [{ type: "text" as const, text: "Error: No agent identity found. Please set NERVE_HUB_TOKEN or NERVE_HUB_AGENT_NAME in your MCP config." }], isError: true };
      
      const agent = db.getAgent(agentId);
      if (!agent) return { content: [{ type: "text" as const, text: `Error: agent "${agentId}" not found. Make sure you are registered (try register_agent or contact the project admin).` }], isError: true };
      
      const rules = agent.rules || "(此 Agent 暂无行为规则)";
      const safeId = agentId.replace(/[^a-zA-Z0-9_-]/g, "_");
      return { content: [{ type: "text" as const, text: offloadIfLong(rules, `rules-agent-${safeId}.md`) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Use this on startup to get your own behavior rules. No parameters needed — identifies you automatically via token or NERVE_HUB_AGENT_NAME.".length;

  server.tool(
    "whoami",
    "Return the current agent's identity (agentId + name) as identified via token or NERVE_HUB_AGENT_NAME.",
    {},
    async () => {
      let agentId: string | null = null;
      let agentName: string = "(not set)";
      let authMethod: string = "legacy-env";
      
      // Try token authentication first
      const token = getToken();
      if (token) {
        const tokenHash = hashToken(token);
        const credential = db.getAgentCredentialByTokenHash(tokenHash);
        if (credential) {
          agentId = credential.agentId;
          authMethod = "token";
          const agent = db.getAgent(agentId);
          if (agent) {
            agentName = agent.name;
          }
        }
      }
      
      // Fallback to legacy env
      if (!agentId) {
        agentId = agentInfo.name || "(not set)";
        agentName = agentInfo.name || "(not set)";
      }
      
      return { content: [{ type: "text" as const, text: JSON.stringify({ agentId, name: agentName, authMethod }, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Return the current agent's identity (agentId + name) as identified via token or NERVE_HUB_AGENT_NAME.".length;

  // ─── Comment Tools ─────────────────────────────────────────────────────

  server.tool(
    "create_comment",
    "Add a comment/note to a task",
    {
      task_id: z.string(),
      body: z.string(),
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
  _toolCount++;
  _totalDescChars += "Add a comment/note to a task".length;

  server.tool(
    "list_comments",
    "Get comments for a task (chronological order)",
    {
      task_id: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (args) => {
      const comments = db.listComments(args.task_id, { limit: args.limit, offset: args.offset });
      return { content: [{ type: "text" as const, text: JSON.stringify(comments, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get all comments for a task (chronological order)".length;

  // ─── Handoff Tools ────────────────────────────────────────────────────

  server.tool(
    "get_handoff_queue",
    "Get all tasks assigned to Manual-type Agents that are pending (Handoff Queue).",
    {},
    async () => {
      const tasks = db.getHandoffQueue();
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Get all tasks assigned to Manual-type Agents that are pending (Handoff Queue).".length;

  // ─── Deletion Tools ────────────────────────────────────────────────────

  server.tool(
    "delete_task",
    "Delete a task",
    {
      id: z.string(),
    },
    async (args) => {
      const ok = db.delete(args.id);
      if (!ok) return { content: [{ type: "text" as const, text: "Error: not found" }], isError: true };
      return { content: [{ type: "text" as const, text: "Deleted" }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Delete a task".length;

  server.tool(
    "delete_comment",
    "Delete a comment",
    {
      comment_id: z.string(),
    },
    async (args) => {
      const ok = db.deleteComment(args.comment_id);
      if (!ok) return { content: [{ type: "text" as const, text: "Error: comment not found" }], isError: true };
      return { content: [{ type: "text" as const, text: "Deleted" }] };
    }
  );
  _toolCount++;
  _totalDescChars += "Delete a comment".length;

  // Audit: log tool count and description character count
  console.error(`[nerve-hub] Registered ${_toolCount} tools (total desc chars: ${_totalDescChars})`);
}

export async function startMcp(db: TaskDB) {
  // Keep stdin open so the Node.js event loop never exits prematurely.
  // This is critical: some MCP clients (e.g. 悟空钉钉) spawn the process
  // and expect it to stay alive until the client closes the pipe.
  process.stdin.resume();

  const server = new McpServer(
    { name: "nerve-hub", version: "0.2.0" },
    { capabilities: { tools: {} } }
  );

  registerMcpTools(server, db, {
    name: process.env.NERVE_HUB_AGENT_NAME,
    uid: process.env.NERVE_HUB_AGENT_UID
  });

  // ─── Connect ─────────────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
