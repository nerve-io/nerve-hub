import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { FastifyInstance } from "fastify";
import type { NerveCore } from "../core/engine.js";
import { createMcpServer } from "../mcp/index.js";

// Store active SSE transports by session ID
const transports: Record<string, SSEServerTransport> = {};

export async function registerMcpSSE(app: FastifyInstance, core: NerveCore) {
  // SSE endpoint — client connects here to establish the stream
  app.get("/mcp", async (request, reply) => {
    const rawRes = reply.raw;

    try {
      const transport = new SSEServerTransport("/mcp/message", rawRes);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      transport.onclose = () => {
        delete transports[sessionId];
      };

      // Create a new MCP server instance per connection
      const server = createMcpServer(core);
      await server.connect(transport);
    } catch (error) {
      console.error("Error establishing SSE stream:", error);
      if (!rawRes.headersSent) {
        rawRes.statusCode = 500;
        rawRes.end("Error establishing SSE stream");
      }
    }
  });

  // Message endpoint — client posts JSON-RPC messages here
  app.post("/mcp/message", async (request, reply) => {
    const sessionId = (request.query as Record<string, string>).sessionId;
    if (!sessionId) {
      reply.status(400).send({ error: "Missing sessionId parameter" });
      return;
    }

    const transport = transports[sessionId];
    if (!transport) {
      reply.status(404).send({ error: "Session not found" });
      return;
    }

    try {
      await transport.handlePostMessage(request.raw, reply.raw, request.body);
    } catch (error) {
      console.error("Error handling MCP message:", error);
      if (!reply.sent) {
        reply.status(500).send({ error: "Error handling message" });
      }
    }
  });

  // CORS preflight
  app.options("/mcp*", async (_request, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type")
      .send();
  });
}
