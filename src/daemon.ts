/**
 * daemon.ts — Background agent that listens for webhook tasks and spawns claude CLI.
 *
 * - POST /webhook: receive task payload, execute with claude CLI
 * - MAX_CONCURRENT=3
 * - Timeout: critical=10min, other=5min, then SIGTERM → 5s → SIGKILL
 * - Reports results directly to shared SQLite DB
 * - Auto-registers as webhook agent and sends heartbeats
 */

import { TaskDB } from "./db.js";
import { spawn, spawnSync } from "bun";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { wakeClaudeDesktop } from "./wake-claude.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.DAEMON_PORT || "3142");
const DB_PATH = process.env.NERVE_DB_PATH || resolve(__dirname, "..", ".nerve", "hub.db");
const HUB_URL = process.env.NERVE_PUBLIC_URL || "http://localhost:3141";
const AGENT_ID = "claude-code";
const AGENT_NAME = "Claude Code";
const MAX_CONCURRENT = 3;
const PROJECT_DIR = "/Users/neilji/AIGC/nerve-hub";

// ─── API Key ────────────────────────────────────────────────────────────────

function getApiKey(): string {
  // 1. macOS Keychain
  const result = spawnSync([
    "security", "find-generic-password",
    "-s", "nerve-hub-daemon",
    "-a", "deepseek-api-key",
    "-w",
  ]);
  if (result.exitCode === 0 && result.stdout.toString().trim()) {
    return result.stdout.toString().trim();
  }
  // 2. Environment variable fallback
  return process.env.DEEPSEEK_API_KEY || "";
}

// ─── DB ─────────────────────────────────────────────────────────────────────

const db = new TaskDB(DB_PATH, {
  onBatchComplete: (projectId, stats) => {
    const projectName = db.getProject(projectId)?.name ?? projectId;
    const msg = `项目「${projectName}」全部任务已完成！\n完成: ${stats.doneCount} | 失败: ${stats.failedCount}`;
    console.log(`[daemon] batch complete: ${msg}`);
    wakeClaudeDesktop(msg);
  },
});

// ─── Concurrency tracking ──────────────────────────────────────────────────

let activeCount = 0;

// ─── Agent registration ────────────────────────────────────────────────────

async function registerAgent() {
  try {
    const res = await fetch(`${HUB_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: AGENT_ID,
        name: AGENT_NAME,
        type: "webhook",
        endpoint: `http://127.0.0.1:${PORT}/webhook`,
        heartbeatInterval: 60,
      }),
    });
    if (res.ok) {
      console.log(`[daemon] registered as webhook agent (status: ${res.status})`);
    } else {
      console.error(`[daemon] register failed: HTTP ${res.status}`);
    }
  } catch (err: any) {
    console.error(`[daemon] register error: ${err.message} (hub may not be running yet)`);
  }
}

// ─── Heartbeat ─────────────────────────────────────────────────────────────

async function sendHeartbeat() {
  try {
    await fetch(`${HUB_URL}/api/webhooks/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        status: activeCount > 0 ? "busy" : "online",
      }),
    });
  } catch {
    // heartbeat failures are non-fatal
  }
}

// ─── Task execution ────────────────────────────────────────────────────────

interface WebhookPayload {
  task_id: string;
  project_id?: string;
  title?: string;
  description?: string;
  priority?: string;
  briefing: string;
  callback_url?: string;
  heartbeat_url?: string;
}

async function executeTask(task: WebhookPayload): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    db.update(task.task_id, {
      status: "failed",
      result: "No API key available (Keychain + DEEPSEEK_API_KEY both empty)",
    }, AGENT_ID);
    console.log(`[daemon] task ${task.task_id} failed: no API key`);
    return;
  }

  const timeoutMs = task.priority === "critical" ? 600_000 : 300_000;
  console.log(`[daemon] executing task ${task.task_id} (timeout=${timeoutMs / 1000}s)`);

  const proc = spawn([
    "claude", "-p", task.briefing,
    "--bare",
    "--dangerously-skip-permissions",
    "--output-format", "json",
    "--session-id", task.task_id,
    "--add-dir", PROJECT_DIR,
  ], {
    env: {
      ...Bun.env,
      ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_MODEL: "deepseek-v4-pro[1m]",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-pro",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-pro",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash",
      CLAUDE_CODE_SUBAGENT_MODEL: "deepseek-v4-pro",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK: "1",
      CLAUDE_CODE_EFFORT_LEVEL: "max",
      NERVE_HUB_AGENT_NAME: "claude-code",
    },
    cwd: PROJECT_DIR,
    stdout: "pipe",
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }, 5_000);
  }, timeoutMs);

  const exitCode = await proc.exited;
  clearTimeout(timer);

  if (timedOut) {
    db.update(task.task_id, {
      status: "failed",
      result: `Task timed out after ${timeoutMs / 1000}s (priority: ${task.priority || "medium"})`,
    }, AGENT_ID);
    console.log(`[daemon] task ${task.task_id} timed out`);
    return;
  }

  const stdout = await new Response(proc.stdout).text();

  // exit code is unreliable; parse JSON is_error field
  let isError = exitCode !== 0;
  try {
    const parsed = JSON.parse(stdout);
    if (parsed.is_error === true) isError = true;
    if (parsed.is_error === false) isError = false;
  } catch {
    // unparseable output → rely on exit code
  }

  db.update(task.task_id, {
    status: isError ? "failed" : "done",
    result: stdout.slice(0, 5000),
  }, AGENT_ID);

  console.log(`[daemon] task ${task.task_id} completed (${isError ? "failed" : "done"})`);
}

// ─── HTTP server ───────────────────────────────────────────────────────────

// Kill any existing process on the target port (prevents EADDRINUSE)
const portProc = Bun.spawnSync(["lsof", "-tiTCP:" + PORT, "-sTCP:LISTEN"]);
const existingPid = portProc.stdout.toString().trim();
if (existingPid) {
  console.log(`[daemon] Port ${PORT} in use (PID ${existingPid}), killing...`);
  Bun.spawnSync(["kill", existingPid]);
  Bun.sleepSync(500);
}

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/webhook" && req.method === "POST") {
      if (activeCount >= MAX_CONCURRENT) {
        return new Response("Too many concurrent tasks", { status: 503 });
      }

      let payload: WebhookPayload;
      try {
        payload = (await req.json()) as WebhookPayload;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (!payload.task_id || !payload.briefing) {
        return new Response("Missing task_id or briefing", { status: 400 });
      }

      activeCount++;
      executeTask(payload).finally(() => {
        activeCount--;
      });

      return Response.json({ ok: true, task_id: payload.task_id });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`[daemon] listening on http://127.0.0.1:${PORT}`);

// ─── Startup ────────────────────────────────────────────────────────────────

// Register agent; retry after 5s if hub not ready
registerAgent();
setTimeout(() => registerAgent(), 5_000);

// Heartbeat every 30s
setInterval(sendHeartbeat, 30_000);
sendHeartbeat();

// ─── Shutdown ───────────────────────────────────────────────────────────────

const cleanup = () => {
  console.log("[daemon] shutting down...");
  sendHeartbeat(); // final heartbeat as offline (won't matter, runner handles timeout)
  db.close();
  server.stop();
  process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
