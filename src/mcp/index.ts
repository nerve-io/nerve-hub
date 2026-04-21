import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NerveCore } from "../core/engine.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

export function createMcpServer(core: NerveCore) {
  const server = new McpServer(
    {
      name: "nerve-hub",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  registerTools(server, core);
  registerResources(server, core);

  return server;
}

export async function startMcpServer(dbPath: string) {
  const core = new NerveCore(dbPath);
  const server = createMcpServer(core);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    core.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    core.close();
    process.exit(0);
  });
}
