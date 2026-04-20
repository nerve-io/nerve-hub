import { Command } from "commander";
import { NerveCore } from "../core/engine.js";
import { createApiServer } from "../api/index.js";
import { startMCPStdio, startMCPHttp } from "../mcp/index.js";

const program = new Command();

program
  .name("nerve-hub")
  .description("AI Agent State Bus - The nervous system for AI agents")
  .version("0.1.0");

// ── start ───────────────────────────────────────────────────────────

program
  .command("start")
  .description("Start the Nerve Hub REST API server")
  .argument("[port]", "Port to listen on", "3141")
  .option("--db <path>", "Path to the database file")
  .option("--host <host>", "Host to bind to", "0.0.0.0")
  .action(async (port: string, opts: { db?: string; host: string }) => {
    const dbPath = opts.db ?? `${process.cwd()}/.nerve/hub.db`;
    const core = new NerveCore(dbPath);
    const server = await createApiServer(core, {
      port: parseInt(port, 10),
      host: opts.host,
    });
    const address = await server.listen();
    console.error(`Nerve Hub API server listening on ${address}`);
    console.error(`Database: ${dbPath}`);

    const shutdown = async () => {
      console.error("\nShutting down...");
      await server.close();
      core.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

// ── mcp ─────────────────────────────────────────────────────────────

program
  .command("mcp")
  .description("Start the Nerve Hub MCP server")
  .option("--http [port]", "Start in HTTP mode instead of stdio")
  .option("--db <path>", "Path to the database file")
  .action(async (opts: { http?: string | boolean; db?: string }) => {
    const dbPath = opts.db ?? `${process.cwd()}/.nerve/hub.db`;
    const core = new NerveCore(dbPath);

    if (opts.http) {
      const port = typeof opts.http === "string" ? parseInt(opts.http, 10) : 3142;
      await startMCPHttp(core, port);
    } else {
      await startMCPStdio(core);
    }

    const shutdown = async () => {
      core.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

// ── init ────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Initialize a new project")
  .argument("[name]", "Project name", "default")
  .option("--db <path>", "Path to the database file")
  .action(async (name: string, opts: { db?: string }) => {
    const dbPath = opts.db ?? `${process.cwd()}/.nerve/hub.db`;
    const core = new NerveCore(dbPath);
    const project = core.projects.create(name);
    console.error(`Created project: ${project.name} (${project.id})`);
    console.error(`Database: ${dbPath}`);
    core.close();
  });

program.parse();
