import Fastify from "fastify";
import cors from "@fastify/cors";
import type { NerveCore } from "../core/engine.js";
import { CreateTaskInputSchema, UpdateTaskInputSchema } from "../core/models.js";

export interface ApiOptions {
  port?: number;
  host?: string;
  cors?: boolean;
}

export async function createApiServer(core: NerveCore, options: ApiOptions = {}) {
  const { port = 3141, host = "0.0.0.0", cors: enableCors = true } = options;

  const app = Fastify({ logger: true });

  if (enableCors) {
    await app.register(cors, { origin: true });
  }

  // ── Health check ──────────────────────────────────────────────────

  app.get("/health", async () => ({ status: "ok", service: "nerve-hub" }));

  // ── Tasks ─────────────────────────────────────────────────────────

  app.post("/api/v1/tasks", async (request, reply) => {
    const body = CreateTaskInputSchema.parse(request.body);
    const agent = (request.headers["x-nerve-agent"] as string) ?? "system";
    const task = core.tasks.create({ ...body, assignee: body.assignee ?? agent });
    return reply.status(201).send(task);
  });

  app.get("/api/v1/tasks", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const tasks = core.tasks.query({
      projectId: query.projectId,
      status: query.status,
      assignee: query.assignee,
      type: query.type,
    });
    return reply.status(200).send(tasks);
  });

  app.get("/api/v1/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = core.tasks.get(id);
    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }
    return reply.status(200).send(task);
  });

  app.patch("/api/v1/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateTaskInputSchema.parse(request.body);
    const agent = (request.headers["x-nerve-agent"] as string) ?? "system";
    const task = core.tasks.update(id, body, agent);
    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }
    return reply.status(200).send(task);
  });

  app.delete("/api/v1/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = core.tasks.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: "Task not found" });
    }
    return reply.status(200).send({ ok: true });
  });

  // ── Projects ──────────────────────────────────────────────────────

  app.get("/api/v1/projects", async (_request, reply) => {
    const projects = core.projects.list();
    return reply.status(200).send(projects);
  });

  app.post("/api/v1/projects", async (request, reply) => {
    const body = request.body as { name: string; description?: string; metadata?: Record<string, unknown> };
    if (!body.name) {
      return reply.status(400).send({ error: "name is required" });
    }
    const project = core.projects.create(body.name, body.description, body.metadata);
    return reply.status(201).send(project);
  });

  app.get("/api/v1/projects/:id/board", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = core.projects.get(id);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    const board = core.projects.getBoard(id);
    return reply.status(200).send(board);
  });

  // ── Events ────────────────────────────────────────────────────────

  app.get("/api/v1/events", async (request, reply) => {
    const query = request.query as Record<string, string>;
    if (!query.projectId) {
      return reply.status(400).send({ error: "projectId query parameter is required" });
    }
    const events = core.events.list(query.projectId, query.since);
    return reply.status(200).send(events);
  });

  // ── Start ─────────────────────────────────────────────────────────

  return {
    app,
    listen: async () => {
      const address = await app.listen({ port, host });
      return address;
    },
    close: async () => {
      await app.close();
    },
  };
}
