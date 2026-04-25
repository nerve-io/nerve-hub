/**
 * test-webhooks.ts — Webhook callback/heartbeat tests (S4-03)
 *
 * Run: bun test src/test-webhooks.ts
 */

import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import { TaskDB } from "./db.js";
import { createServer } from "./api.js";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = "/tmp/nerve-hub-test-webhooks.db";
const PORT = 13143;
const BASE = "http://localhost:" + PORT;

let db: TaskDB;
let server: any;

beforeAll(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  db = new TaskDB(TEST_DB);
  ({ server } = createServer(db, PORT));
});

afterAll(() => {
  server.stop();
  db.close();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

// Helper: create a project + task + agent
async function setupTaskWithAgent(): Promise<{ taskId: string; agentId: string }> {
  const projRes = await fetch(BASE + "/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Project" }),
  });
  const project = await projRes.json() as Record<string, any>;

  const agentRes = await fetch(BASE + "/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "webhook-1", name: "Webhook Agent", type: "webhook", endpoint: "http://localhost:9999/hook" }),
  });
  const agent = await agentRes.json() as Record<string, any>;

  const taskRes = await fetch(BASE + "/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Test task", assignee: "webhook-1", projectId: project.id }),
  });
  const task = await taskRes.json() as Record<string, any>;

  return { taskId: task.id, agentId: "webhook-1" };
}

describe("webhook callback", () => {
  test("POST /webhooks/callback with done status", async () => {
    const { taskId } = await setupTaskWithAgent();

    const res = await fetch(BASE + "/webhooks/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, status: "done", result: "Task completed successfully" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.ok).toBe(true);

    // Verify task was updated
    const taskRes = await fetch(BASE + "/tasks/" + taskId);
    const task = await taskRes.json() as Record<string, any>;
    expect(task.status).toBe("done");
    expect(task.result).toBe("Task completed successfully");
  });

  test("POST /webhooks/callback with failed status", async () => {
    const { taskId } = await setupTaskWithAgent();

    const res = await fetch(BASE + "/webhooks/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, status: "failed", result: "Agent crashed" }),
    });
    expect(res.status).toBe(200);

    const taskRes = await fetch(BASE + "/tasks/" + taskId);
    const task = await taskRes.json() as Record<string, any>;
    expect(task.status).toBe("failed");
    expect(task.result).toBe("Agent crashed");
  });

  test("POST /webhooks/callback with nonexistent task → 404", async () => {
    const res = await fetch(BASE + "/webhooks/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: "nonexistent", status: "done", result: "ok" }),
    });
    expect(res.status).toBe(404);
  });

  test("POST /webhooks/callback missing fields → 400", async () => {
    const res = await fetch(BASE + "/webhooks/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: "test" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /webhooks/callback invalid status → 400", async () => {
    const res = await fetch(BASE + "/webhooks/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: "test", status: "invalid", result: "ok" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("webhook heartbeat", () => {
  test("POST /webhooks/heartbeat updates agent status", async () => {
    const { agentId } = await setupTaskWithAgent();

    const res = await fetch(BASE + "/webhooks/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, status: "busy" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.ok).toBe(true);

    // Verify agent was updated
    const agentRes = await fetch(BASE + "/agents/" + agentId);
    const agent = await agentRes.json() as Record<string, any>;
    expect(agent.status).toBe("busy");
    expect(agent.lastSeen).toBeDefined();
  });

  test("POST /webhooks/heartbeat with nonexistent agent → 404", async () => {
    const res = await fetch(BASE + "/webhooks/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "nonexistent", status: "online" }),
    });
    expect(res.status).toBe(404);
  });

  test("POST /webhooks/heartbeat invalid status → 400", async () => {
    const res = await fetch(BASE + "/webhooks/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "test", status: "offline" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /webhooks/heartbeat missing fields → 400", async () => {
    const res = await fetch(BASE + "/webhooks/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "test" }),
    });
    expect(res.status).toBe(400);
  });
});
