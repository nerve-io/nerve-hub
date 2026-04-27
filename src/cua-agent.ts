/**
 * cua-agent.ts — Cua GUI Agent daemon.
 *
 * - POST /webhook: receive GUI_TASK payload, execute with cua-driver CLI
 * - Writes results back to hub via inbox file protocol
 * - Auto-registers as webhook agent and sends heartbeats
 * - Checks Accessibility permissions on startup
 *
 * Default timeout: 120s per GUI task (DAEMON_TIMEOUT_GUI env var to override)
 */

import { spawn, spawnSync } from "bun";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.CUA_PORT || "3143");
const DB_PATH = process.env.NERVE_DB_PATH || resolve(__dirname, "..", ".nerve", "hub.db");
const HUB_URL = process.env.NERVE_PUBLIC_URL || "http://localhost:3141";
const AGENT_ID = "cua-agent";
const AGENT_NAME = "Cua GUI Agent";
const DRIVER = (() => {
  const env = process.env.CUA_DRIVER_PATH;
  if (env) return env;
  return resolve(process.env.HOME || "/tmp", ".local", "bin", "cua-driver");
})();
const TIMEOUT_GUI = parseInt(process.env.DAEMON_TIMEOUT_GUI || "120") * 1000;
const INBOX_DIR = process.env.NERVE_INBOX_PATH
  ?? resolve(__dirname, "..", ".nerve", "inbox");

// ─── cua-driver CLI helper ──────────────────────────────────────────────────

async function cuaCall(
  tool: string,
  args: Record<string, unknown>,
  timeoutMs: number = 30_000,
  extraArgs: string[] = [],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const argsJson = JSON.stringify(args);
  const proc = spawn([DRIVER, "call", tool, argsJson, ...extraArgs], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const decoder = new TextDecoder();
  let stdout = "";
  let stderr = "";

  const readStream = async (
    stream: ReadableStream<Uint8Array>,
  ): Promise<string> => {
    const reader = stream.getReader();
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
    }
    return acc;
  };

  const timer = setTimeout(() => {
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }, 3_000);
  }, timeoutMs);

  [stdout, stderr] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
  ]);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

/** Parse JSON from cuaCall stdout, with fallback */
function parseCuaResult(result: { stdout: string; stderr: string; exitCode: number }): unknown {
  if (result.exitCode !== 0) {
    return { isError: true, error: result.stderr || result.stdout || `exit code ${result.exitCode}` };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { isError: true, error: `unparseable output: ${result.stdout.slice(0, 200)}` };
  }
}

// ─── Permission check ───────────────────────────────────────────────────────

async function checkAccessibility(): Promise<boolean> {
  try {
    // Use --no-daemon as required by the spec (direct process check)
    const result = await cuaCall(
      "check_permissions",
      { prompt: false },
      15_000,
      ["--no-daemon"],
    );

    // Try JSON format first: {"accessibility": true}
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed?.accessibility === true) return true;
    } catch {
      // Not JSON — fall through to text parsing
    }

    // Text format: "✅ Accessibility: granted."
    const combined = result.stdout + "\n" + result.stderr;
    return (
      /Accessibility:\s*granted/i.test(combined) ||
      /"accessibility"\s*:\s*true/i.test(combined)
    );
  } catch {
    return false;
  }
}

// ─── Ensure cua-driver daemon ──────────────────────────────────────────────

function isDaemonRunning(): boolean {
  const proc = spawnSync([DRIVER, "status"], { stdout: "pipe", stderr: "pipe" });
  return proc.stdout.toString().includes("running");
}

function startDaemon() {
  console.log("[cua-agent] starting cua-driver daemon...");
  // Detached background — daemon persists after cua-agent exits
  spawn([DRIVER, "serve"], {
    stdout: "ignore",
    stderr: "ignore",
    stdio: ["ignore", "ignore", "ignore"],
  });
}

// ─── PID auto-resolution ────────────────────────────────────────────────────

async function resolvePid(bundleId: string): Promise<number | null> {
  try {
    const result = await cuaCall("list_apps", {});
    const data = JSON.parse(result.stdout);
    const apps: Array<{ bundle_id?: string; pid?: number }> =
      Array.isArray(data) ? data : data?.apps ?? [];
    const app = apps.find(
      (a) => a.bundle_id === bundleId && a.pid && a.pid > 0,
    );
    return app?.pid ?? null;
  } catch {
    return null;
  }
}

// ─── GUI_TASK briefing parser ───────────────────────────────────────────────

interface GuiStep {
  tool: string;
  args: Record<string, unknown>;
}

interface GuiTask {
  app: string;
  bundleId: string | null;
  steps: GuiStep[];
}

/**
 * Convert JS object literal notation (with unquoted keys/values like `auto`)
 * to valid JSON.
 *
 * Handles:
 *   {pid: auto}             → {"pid": "auto"}
 *   {bundle_id: "com.x.y"}  → {"bundle_id": "com.x.y"}
 *   {x: 100, y: 200}        → {"x": 100, "y": 200}
 *   {text: "hello"}         → {"text": "hello"}
 */
function relaxJson(raw: string): string {
  // Step 1: quote unquoted values that aren't numbers, booleans, null, or already quoted
  // Matches `: auto`, `: some_value` etc. (but not `: 123`, `: true`, `: "..."`)
  let relaxed = raw.replace(
    /:\s*(auto)(\s*[,}])/g,
    ':"auto"$2',
  );

  // Step 2: quote unquoted object keys: `pid:` → `"pid":`
  relaxed = relaxed.replace(
    /([{,]\s*)([a-zA-Z_]\w*)\s*:/g,
    '$1"$2":',
  );

  return relaxed;
}

function parseGuiTask(briefing: string): GuiTask | null {
  const lines = briefing.split("\n");
  let inGuiTask = false;
  let app = "";
  const steps: GuiStep[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "GUI_TASK:") {
      inGuiTask = true;
      continue;
    }
    if (!inGuiTask) continue;

    // app: <value>
    if (trimmed.startsWith("app:") || trimmed.startsWith("app：")) {
      app = trimmed.slice(4).trim();
      if (!app) continue;
      continue;
    }

    // steps: (just a section header, actual steps follow)
    if (trimmed === "steps:" || trimmed === "steps：") continue;

    // Step line: "  - tool_name: {json}" or "- tool_name: {json}"
    // The "json" part may use relaxed JS object notation (unquoted keys, `auto` values)
    const stepMatch = trimmed.match(/^-\s+(\w+):\s*(\{.*\})\s*$/);
    if (stepMatch) {
      const tool = stepMatch[1];
      try {
        // Try strict JSON first, then relaxed
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(stepMatch[2]) as Record<string, unknown>;
        } catch {
          args = JSON.parse(relaxJson(stepMatch[2])) as Record<string, unknown>;
        }
        steps.push({ tool, args });
      } catch {
        console.error(
          `[cua-agent] failed to parse step args: ${stepMatch[2]}`,
        );
      }
      continue;
    }
  }

  if (!app || steps.length === 0) return null;

  // Determine if `app` is already a bundle_id (contains '.') or just a name
  const bundleId = app.includes(".") ? app : null;
  return { app, bundleId, steps };
}

// ─── Execute GUI task ───────────────────────────────────────────────────────

interface GuiStepResult {
  step: number;
  tool: string;
  ok: boolean;
  output: unknown;
  error?: string;
}

async function executeGuiTask(guiTask: GuiTask): Promise<GuiStepResult[]> {
  const results: GuiStepResult[] = [];
  let resolvedPid: number | null = null;
  let resolvedWindowId: number | null = null;

  for (let i = 0; i < guiTask.steps.length; i++) {
    const step = guiTask.steps[i];
    const stepNum = i + 1;

    // Resolve "auto" values in args
    const resolvedArgs: Record<string, unknown> = { ...step.args };
    if (resolvedArgs.pid === "auto") {
      resolvedArgs.pid = resolvedPid ?? 0;
    }
    if (resolvedArgs.window_id === "auto") {
      resolvedArgs.window_id = resolvedWindowId ?? 0;
    }

    console.log(
      `[cua-agent] step ${stepNum}/${guiTask.steps.length}: ${step.tool}(${JSON.stringify(resolvedArgs)})`,
    );

    try {
      const raw = await cuaCall(step.tool, resolvedArgs, TIMEOUT_GUI);
      const output = parseCuaResult(raw);

      // After launch_app, extract pid + window_id from result for subsequent "auto" steps
      if (step.tool === "launch_app") {
        const outObj = output as Record<string, unknown> | null;

        // Extract pid
        if (outObj?.pid && typeof outObj.pid === "number") {
          resolvedPid = outObj.pid;
        } else if (outObj?.result && typeof outObj.result === "object") {
          const inner = outObj.result as Record<string, unknown>;
          if (inner.pid && typeof inner.pid === "number") {
            resolvedPid = inner.pid;
          }
        }

        // Extract window_id from first window
        if (outObj?.windows && Array.isArray(outObj.windows) && outObj.windows.length > 0) {
          const firstWindow = outObj.windows[0] as Record<string, unknown>;
          if (firstWindow.window_id && typeof firstWindow.window_id === "number") {
            resolvedWindowId = firstWindow.window_id;
          }
        }
      }

      const isError =
        (output as Record<string, unknown>)?.isError === true;
      results.push({
        step: stepNum,
        tool: step.tool,
        ok: !isError && raw.exitCode === 0,
        output,
        error: isError
          ? String((output as Record<string, unknown>)?.error || "unknown error")
          : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        step: stepNum,
        tool: step.tool,
        ok: false,
        output: null,
        error: msg,
      });
      // On any exception, stop executing further steps
      break;
    }
  }

  return results;
}

// ─── Report results to hub ─────────────────────────────────────────────────

function reportResults(taskId: string, results: GuiStepResult[]): void {
  const allOk = results.every((r) => r.ok);
  const summaryLines = results.map((r) => {
    const status = r.ok ? "✓" : "✗";
    const detail = r.ok
      ? `output: ${JSON.stringify(r.output)}`
      : `error: ${r.error}`;
    return `${status} step ${r.step} (${r.tool}): ${detail}`;
  });

  const resultText =
    `${allOk ? "SUCCESS" : "FAILED"} — Cua GUI task completed.\n\n` +
    `Steps executed: ${results.filter((r) => r.error === undefined).length}/${results.length}\n\n` +
    summaryLines.join("\n");

  // Write to inbox file (protocol used by hub's inbox watcher)
  mkdirSync(INBOX_DIR, { recursive: true });
  const inboxFile = resolve(INBOX_DIR, `${taskId}.done.json`);
  writeFileSync(
    inboxFile,
    JSON.stringify({ taskId, result: resultText }, null, 2),
    "utf-8",
  );
  console.log(`[cua-agent] reported task ${taskId} → ${inboxFile}`);
}

// ─── Agent registration ─────────────────────────────────────────────────────

let agentOnline = false;

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
      console.log(`[cua-agent] registered as webhook agent (status: ${res.status})`);
    } else {
      const body = await res.text();
      console.error(`[cua-agent] register failed: HTTP ${res.status} — ${body}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cua-agent] register error: ${msg} (hub may not be running yet)`);
  }
}

// ─── Heartbeat ──────────────────────────────────────────────────────────────

let activeCount = 0;

async function sendHeartbeat() {
  try {
    await fetch(`${HUB_URL}/api/webhooks/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        status: activeCount > 0 ? "busy" : agentOnline ? "online" : "offline",
      }),
    });
  } catch {
    // heartbeat failures are non-fatal
  }
}

// ─── HTTP server ────────────────────────────────────────────────────────────

// Kill any existing process on the target port (prevents EADDRINUSE)
const portProc = Bun.spawnSync(["lsof", "-tiTCP:" + PORT, "-sTCP:LISTEN"]);
const existingPid = portProc.stdout.toString().trim();
if (existingPid) {
  console.log(`[cua-agent] Port ${PORT} in use (PID ${existingPid}), killing...`);
  Bun.spawnSync(["kill", existingPid]);
  Bun.sleepSync(500);
}

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

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/webhook" && req.method === "POST") {
      if (!agentOnline) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Cua Agent is offline — Accessibility permission not granted",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }

      if (activeCount >= 1) {
        return new Response(
          JSON.stringify({ ok: false, error: "Cua Agent is busy" }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }

      let payload: WebhookPayload;
      try {
        payload = (await req.json()) as WebhookPayload;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (!payload.task_id || !payload.briefing) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing task_id or briefing" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const guiTask = parseGuiTask(payload.briefing);
      if (!guiTask) {
        // No GUI_TASK in briefing — report as failed via inbox
        mkdirSync(INBOX_DIR, { recursive: true });
        writeFileSync(
          resolve(INBOX_DIR, `${payload.task_id}.done.json`),
          JSON.stringify(
            {
              taskId: payload.task_id,
              result:
                "FAILED — No GUI_TASK section found in task briefing. " +
                "Cua Agent only handles tasks with a GUI_TASK: block in the description.",
            },
            null,
            2,
          ),
          "utf-8",
        );
        console.log(`[cua-agent] no GUI_TASK in briefing for task ${payload.task_id}`);
        return Response.json(
          { ok: false, error: "No GUI_TASK section in briefing" },
          { status: 400 },
        );
      }

      activeCount++;
      console.log(
        `[cua-agent] executing task ${payload.task_id} (app=${guiTask.app}, ${guiTask.steps.length} steps)`,
      );

      executeGuiTask(guiTask)
        .then((results) => {
          reportResults(payload.task_id, results);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          reportResults(payload.task_id, [
            {
              step: 0,
              tool: "internal",
              ok: false,
              output: null,
              error: `Agent error: ${msg}`,
            },
          ]);
        })
        .finally(() => {
          activeCount--;
          sendHeartbeat();
        });

      return Response.json({ ok: true, task_id: payload.task_id });
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json({
        ok: true,
        agent: AGENT_ID,
        online: agentOnline,
        active: activeCount,
        driver: DRIVER,
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`[cua-agent] listening on http://127.0.0.1:${PORT}`);

// ─── Startup ─────────────────────────────────────────────────────────────────

async function startup() {
  // 1. Check Accessibility permissions
  console.log("[cua-agent] checking Accessibility permissions...");
  const hasAccessibility = await checkAccessibility();

  if (!hasAccessibility) {
    console.error(
      "[cua-agent] ⚠️  Accessibility permission NOT granted. " +
        "Agent will register as offline and reject tasks. " +
        "Run 'bash scripts/setup-cua.sh' to grant permissions.",
    );
    agentOnline = false;
  } else {
    console.log("[cua-agent] ✅ Accessibility permission granted.");

    // 2. Ensure cua-driver daemon is running
    if (!isDaemonRunning()) {
      startDaemon();
      // Give it a moment to start
      await Bun.sleep(1_000);
      if (isDaemonRunning()) {
        console.log("[cua-agent] cua-driver daemon started.");
      } else {
        console.warn("[cua-agent] cua-driver daemon may not have started — will retry on first task.");
      }
    } else {
      console.log("[cua-agent] cua-driver daemon already running.");
    }

    agentOnline = true;
  }

  // 3. Register agent with hub
  registerAgent();
  setTimeout(() => registerAgent(), 5_000);

  // 4. Heartbeat every 30s
  setInterval(sendHeartbeat, 30_000);
  sendHeartbeat();
}

// ─── Shutdown ────────────────────────────────────────────────────────────────

const cleanup = () => {
  console.log("[cua-agent] shutting down...");
  server.stop();
  process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// ─── Boot ────────────────────────────────────────────────────────────────────

startup();
