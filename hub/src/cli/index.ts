#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { mcpCommand } from "./commands/mcp.js";

const program = new Command();

program
  .name("nerve-hub")
  .description("AI Agent state bus — the nervous system for multi-agent collaboration")
  .version("0.1.0");

program
  .command("init [name]")
  .description("Initialize a new Nerve Hub project")
  .action((name?: string) => {
    initCommand(name);
  });

program
  .command("start")
  .description("Start the HTTP + MCP server")
  .option("-p, --port <number>", "Port to listen on", "3141")
  .option("-h, --host <string>", "Host to bind to", "0.0.0.0")
  .action(async (options: { port?: string; host?: string }) => {
    await startCommand({
      port: options.port ? parseInt(options.port, 10) : undefined,
      host: options.host,
    });
  });

program
  .command("mcp")
  .description("Start MCP server in stdio mode (for Claude Desktop)")
  .action(async () => {
    await mcpCommand();
  });

program.parse();
