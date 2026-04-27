/**
 * daemon.ts — Background agent that listens for webhook tasks and spawns claude CLI.
 *
 * - POST /webhook: receive task payload, execute with claude CLI
 * - MAX_CONCURRENT=3
 * - Timeout: research=30min, code/test/deploy=15min, critical=10min, other=5min (all env-configurable)
 *   DAEMON_TIMEOUT_RESEARCH / DAEMON_TIMEOUT_CODE / DAEMON_TIMEOUT_CRITICAL / DAEMON_TIMEOUT_DEFAULT (seconds)
 *   SIGTERM → DAEMON_TIMEOUT_KILL_WAIT (default 5s) → SIGKILL
 * - Streams output to .nerve/logs/<taskId>.log (NERVE_LOG_DIR to override)
 * - Reports results directly to shared SQLite DB
 * - Auto-registers as webhook agent and sends heartbeats
 */

import { TaskDB } from "./db.js";
import { spawn, spawnSync } from "bun";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { wakeClaudeDesktop } from "./wake-claude.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.DAEMON_PORT || "3142");
const DB_PATH = process.env.NERVE_DB_PATH || resolve(__dirname, "..", ".nerve", "hub.db");
const HUB_URL = process.env.NERVE_PUBLIC_URL || "http://localhost:3141";
const AGENT_ID = "claude-code";
const AGENT_NAME = "Claude Code";
const MAX_CONCURRENT = parseInt(process.env.DAEMON_MAX_CONCURRENT || "3");
const PROJECT_DIR = process.env.NERVE_PROJECT_DIR || "/Users/neilji/AIGC/nerve-hub";

// ─── Timeout config (all values in seconds, via env vars) ───────────────────
// DAEMON_TIMEOUT_RESEARCH  default 1800s (30min) — web search tasks are slow
// DAEMON_TIMEOUT_CODE      default 1800s (30min) — code/test/deploy tasks
// DAEMON_TIMEOUT_CRITICAL  default  600s (10min) — any type with critical priority
// DAEMON_TIMEOUT_DEFAULT   default  300s ( 5min) — custom/review/other
// DAEMON_TIMEOUT_KILL_WAIT default    5s — grace period between SIGTERM and SIGKILL
const TIMEOUT_RESEARCH  = parseInt(process.env.DAEMON_TIMEOUT_RESEARCH  || "1800") * 1000;
const TIMEOUT_CODE      = parseInt(process.env.DAEMON_TIMEOUT_CODE      || "1800") * 1000;
const TIMEOUT_CRITICAL  = parseInt(process.env.DAEMON_TIMEOUT_CRITICAL  || "600")  * 1000;
const TIMEOUT_DEFAULT   = parseInt(process.env.DAEMON_TIMEOUT_DEFAULT   || "300")  * 1000;
const TIMEOUT_KILL_WAIT = parseInt(process.env.DAEMON_TIMEOUT_KILL_WAIT || "5")    * 1000;

// ─── Log directory (stream-json output per task) ─────────────────────────────
// NERVE_LOG_DIR defaults to .nerve/logs/ next to hub.db
const LOG_DIR = process.env.NERVE_LOG_DIR || resolve(dirname(DB_PATH), "logs");

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
  type?: string;
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

  const timeoutMs =
    task.type === "research"                          ? TIMEOUT_RESEARCH :
    task.priority === "critical"                      ? TIMEOUT_CRITICAL :
    (task.type === "code" || task.type === "test" ||
     task.type === "deploy")                          ? TIMEOUT_CODE     :
                                                        TIMEOUT_DEFAULT;
  // ── Log file: stream-json output written line-by-line during execution ──────
  mkdirSync(LOG_DIR, { recursive: true });
  const logPath = resolve(LOG_DIR, `${task.task_id}.log`);
  console.log(`[daemon] executing task ${task.task_id} (type=${task.type || "custom"}, priority=${task.priority || "medium"}, timeout=${timeoutMs / 1000}s, log=${logPath})`);

  const proc = spawn([
    "claude", "-p", task.briefing,
    "--verbose",
    "--bare",
    "--dangerously-skip-permissions",
    "--output-format", "stream-json",
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
    stderr: "pipe",
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }, TIMEOUT_KILL_WAIT);
  }, timeoutMs);

  // ── Stream stdout → log file + parse result event ────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resultEvent: { type: string; is_error?: boolean; result?: string; [key: string]: any } | null = null;
  const logWriter = Bun.file(logPath).writer();

  // Stream stderr into the same log file (captures errors that would otherwise be lost)
  (async () => {
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        logWriter.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      logWriter.flush();
    }
  })();

  const streamDone = (async () => {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buf += chunk;
        logWriter.write(chunk);
        // Parse complete newline-delimited JSON events, extract result
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "result") resultEvent = ev;
          } catch { /* non-JSON line */ }
        }
      }
      if (buf.trim()) {
        logWriter.write(buf);
        try {
          const ev = JSON.parse(buf);
          if (ev.type === "result") resultEvent = ev;
        } catch {}
      }
    } finally {
      await logWriter.flush();
      logWriter.end();
    }
  })();

  const exitCode = await proc.exited;
  clearTimeout(timer);
  await streamDone; // ensure log is fully flushed before we update DB

  if (timedOut) {
    db.update(task.task_id, {
      status: "failed",
      result: `Task timed out after ${timeoutMs / 1000}s (priority: ${task.priority || "medium"}). Full log: ${logPath}`,
    }, AGENT_ID);
    console.log(`[daemon] task ${task.task_id} timed out — partial log at ${logPath}`);
    return;
  }

  // Determine success/failure: result event is authoritative, exit code is fallback
  let isError = exitCode !== 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const re = resultEvent as any;
  if (re !== null) {
    if (re.is_error === true)  isError = true;
    if (re.is_error === false) isError = false;
  }

  // Store result event JSON (same shape as --output-format json, fully compatible)
  const resultCap = task.type === "research" ? 20_000 : 5_000;
  const rawOutput = resultEvent ? JSON.stringify(resultEvent) : `{"exit_code":${exitCode}}`;
  db.update(task.task_id, {
    status: isError ? "failed" : "done",
    result: rawOutput.slice(0, resultCap),
  }, AGENT_ID);

  console.log(`[daemon] task ${task.task_id} completed (${isError ? "failed" : "done"}) — log: ${logPath}`);
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

// Recover orphan tasks from previous daemon instance
function recoverOrphanTasks() {
  try {
    const orphans = db.list({ assignee: AGENT_ID, status: "running" });
    for (const task of orphans) {
      db.update(task.id, { status: "pending" });
      console.log(`[daemon] recovered orphan task ${task.id} → pending`);
    }
  } catch (err: any) {
    console.error(`[daemon] orphan recovery error: ${err.message}`);
  }
}
recoverOrphanTasks();

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
