import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import type { NerveCore } from "../core/engine.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp(core: NerveCore) {
  const app = Fastify({
    logger: false,
  });

  // Register routes with core as plugin options
  await app.register(projectRoutes, { core, prefix: "/api/v1" });
  await app.register(taskRoutes, { core, prefix: "/api/v1" });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "nerve-hub", version: "0.1.0" };
  });

  // Serve static web UI (built frontend)
  const webDist = path.join(__dirname, "..", "..", "web", "dist");
  try {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: "/",
      serve: true,
    });
    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith("/api")) {
        reply.sendFile("index.html");
      } else {
        reply.status(404).send({ error: "Not found" });
      }
    });
  } catch {
    // Web UI not built yet, skip static serving
    console.log("  Web UI not found at", webDist, "- skipping static serving");
  }

  return app;
}

export async function startServer(
  core: NerveCore,
  port = 3141,
  host = "0.0.0.0"
) {
  const app = await createApp(core);
  try {
    const address = await app.listen({ port, host });
    console.log(`Nerve Hub API listening on ${address}`);
    return app;
  } catch (err) {
    app.log.error(err);
    throw err;
  }
}
