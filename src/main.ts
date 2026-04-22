#!/usr/bin/env node

/**
 * main.ts — Entry point. Two modes:
 *
 *   nerve-hub start [--port 3141]    Start REST API server
 *   nerve-hub mcp                    Start MCP stdio server (for Claude Desktop)
 *
 * Both modes use the same SQLite file: .nerve/hub.db
 */

import { Command } from "commander";
import { TaskDB } from "./db.js";
import { createServer } from "./api.js";
import { startMcp } from "./mcp.js";
import { resolve } from "path";

const DB_PATH = resolve(process.cwd(), ".nerve", "hub.db");

const program = new Command();
program.name("nerve-hub").version("0.1.0").description("AI Agent task bus");

program
  .command("start")
  .description("Start REST API server")
  .option("-p, --port <number>", "Port", "3141")
  .action(async (opts) => {
    const db = new TaskDB(DB_PATH);
    await createServer(db, parseInt(opts.port, 10));

    const shutdown = () => { db.close(); process.exit(0); };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program
  .command("mcp")
  .description("Start MCP stdio server (for Claude Desktop)")
  .action(async () => {
    // MCP stdio: stdout is reserved for JSON-RPC only.
    // Redirect all console output to stderr so nothing corrupts the protocol.
    console.log = (...args: any[]) => process.stderr.write(args.join(" ") + "\n");
    console.error = (...args: any[]) => process.stderr.write(args.join(" ") + "\n");
    console.warn = (...args: any[]) => process.stderr.write(args.join(" ") + "\n");
    console.info = (...args: any[]) => process.stderr.write(args.join(" ") + "\n");

    try {
      const db = new TaskDB(DB_PATH);
      await startMcp(db);

      const shutdown = () => { db.close(); process.exit(0); };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (err) {
      process.stderr.write(`nerve-hub mcp fatal: ${err}\n`);
      process.exit(1);
    }
  });

// Catch unhandled errors — write to stderr, never stdout
process.on("uncaughtException", (err) => {
  process.stderr.write(`nerve-hub uncaught: ${err.stack || err}\n`);
  process.exit(1);
});

program.parse();
