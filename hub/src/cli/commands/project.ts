import path from "path";
import { NerveCore } from "../../core/engine.js";

function getCore(): NerveCore {
  const dbPath = path.join(process.cwd(), ".nerve", "hub.db");
  return new NerveCore(dbPath);
}

function print(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

export async function projectListCommand() {
  const core = getCore();
  const projects = core.listProjects();
  print(projects);
  core.close();
}

export async function projectCreateCommand(options: {
  name: string;
  description?: string;
}) {
  const core = getCore();
  const project = core.createProject({
    name: options.name,
    description: options.description || "",
  });
  print(project);
  core.close();
}

export async function projectInfoCommand(id: string) {
  const core = getCore();
  const project = core.getProject(id);
  if (!project) {
    console.error(`项目 ${id} 不存在`);
    process.exit(1);
  }
  print(project);
  core.close();
}

export async function projectBoardCommand(id: string) {
  const core = getCore();
  const project = core.getProject(id);
  if (!project) {
    console.error(`项目 ${id} 不存在`);
    process.exit(1);
  }
  const board = core.getProjectBoard(id);
  print({ project, board });
  core.close();
}

export async function projectContextCommand(id: string) {
  const core = getCore();
  const ctx = core.getProjectContext(id);
  if (!ctx.project) {
    console.error(`项目 ${id} 不存在`);
    process.exit(1);
  }
  print(ctx);
  core.close();
}
