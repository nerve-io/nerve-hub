import type { NerveCore } from "../core/engine.js";

export function registerResources(server: any, core: NerveCore) {
  // taskboard://{projectId}
  server.resource(
    "taskboard",
    "taskboard://{projectId}",
    {
      description: "Project task board grouped by status",
    },
    async (uri: any) => {
      const projectId = uri.pathname.replace(/^\//, "");
      const board = core.getProjectBoard(projectId);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(board, null, 2),
          },
        ],
      };
    }
  );

  // tasks://{agentId}
  server.resource(
    "agent-tasks",
    "tasks://{agentId}",
    {
      description: "Tasks assigned to a specific agent",
    },
    async (uri: any) => {
      const agentId = uri.pathname.replace(/^\//, "");
      const tasks = core.queryTasks({ assignee: agentId });
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    }
  );
}
