import type { FastifyPluginAsync } from "fastify";
import type { NerveCore } from "../../core/engine.js";

export const taskRoutes: FastifyPluginAsync<{ core: NerveCore }> = async (
  fastify,
  opts
) => {
  const { core } = opts;

  // Helper to extract actor from headers
  const getActor = (request: any): string => {
    return (
      (request.headers["x-nerve-agent"] as string) || "anonymous"
    );
  };

  // POST /api/v1/tasks
  fastify.post("/tasks", async (request, reply) => {
    const body = request.body as any;
    if (!body?.projectId || !body?.title) {
      return reply
        .status(400)
        .send({ error: "projectId and title are required" });
    }
    try {
      const task = core.createTask(
        {
          projectId: body.projectId,
          parentId: body.parentId,
          title: body.title,
          description: body.description,
          type: body.type,
          priority: body.priority,
          assignee: body.assignee,
          dependencies: body.dependencies,
          metadata: body.metadata,
          tags: body.tags,
        },
        getActor(request)
      );
      return reply.status(201).send(task);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/v1/tasks
  fastify.get("/tasks", async (request, reply) => {
    const query = request.query as any;
    try {
      const tasks = core.queryTasks({
        projectId: query.projectId,
        status: query.status,
        assignee: query.assignee,
        type: query.type,
      });
      return reply.send(tasks);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/v1/tasks/:id
  fastify.get("/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = core.getTask(id);
    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }
    return reply.send(task);
  });

  // PATCH /api/v1/tasks/:id
  fastify.patch("/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const task = core.updateTask(id, body, getActor(request));
      if (!task) {
        return reply.status(404).send({ error: "Task not found" });
      }
      return reply.send(task);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // DELETE /api/v1/tasks/:id
  fastify.delete("/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = core.deleteTask(id, getActor(request));
      if (!deleted) {
        return reply.status(404).send({ error: "Task not found" });
      }
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/v1/tasks/:id/logs
  fastify.get("/tasks/:id/logs", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 100;
    try {
      const logs = core.listStateLogs(id, limit);
      return reply.send(logs);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
};
