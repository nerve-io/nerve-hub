/**
 * inbox.ts — File-based task completion inbox.
 *
 * Problem solved:
 *   Remote agents (TRAE SOLO, CI bots, cloud LLMs) can't reach localhost:3141.
 *   The shared filesystem is the only reliable transport between them and the server.
 *
 * Protocol:
 *   Agent writes  <inbox-dir>/<taskId>.done.json  with content:
 *     { "taskId": "<id>", "result": "<what was accomplished>" }
 *
 *   Server polls every POLL_INTERVAL_MS, reads each .done.json, calls db.update(),
 *   then moves the file to <inbox-dir>/processed/ (success) or <inbox-dir>/failed/ (error).
 *
 * Inbox directory:
 *   Default: <project-root>/.nerve/inbox/  (set by caller)
 *   Override: NERVE_INBOX_PATH env var (set by caller)
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from "fs";
import { join } from "path";
import type { TaskDB } from "./db.js";

const POLL_INTERVAL_MS = 5_000;
// Only process files that haven't been modified in the last second
// (guards against reading a half-written file).
const MIN_AGE_MS = 1_000;

export interface InboxResult {
  taskId: string;
  result: string;
}

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function safeRename(src: string, destDir: string, filename: string) {
  ensureDir(destDir);
  const dest = join(destDir, filename);
  try {
    renameSync(src, dest);
  } catch {
    // Destination might already exist (retry scenario) — ignore.
  }
}

export function startInboxWatcher(db: TaskDB, inboxDir: string): void {

  ensureDir(inboxDir);
  const processedDir = join(inboxDir, "processed");
  const failedDir = join(inboxDir, "failed");

  console.log(`▶ Inbox    ${inboxDir}  (poll every ${POLL_INTERVAL_MS / 1000}s)`);

  async function poll() {
    let entries: string[];
    try {
      entries = readdirSync(inboxDir).filter(f => f.endsWith(".done.json"));
    } catch {
      return; // directory disappeared — skip
    }

    for (const filename of entries) {
      const filePath = join(inboxDir, filename);

      // Age check — don't read a file that was just written.
      try {
        const stat = statSync(filePath);
        if (Date.now() - stat.mtimeMs < MIN_AGE_MS) continue;
      } catch {
        continue;
      }

      let payload: InboxResult;
      try {
        const raw = readFileSync(filePath, "utf-8");
        payload = JSON.parse(raw) as InboxResult;
        if (!payload.taskId || typeof payload.taskId !== "string") {
          throw new Error("missing or invalid taskId field");
        }
        if (typeof payload.result !== "string") {
          throw new Error("missing or invalid result field");
        }
      } catch (err) {
        process.stderr.write(`[inbox] bad file ${filename}: ${err}\n`);
        safeRename(filePath, failedDir, filename);
        continue;
      }

      const { taskId, result } = payload;

      const existing = db.get(taskId);
      if (!existing) {
        process.stderr.write(`[inbox] task not found: ${taskId} (file: ${filename})\n`);
        safeRename(filePath, failedDir, filename);
        continue;
      }
      if (existing.status === "done") {
        // Already completed — idempotent: just clean up the file.
        process.stderr.write(`[inbox] task already done: ${taskId} — removing file\n`);
        safeRename(filePath, processedDir, filename);
        continue;
      }

      try {
        db.update(taskId, { status: "done", result }, "inbox");
        process.stderr.write(`[inbox] ✓ completed task ${taskId}\n`);
        safeRename(filePath, processedDir, filename);
      } catch (err) {
        process.stderr.write(`[inbox] db error for task ${taskId}: ${err}\n`);
        safeRename(filePath, failedDir, filename);
      }
    }
  }

  // Run immediately, then on interval.
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
}
