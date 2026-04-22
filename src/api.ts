/**
 * api.ts — REST API. 5 endpoints, no abstractions.
 *
 * POST   /tasks          — create task
 * GET    /tasks           — list tasks (?status=pending)
 * GET    /tasks/:id       — get task
 * PATCH  /tasks/:id       — update task
 * DELETE /tasks/:id       — delete task
 */

import Fastify from "fastify";
import type { TaskDB, CreateTaskInput, UpdateTaskInput } from "./db.js";

export async function createServer(db: TaskDB, port = 3141) {
  const app = Fastify({ logger: true });

  // ─── Routes ──────────────────────────────────────────────────────────────

  app.post<{ Body: CreateTaskInput }>("/tasks", async (req, reply) => {
    const { title, description } = req.body ?? {} as any;
    if (!title) return reply.status(400).send({ error: "title is required" });
    const task = db.create({ title, description });
    return reply.status(201).send(task);
  });

  app.get<{ Querystring: { status?: string } }>("/tasks", async (req) => {
    return db.list(req.query.status);
  });

  app.get<{ Params: { id: string } }>("/tasks/:id", async (req, reply) => {
    const task = db.get(req.params.id);
    if (!task) return reply.status(404).send({ error: "not found" });
    return task;
  });

  app.patch<{ Params: { id: string }; Body: UpdateTaskInput }>("/tasks/:id", async (req, reply) => {
    const task = db.update(req.params.id, req.body);
    if (!task) return reply.status(404).send({ error: "not found" });
    return task;
  });

  app.delete<{ Params: { id: string } }>("/tasks/:id", async (req, reply) => {
    const ok = db.delete(req.params.id);
    if (!ok) return reply.status(404).send({ error: "not found" });
    return { deleted: true };
  });

  // ─── Health ──────────────────────────────────────────────────────────────

  app.get("/health", async () => ({ status: "ok" }));

  // ─── Start ───────────────────────────────────────────────────────────────

  const address = await app.listen({ port, host: "0.0.0.0" });
  console.log(`nerve-hub API: ${address}`);
  return app;
}
