import path from "path";
import { NerveCore } from "../../core/engine.js";
import { startServer } from "../../api/index.js";

export async function startCommand(options: { port?: number; host?: string }) {
  const port = options.port || 3141;
  const host = options.host || "0.0.0.0";
  const dbPath = path.join(process.cwd(), ".nerve", "hub.db");

  console.log(`Starting Nerve Hub...`);
  console.log(`  Database: ${dbPath}`);
  console.log(`  Port: ${port}`);

  const core = new NerveCore(dbPath);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down Nerve Hub...");
    core.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await startServer(core, port, host);
}
