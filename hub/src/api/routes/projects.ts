import type { FastifyPluginAsync } from "fastify";
import type { NerveCore } from "../../core/engine.js";

export const projectRoutes: FastifyPluginAsync<{ core: NerveCore }> = async (
  fastify,
  opts
) => {
  const { core } = opts;

  // POST /api/v1/projects
  fastify.post("/projects", async (request, reply) => {
    const body = request.body as any;
    if (!body?.name) {
      return reply.status(400).send({ error: "name is required" });
    }
    try {
      const project = core.createProject({
        name: body.name,
        description: body.description,
        metadata: body.metadata,
      });
      return reply.status(201).send(project);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/v1/projects
  fastify.get("/projects", async (_request, reply) => {
    try {
      const projects = core.listProjects();
      return reply.send(projects);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/v1/projects/:id
  fastify.get("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = core.getProject(id);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    return reply.send(project);
  });

  // GET /api/v1/projects/:id/board
  fastify.get("/projects/:id/board", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = core.getProject(id);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    const board = core.getProjectBoard(id);
    return reply.send({ project, board });
  });

  // GET /api/v1/projects/:id/context
  fastify.get("/projects/:id/context", async (request, reply) => {
    const { id } = request.params as { id: string };
    const context = core.getProjectContext(id);
    if (!context.project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    return reply.send(context);
  });

  // GET /api/v1/projects/:id/events
  fastify.get("/projects/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 100;
    try {
      const events = core.listEvents(id, limit);
      return reply.send(events);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
};
