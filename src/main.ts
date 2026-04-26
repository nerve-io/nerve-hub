#!/usr/bin/env bun
/**
 * main.ts — Entry point. Two modes:
 *
 *   bun run src/main.ts start [--port 3141]    Start REST API server
 *   bun run src/main.ts mcp                    Start MCP stdio server
 *
 * Both modes use the same SQLite file: .nerve/hub.db
 */

import { TaskDB } from "./db.js";
import { createServer } from "./api.js";
import { startMcp } from "./mcp.js";
import { startRunner } from "./runner.js";
import { startInboxWatcher } from "./inbox.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Use the directory of this source file, NOT process.cwd().
// Claude Desktop spawns MCP processes with cwd=/, which is read-only on macOS.
const __dirname = dirname(fileURLToPath(import.meta.url));

// NERVE_DB_PATH lets a compiled binary and a dev server share one database.
// Default: <project-root>/.nerve/hub.db (relative to source file location).
const DB_PATH = process.env.NERVE_DB_PATH
  ?? resolve(__dirname, "..", ".nerve", "hub.db");

// ─── Minimal argv parser (no dependencies) ──────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];

function getArg(name: string, defaultValue?: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  const shortIdx = args.indexOf(`-${name[0]}`);
  if (shortIdx !== -1 && shortIdx + 1 < args.length) return args[shortIdx + 1];
  return defaultValue;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

if (cmd === "start") {
  const port = parseInt(getArg("port", "3141")!, 10);

  // Kill any existing process on the target port (prevents EADDRINUSE)
  const proc = Bun.spawnSync(["lsof", "-tiTCP:" + port, "-sTCP:LISTEN"]);
  const pid = proc.stdout.toString().trim();
  if (pid) {
    console.log(`Port ${port} in use (PID ${pid}), killing...`);
    Bun.spawnSync(["kill", pid]);
    Bun.sleepSync(500);
  }

  const db = new TaskDB(DB_PATH);
  const { server, broadcast } = createServer(db, port);
  startRunner(db, broadcast);
  startInboxWatcher(db, DB_PATH);

  const shutdown = () => { db.close(); server.stop(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

} else if (cmd === "mcp") {
  // MCP stdio: stdout is reserved for JSON-RPC only.
  // Redirect all console output to stderr so nothing corrupts the protocol.
  console.log = (...a: any[]) => process.stderr.write(a.join(" ") + "\n");
  console.error = (...a: any[]) => process.stderr.write(a.join(" ") + "\n");
  console.warn = (...a: any[]) => process.stderr.write(a.join(" ") + "\n");
  console.info = (...a: any[]) => process.stderr.write(a.join(" ") + "\n");

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

} else {
  console.log(`nerve-hub v0.2.0 — AI Agent task bus`);
  console.log(``);
  console.log(`Usage:`);
  console.log(`  bun run src/main.ts start [--port 3141]   Start REST API server`);
  console.log(`  bun run src/main.ts mcp                   Start MCP stdio server`);
  console.log(`  bun run src/main.ts test                  Run smoke tests`);
  process.exit(cmd ? 1 : 0);
}

// Catch unhandled errors — write to stderr, never stdout
process.on("uncaughtException", (err) => {
  process.stderr.write(`nerve-hub uncaught: ${err.stack || err}\n`);
  process.exit(1);
});
