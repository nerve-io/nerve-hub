import path from "path";
import { NerveCore } from "../../core/engine.js";

function getCore(): NerveCore {
  const dbPath = path.join(process.cwd(), ".nerve", "hub.db");
  return new NerveCore(dbPath);
}

function print(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

export async function eventListCommand(options: {
  projectId: string;
  limit?: string;
}) {
  const core = getCore();
  const limit = options.limit ? parseInt(options.limit, 10) : 50;
  const events = core.listEvents(options.projectId, limit);
  print(events);
  core.close();
}
