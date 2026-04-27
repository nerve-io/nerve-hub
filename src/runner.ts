/**
 * runner.ts — Background task dispatcher for webhook-type Agents
 *
 * - Every 15s: scan for pending tasks assigned to online webhook agents → dispatch
 * - Every 30s: check heartbeat timeouts → mark agents offline
 */

import type { TaskDB } from "./db.js";

const PUBLIC_URL = process.env.NERVE_PUBLIC_URL || "http://localhost:3000";

export type BroadcastFn = (event: { type: string; projectId?: string; taskId?: string; agentId?: string; status?: string }) => void;

export function startRunner(db: TaskDB, broadcast: BroadcastFn) {
  // Dispatch pending webhook tasks every 15s
  const dispatchTimer = setInterval(() => dispatchPendingWebhookTasks(db, broadcast), 15_000);
  // Check heartbeat timeouts every 30s
  const heartbeatTimer = setInterval(() => checkHeartbeatTimeouts(db, broadcast), 30_000);

  // Run once immediately on startup
  setTimeout(() => dispatchPendingWebhookTasks(db, broadcast), 1_000);

  console.log("[runner] started (dispatch=15s, heartbeat=30s)");

  return () => {
    clearInterval(dispatchTimer);
    clearInterval(heartbeatTimer);
  };
}

async function dispatchPendingWebhookTasks(db: TaskDB, broadcast: BroadcastFn) {
  try {
    // Get all agents that are webhook type and online
    const agents = db.listAgents().filter(
      (a) => a.type === "webhook" && a.status === "online"
    );

    if (agents.length === 0) return;

    // Get all pending tasks
    const allPending = db.list({ status: "pending" });
    const pendingForWebhook = allPending.filter(
      (t) => t.assignee && agents.some((a) => a.id === t.assignee)
    );

    if (pendingForWebhook.length === 0) return;

    for (const task of pendingForWebhook) {
      const agent = agents.find((a) => a.id === task.assignee);
      if (!agent || !agent.endpoint) continue;

      const briefing = db.generateBriefing(task.id);
      const payload = {
        task_id: task.id,
        project_id: task.projectId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        type: task.type,
        briefing: briefing || "",
        callback_url: PUBLIC_URL + "/webhooks/callback",
        heartbeat_url: PUBLIC_URL + "/webhooks/heartbeat",
      };

      try {
        const res = await fetch(agent.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          // Mark as running immediately (idempotency)
          db.update(task.id, { status: "running" });
          db.updateAgentStatus(agent.id, "busy");
          db.logTaskDispatched(task.id, agent.id, agent.endpoint, task.projectId);
          broadcast({ type: "task.updated", projectId: task.projectId, taskId: task.id });
          broadcast({ type: "agent.status_changed", agentId: agent.id, status: "busy" });
          console.log(`[runner] dispatched task ${task.id} to agent ${agent.id}`);
        } else {
          console.error(`[runner] dispatch failed for task ${task.id}: HTTP ${res.status}`);
        }
      } catch (err: any) {
        console.error(`[runner] dispatch error for task ${task.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[runner] dispatch loop error:", err.message);
  }
}

function checkHeartbeatTimeouts(db: TaskDB, broadcast: BroadcastFn) {
  try {
    const agents = db.listAgents().filter(
      (a) => a.type === "webhook" && (a.status === "online" || a.status === "busy")
    );

    const now = Date.now();

    for (const agent of agents) {
      const interval = (agent.heartbeatInterval || 60) * 3; // 3x tolerance
      const lastSeen = agent.lastSeen ? new Date(agent.lastSeen).getTime() : 0;

      if (lastSeen === 0 || (now - lastSeen) > interval * 1000) {
        db.updateAgentStatus(agent.id, "offline");
        broadcast({ type: "agent.status_changed", agentId: agent.id, status: "offline" });
        console.log(`[runner] agent ${agent.id} marked offline (heartbeat timeout)`);

        // Revert orphan running tasks back to pending
        const runningTasks = db.list({ assignee: agent.id, status: "running" });
        for (const task of runningTasks) {
          db.update(task.id, { status: "pending" }, "system");
          broadcast({ type: "task.updated", projectId: task.projectId, taskId: task.id });
          console.log(`[runner] reverted task ${task.id} to pending (agent ${agent.id} went offline)`);
        }
      }
    }
  } catch (err: any) {
    console.error("[runner] heartbeat check error:", err.message);
  }
}
