/**
 * api.ts — REST API. No abstractions.
 * Uses Bun.serve() — zero dependencies.
 *
 * Projects:
 *   POST   /projects          — create project
 *   GET    /projects          — list projects
 *   GET    /projects/:id      — get project
 *   DELETE /projects/:id      — delete project
 *   GET    /projects/:id/context — project context (tasks + stats)
 *
 * Tasks:
 *   POST   /tasks             — create task
 *   GET    /tasks             — list tasks (?projectId=&status=&priority=&type=&assignee=)
 *   GET    /tasks/:id         — get task
 *   GET    /tasks/:id/context — task context (project + blockedBy + events)
 *   GET    /tasks/:id/blocked-by — get unfinished dependencies
 *   PATCH  /tasks/:id         — update task
 *   DELETE /tasks/:id         — delete task
 *
 * Events:
 *   GET    /events            — list events (?projectId=&taskId=&limit=)
 */

import type { TaskDB, CreateTaskInput, CreateProjectInput, UpdateTaskInput, AgentType, AgentStatus } from "./db.js";

const VALID_STATUSES = new Set(["pending", "running", "done", "failed", "blocked"]);
const VALID_PRIORITIES = new Set(["critical", "high", "medium", "low"]);
const VALID_TYPES = new Set(["code", "review", "test", "deploy", "research", "custom"]);
const VALID_AGENT_TYPES = new Set(["webhook", "manual"]);
const VALID_AGENT_STATUSES = new Set(["online", "offline", "busy"]);

function json(req: Request): Promise<any> {
  return req.json().catch(() => null);
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function isValidDependencies(val: any): boolean {
  return Array.isArray(val) && val.every((v: any) => typeof v === "string");
}

const FIELD_LENGTHS: Record<string, number> = {
  "project.name": 100,
  "project.description": 2000,
  "task.title": 200,
  "task.description": 5000,
  "task.result": 5000,
  "task.assignee": 100,
  "comment.body": 2000,
  "agent.id": 64,
  "agent.name": 128,
};

function validateLength(value: string, field: string): string | null {
  const max = FIELD_LENGTHS[field];
  if (max !== undefined && typeof value === "string" && value.length > max) {
    return `${field.split(".").pop()} must be ${max} characters or less`;
  }
  return null;
}

function getActor(req: Request): string {
  return req.headers.get("x-nerve-agent") || "system";
}

export function createServer(db: TaskDB, port = 3141) {
  // ─── WebSocket clients ──────────────────────────────────────────────
  const clients = new Set<import("bun").ServerWebSocket<unknown>>();

  function broadcast(event: { type: string; projectId?: string; taskId?: string; agentId?: string; status?: string }) {
    const msg = JSON.stringify(event);
    for (const ws of clients) {
      try { ws.send(msg); } catch { clients.delete(ws); }
    }
  }

  const server = Bun.serve({
    port,
    hostname: "0.0.0.0",
    async fetch(req, server) {
      try {
        const url = new URL(req.url);
        const rawPath = url.pathname;

        // ─── WebSocket upgrade ─────────────────────────────────────────
        if (rawPath === "/ws") {
          const ok = server.upgrade(req);
          if (ok) return undefined;
          return new Response("WebSocket upgrade failed", { status: 400 });
        }

        // ─── Strip /api prefix (frontend uses /api/* for all requests) ───
        const path = rawPath.startsWith("/api/")
          ? rawPath.slice(4)
          : rawPath === "/api"
          ? "/"
          : rawPath;

        // ─── Static files (serve web/dist/ for non-/api paths) ──────────
        if (!rawPath.startsWith("/api")) {
          const distPath = new URL("../../web/dist", import.meta.url).pathname;
          // Serve index.html for SPA routes
          const filePath = rawPath === "/" || !rawPath.includes(".")
            ? `${distPath}/index.html`
            : `${distPath}${rawPath}`;
          const file = Bun.file(filePath);
          if (await file.exists()) {
            return new Response(file);
          }
          // Fallback to index.html for client-side routing
          const indexFile = Bun.file(`${distPath}/index.html`);
          if (await indexFile.exists()) {
            return new Response(indexFile, { headers: { "Content-Type": "text/html" } });
          }
        }

        // ─── Health ──────────────────────────────────────────────────────
        if (path === "/health") {
          return Response.json({ status: "ok" });
        }

        // ─── GET /events ────────────────────────────────────────────────
        if (path === "/events" && req.method === "GET") {
          const projectId = url.searchParams.get("projectId") || undefined;
          const taskId = url.searchParams.get("taskId") || undefined;
          const limitParam = url.searchParams.get("limit");
          const limit = limitParam ? parseInt(limitParam, 10) : undefined;
          if (limitParam && (isNaN(limit!) || limit! < 1)) {
            return badRequest("limit must be a positive integer");
          }
          return Response.json(db.getEvents({ projectId, taskId, limit }));
        }

        // ─── POST /projects ─────────────────────────────────────────────
        if (path === "/projects" && req.method === "POST") {
          const body = await json(req);
          if (body === null) return badRequest("invalid JSON");
          if (!body.name || typeof body.name !== "string") return badRequest("name is required (string)");
          const nameErr = validateLength(body.name, "project.name");
          if (nameErr) return badRequest(nameErr);
          if (body.description !== undefined) {
            const descErr = validateLength(body.description, "project.description");
            if (descErr) return badRequest(descErr);
          }
          const project = db.createProject(body as CreateProjectInput);
          broadcast({ type: "project.created", projectId: project.id });
          return Response.json(project, { status: 201 });
        }

        // ─── GET /projects ──────────────────────────────────────────────
        if (path === "/projects" && req.method === "GET") {
          return Response.json(db.listProjects());
        }

        // ─── GET /projects/:id ──────────────────────────────────────────
        const projectMatch = path.match(/^\/projects\/([^/]+)$/);
        if (projectMatch && req.method === "GET") {
          const project = db.getProject(projectMatch[1]);
          if (!project) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(project);
        }

        // ─── DELETE /projects/:id ───────────────────────────────────────
        if (projectMatch && req.method === "DELETE") {
          const ok = db.deleteProject(projectMatch[1]);
          if (!ok) return Response.json({ error: "not found" }, { status: 404 });
          broadcast({ type: "project.deleted", projectId: projectMatch[1] });
          return Response.json({ deleted: true });
        }

        // ─── GET /projects/:id/context ──────────────────────────────────
        const projectContextMatch = path.match(/^\/projects\/([^/]+)\/context$/);
        if (projectContextMatch && req.method === "GET") {
          const ctx = db.getProjectContext(projectContextMatch[1]);
          if (!ctx) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(ctx);
        }

        // ─── GET /projects/:id/blocked-statuses ─────────────────────────
        const projectBlockedStatusesMatch = path.match(/^\/projects\/([^/]+)\/blocked-statuses$/);
        if (projectBlockedStatusesMatch && req.method === "GET") {
          const project = db.getProject(projectBlockedStatusesMatch[1]);
          if (!project) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(db.getProjectBlockedStatuses(projectBlockedStatusesMatch[1]));
        }

        // ─── POST /tasks ────────────────────────────────────────────────
        if (path === "/tasks" && req.method === "POST") {
          const body = await json(req);
          if (body === null) return badRequest("invalid JSON");
          if (!body.title || typeof body.title !== "string") return badRequest("title is required (string)");
          const titleErr = validateLength(body.title, "task.title");
          if (titleErr) return badRequest(titleErr);
          if (body.description !== undefined) {
            const descErr = validateLength(body.description, "task.description");
            if (descErr) return badRequest(descErr);
          }
          if (body.assignee !== undefined) {
            const assigneeErr = validateLength(body.assignee, "task.assignee");
            if (assigneeErr) return badRequest(assigneeErr);
          }
          if (body.result !== undefined) {
            const resultErr = validateLength(body.result, "task.result");
            if (resultErr) return badRequest(resultErr);
          }
          if (body.dependencies !== undefined && !isValidDependencies(body.dependencies)) {
            return badRequest("dependencies must be an array of strings");
          }
          if (body.dependencies !== undefined) {
            const depError = db.validateDependencies(null, body.dependencies);
            if (depError) return badRequest(depError);
          }
          const actor = getActor(req);
          const task = db.create(body as CreateTaskInput, actor);
          broadcast({ type: "task.created", projectId: task.projectId, taskId: task.id });
          return Response.json(task, { status: 201 });
        }

        // ─── GET /tasks ─────────────────────────────────────────────────
        if (path === "/tasks" && req.method === "GET") {
          const projectId = url.searchParams.get("projectId") || undefined;
          const status = url.searchParams.get("status") || undefined;
          const priority = url.searchParams.get("priority") || undefined;
          const type = url.searchParams.get("type") || undefined;
          const assignee = url.searchParams.get("assignee") || undefined;
          const search = url.searchParams.get("search") || undefined;

          if (status && !VALID_STATUSES.has(status)) {
            return badRequest(`invalid status: "${status}". must be one of: pending, running, done, failed, blocked`);
          }
          if (priority && !VALID_PRIORITIES.has(priority)) {
            return badRequest(`invalid priority: "${priority}". must be one of: critical, high, medium, low`);
          }
          if (type && !VALID_TYPES.has(type)) {
            return badRequest(`invalid type: "${type}". must be one of: code, review, test, deploy, research, custom`);
          }

          return Response.json(db.list({ projectId, status, priority, type, assignee, search }));
        }

        // ─── GET /tasks/:id ─────────────────────────────────────────────
        const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
        if (taskMatch && req.method === "GET") {
          const task = db.get(taskMatch[1]);
          if (!task) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(task);
        }

        // ─── GET /tasks/:id/context ─────────────────────────────────────
        const taskContextMatch = path.match(/^\/tasks\/([^/]+)\/context$/);
        if (taskContextMatch && req.method === "GET") {
          const ctx = db.getTaskContext(taskContextMatch[1]);
          if (!ctx) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(ctx);
        }

        // ─── GET /tasks/:id/blocked-by ──────────────────────────────────
        const blockedByMatch = path.match(/^\/tasks\/([^/]+)\/blocked-by$/);
        if (blockedByMatch && req.method === "GET") {
          const task = db.get(blockedByMatch[1]);
          if (!task) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(db.getBlockedBy(blockedByMatch[1]));
        }

        // ─── PATCH /tasks/:id ───────────────────────────────────────────
        if (taskMatch && req.method === "PATCH") {
          const body = await json(req);
          if (body === null) return badRequest("invalid JSON");
          if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
            return badRequest(`invalid status: "${body.status}". must be one of: pending, running, done, failed, blocked`);
          }
          if (body.priority !== undefined && !VALID_PRIORITIES.has(body.priority)) {
            return badRequest(`invalid priority: "${body.priority}". must be one of: critical, high, medium, low`);
          }
          if (body.type !== undefined && !VALID_TYPES.has(body.type)) {
            return badRequest(`invalid type: "${body.type}". must be one of: code, review, test, deploy, research, custom`);
          }
          if (body.title !== undefined) {
            const titleErr = validateLength(body.title, "task.title");
            if (titleErr) return badRequest(titleErr);
          }
          if (body.description !== undefined) {
            const descErr = validateLength(body.description, "task.description");
            if (descErr) return badRequest(descErr);
          }
          if (body.assignee !== undefined) {
            const assigneeErr = validateLength(body.assignee, "task.assignee");
            if (assigneeErr) return badRequest(assigneeErr);
          }
          if (body.result !== undefined) {
            const resultErr = validateLength(body.result, "task.result");
            if (resultErr) return badRequest(resultErr);
          }
          if (body.dependencies !== undefined && !isValidDependencies(body.dependencies)) {
            return badRequest("dependencies must be an array of strings");
          }
          if (body.dependencies !== undefined) {
            const depError = db.validateDependencies(taskMatch[1], body.dependencies);
            if (depError) return badRequest(depError);
          }
          const actor = getActor(req);
          const task = db.update(taskMatch[1], body as UpdateTaskInput, actor);
          if (!task) return Response.json({ error: "not found" }, { status: 404 });
          broadcast({ type: "task.updated", projectId: task.projectId, taskId: task.id });
          return Response.json(task);
        }

        // ─── DELETE /tasks/:id ──────────────────────────────────────────
        if (taskMatch && req.method === "DELETE") {
          const actor = getActor(req);
          const existing = db.get(taskMatch[1]);
          if (!existing) return Response.json({ error: "not found" }, { status: 404 });
          db.delete(taskMatch[1], actor);
          broadcast({ type: "task.deleted", projectId: existing.projectId, taskId: taskMatch[1] });
          return Response.json({ deleted: true });
        }

        // ─── GET /tasks/:id/comments ──────────────────────────────────────
        const taskCommentsMatch = path.match(/^\/tasks\/([^/]+)\/comments$/);
        if (taskCommentsMatch && req.method === "GET") {
          const task = db.get(taskCommentsMatch[1]);
          if (!task) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(db.listComments(taskCommentsMatch[1]));
        }

        // ─── POST /tasks/:id/comments ─────────────────────────────────────
        if (taskCommentsMatch && req.method === "POST") {
          const task = db.get(taskCommentsMatch[1]);
          if (!task) return Response.json({ error: "not found" }, { status: 404 });
          const body = await json(req);
          if (body === null) return badRequest("invalid JSON");
          if (!body.body || typeof body.body !== "string") return badRequest("body is required (string)");
          if (!body.body.trim()) return badRequest("body must not be empty");
          const bodyErr = validateLength(body.body, "comment.body");
          if (bodyErr) return badRequest(bodyErr);
          const actor = getActor(req);
          const comment = db.createComment({ taskId: taskCommentsMatch[1], body: body.body.trim() }, actor);
          broadcast({ type: "task.commented", projectId: task.projectId, taskId: taskCommentsMatch[1] });
          return Response.json(comment, { status: 201 });
        }

        // ─── DELETE /comments/:id ────────────────────────────────────────
        const commentMatch = path.match(/^\/comments\/([^/]+)$/);
        if (commentMatch && req.method === "DELETE") {
          const comment = db.getComment(commentMatch[1]);
          if (!comment) return Response.json({ error: "not found" }, { status: 404 });
          db.deleteComment(commentMatch[1]);
          broadcast({ type: "task.comment_deleted", projectId: comment.projectId, taskId: comment.taskId });
          return Response.json({ deleted: true });
        }

        // ─── Agents ──────────────────────────────────────────────────────

        // GET /agents
        if (path === "/agents" && req.method === "GET") {
          return Response.json(db.listAgents());
        }

        // POST /agents
        if (path === "/agents" && req.method === "POST") {
          const body = await json(req);
          if (body === null) return badRequest("invalid JSON");
          if (!body.id || typeof body.id !== "string") return badRequest("id is required (string)");
          if (!body.name || typeof body.name !== "string") return badRequest("name is required (string)");
          if (!body.type || typeof body.type !== "string") return badRequest("type is required (string)");
          if (!VALID_AGENT_TYPES.has(body.type)) return badRequest('type must be "webhook" or "manual"');
          if (body.type === "webhook") {
            if (!body.endpoint || typeof body.endpoint !== "string") return badRequest("endpoint is required for webhook type");
            try { new URL(body.endpoint); } catch { return badRequest("endpoint must be a valid URL"); }
          }
          const idErr = validateLength(body.id, "agent.id");
          if (idErr) return badRequest(idErr);
          const nameErr = validateLength(body.name, "agent.name");
          if (nameErr) return badRequest(nameErr);

          const existing = db.getAgent(body.id);
          const agent = db.registerAgent({
            id: body.id,
            name: body.name,
            type: body.type as AgentType,
            endpoint: body.endpoint,
            heartbeatInterval: body.heartbeatInterval,
            metadata: body.metadata,
          });
          broadcast({ type: "agent.updated", agentId: agent.id });
          return Response.json(agent, { status: existing ? 200 : 201 });
        }

        // GET /agents/:id
        const agentMatch = path.match(/^\/agents\/([^/]+)$/);
        if (agentMatch && req.method === "GET") {
          const agent = db.getAgent(agentMatch[1]);
          if (!agent) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(agent);
        }

        // DELETE /agents/:id
        if (agentMatch && req.method === "DELETE") {
          const ok = db.deleteAgent(agentMatch[1]);
          if (!ok) return Response.json({ error: "not found" }, { status: 404 });
          broadcast({ type: "agent.deleted", agentId: agentMatch[1] });
          return Response.json({ deleted: true });
        }

        // PATCH /agents/:id/status
        const agentStatusMatch = path.match(/^\/agents\/([^/]+)\/status$/);
        if (agentStatusMatch && req.method === "PATCH") {
          const body = await json(req);
          if (body === null) return badRequest("invalid JSON");
          if (!body.status || typeof body.status !== "string") return badRequest("status is required (string)");
          if (!VALID_AGENT_STATUSES.has(body.status)) return badRequest('status must be "online", "offline", or "busy"');
          const ok = db.updateAgentStatus(agentStatusMatch[1], body.status as AgentStatus);
          if (!ok) return Response.json({ error: "not found" }, { status: 404 });
          broadcast({ type: "agent.status_changed", agentId: agentStatusMatch[1], status: body.status });
          return Response.json(db.getAgent(agentStatusMatch[1]));
        }

        // ─── Handoff Queue ───────────────────────────────────────────────

        // GET /handoff
        if (path === "/handoff" && req.method === "GET") {
          return Response.json(db.getHandoffQueue());
        }

        // GET /tasks/:id/briefing
        const briefingMatch = path.match(/^\/tasks\/([^/]+)\/briefing$/);
        if (briefingMatch && req.method === "GET") {
          const briefing = db.generateBriefing(briefingMatch[1]);
          if (!briefing) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json({ taskId: briefingMatch[1], briefing });
        }

        // ─── Webhooks ───────────────────────────────────────────────────

        // POST /webhooks/callback
        if (path === "/webhooks/callback" && req.method === "POST") {
          const body = await json(req);
          if (body === null) return badRequest("invalid JSON");
          if (!body.task_id || typeof body.task_id !== "string") return badRequest("task_id is required");
          if (!body.status || typeof body.status !== "string") return badRequest("status is required");
          if (!["done", "failed"].includes(body.status)) return badRequest('status must be "done" or "failed"');
          if (!body.result || typeof body.result !== "string") return badRequest("result is required (string)");

          const task = db.get(body.task_id);
          if (!task) return Response.json({ error: "task not found" }, { status: 404 });

          db.update(body.task_id, { status: body.status, result: body.result });

          // Update agent status back to online if it was busy
          if (task.assignee) {
            const agent = db.getAgent(task.assignee);
            if (agent && agent.status === "busy") {
              db.updateAgentStatus(task.assignee, "online");
            }
          }

          broadcast({ type: "task.updated", projectId: task.projectId, taskId: body.task_id });
          return Response.json({ ok: true });
        }

        // POST /webhooks/heartbeat
        if (path === "/webhooks/heartbeat" && req.method === "POST") {
          const body = await json(req);
          if (body === null) return badRequest("invalid JSON");
          if (!body.agent_id || typeof body.agent_id !== "string") return badRequest("agent_id is required");
          if (!body.status || typeof body.status !== "string") return badRequest("status is required");
          if (!["online", "busy"].includes(body.status)) return badRequest('status must be "online" or "busy"');

          const ok = db.updateAgentStatus(body.agent_id, body.status as AgentStatus, new Date().toISOString());
          if (!ok) return Response.json({ error: "agent not found" }, { status: 404 });

          broadcast({ type: "agent.status_changed", agentId: body.agent_id, status: body.status });
          return Response.json({ ok: true });
        }

        // ─── 404 ────────────────────────────────────────────────────────
        return Response.json({ error: "not found" }, { status: 404 });
      } catch (err) {
        console.error(`[api] unhandled: ${err}`);
        return Response.json({ error: "internal server error" }, { status: 500 });
      }
    },
    websocket: {
      open(ws) { clients.add(ws); },
      close(ws) { clients.delete(ws); },
      message() { /* no client messages expected */ },
    },
  });

  console.log(`nerve-hub API: http://localhost:${port}`);
  return { server, broadcast };
}
