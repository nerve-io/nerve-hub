/**
 * api.ts — REST API. 5 endpoints, no abstractions.
 * Uses Bun.serve() — zero dependencies.
 *
 * POST   /tasks          — create task
 * GET    /tasks           — list tasks (?status=pending)
 * GET    /tasks/:id       — get task
 * PATCH  /tasks/:id       — update task
 * DELETE /tasks/:id       — delete task
 */

import type { TaskDB, CreateTaskInput, UpdateTaskInput } from "./db.js";

export function createServer(db: TaskDB, port = 3141) {
  const server = Bun.serve({
    port,
    hostname: "0.0.0.0",
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      // ─── Health ──────────────────────────────────────────────────────────
      if (path === "/health") {
        return Response.json({ status: "ok" });
      }

      // ─── POST /tasks ────────────────────────────────────────────────────
      if (path === "/tasks" && req.method === "POST") {
        const body = req.json() as Promise<CreateTaskInput>;
        return body.then((input) => {
          if (!input.title) return Response.json({ error: "title is required" }, { status: 400 });
          const task = db.create(input);
          return Response.json(task, { status: 201 });
        });
      }

      // ─── GET /tasks ─────────────────────────────────────────────────────
      if (path === "/tasks" && req.method === "GET") {
        const status = url.searchParams.get("status") || undefined;
        return Response.json(db.list(status));
      }

      // ─── GET /tasks/:id ─────────────────────────────────────────────────
      const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
      if (taskMatch && req.method === "GET") {
        const task = db.get(taskMatch[1]);
        if (!task) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json(task);
      }

      // ─── PATCH /tasks/:id ───────────────────────────────────────────────
      if (taskMatch && req.method === "PATCH") {
        const body = req.json() as Promise<UpdateTaskInput>;
        return body.then((input) => {
          const task = db.update(taskMatch[1], input);
          if (!task) return Response.json({ error: "not found" }, { status: 404 });
          return Response.json(task);
        });
      }

      // ─── DELETE /tasks/:id ──────────────────────────────────────────────
      if (taskMatch && req.method === "DELETE") {
        const ok = db.delete(taskMatch[1]);
        if (!ok) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json({ deleted: true });
      }

      // ─── 404 ────────────────────────────────────────────────────────────
      return Response.json({ error: "not found" }, { status: 404 });
    },
  });

  console.log(`nerve-hub API: http://localhost:${port}`);
  return server;
}
