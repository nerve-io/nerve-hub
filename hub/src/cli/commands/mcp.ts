import path from "path";
import { startMcpServer } from "../../mcp/index.js";

export async function mcpCommand() {
  const dbPath = path.join(process.cwd(), ".nerve", "hub.db");
  await startMcpServer(dbPath);
}
