/**
 * test-agents.ts — Agent Registry tests (S4-01)
 *
 * Run: bun test src/test-agents.ts
 */

import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import { TaskDB } from "./db.js";
import { createServer } from "./api.js";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = "/tmp/nerve-hub-test-agents.db";
const PORT = 13142;
const BASE = `http://localhost:${PORT}`;

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

async function postAgent(id: string, extra?: Record<string, any>): Promise<any> {
  const res = await fetch(BASE + "/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name: "Agent " + id, type: "manual", ...extra }),
  });
  return { status: res.status, body: await res.json() };
}

describe("agent registry", () => {
  test("POST /agents creates agent (201)", async () => {
    const { status, body } = await postAgent("test-agent-1");
    expect(status).toBe(201);
    expect(body.id).toBe("test-agent-1");
    expect(body.name).toBe("Agent test-agent-1");
    expect(body.type).toBe("manual");
    expect(body.status).toBe("offline");
    expect(body.createdAt).toBeDefined();
  });

  test("POST /agents same id upserts (200)", async () => {
    await postAgent("test-agent-2");
    const { status, body } = await postAgent("test-agent-2", { name: "Updated Name" });
    expect(status).toBe(200);
    expect(body.name).toBe("Updated Name");
    expect(body.createdAt).toBeDefined();
  });

  test("GET /agents returns array", async () => {
    await postAgent("test-agent-3");
    const res = await fetch(BASE + "/agents");
    expect(res.status).toBe(200);
    const list = await res.json() as any[];
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  test("GET /agents/:id found", async () => {
    await postAgent("test-agent-4");
    const res = await fetch(BASE + "/agents/test-agent-4");
    expect(res.status).toBe(200);
    const agent = await res.json() as any;
    expect(agent.id).toBe("test-agent-4");
  });

  test("GET /agents/:id not found (404)", async () => {
    const res = await fetch(BASE + "/agents/nonexistent");
    expect(res.status).toBe(404);
  });

  test("PATCH /agents/:id/status updates status", async () => {
    await postAgent("test-agent-5");
    const res = await fetch(BASE + "/agents/test-agent-5/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "online" }),
    });
    expect(res.status).toBe(200);
    const agent = await res.json() as any;
    expect(agent.status).toBe("online");
  });

  test("PATCH /agents/:id/status invalid status (400)", async () => {
    await postAgent("test-agent-6");
    const res = await fetch(BASE + "/agents/test-agent-6/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid" }),
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /agents/:id succeeds (200)", async () => {
    await postAgent("test-agent-7");
    const res = await fetch(BASE + "/agents/test-agent-7", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.deleted).toBe(true);
  });

  test("DELETE /agents/:id not found (404)", async () => {
    const res = await fetch(BASE + "/agents/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  test("POST /agents webhook without endpoint (400)", async () => {
    const res = await fetch(BASE + "/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "bad-webhook", name: "Bad", type: "webhook" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("endpoint is required");
  });

  test("POST /agents webhook with invalid URL (400)", async () => {
    const res = await fetch(BASE + "/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "bad-url", name: "Bad URL", type: "webhook", endpoint: "not-a-url" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("valid URL");
  });

  test("POST /agents with id > 64 chars (400)", async () => {
    const res = await fetch(BASE + "/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "a".repeat(65), name: "Long ID", type: "manual" }),
    });
    expect(res.status).toBe(400);
  });

  test("WS receives agent.updated on POST /agents", async () => {
    const ws = new WebSocket("ws://localhost:" + PORT + "/ws");
    await new Promise<void>((resolve) => { ws.onopen = () => resolve(); });

    const msgPromise = new Promise<string>((resolve) => {
      ws.onmessage = (e) => resolve(typeof e.data === "string" ? e.data : "");
    });

    await postAgent("ws-agent-test");

    const msg = await msgPromise;
    const event = JSON.parse(msg);
    expect(event.type).toBe("agent.updated");
    expect(event.agentId).toBe("ws-agent-test");

    ws.close();
  });

  test("WS receives agent.deleted on DELETE /agents", async () => {
    await postAgent("ws-agent-delete");
    const ws = new WebSocket("ws://localhost:" + PORT + "/ws");
    await new Promise<void>((resolve) => { ws.onopen = () => resolve(); });
    await new Promise((r) => setTimeout(r, 50));

    const msgPromise = new Promise<string>((resolve) => {
      ws.onmessage = (e) => resolve(typeof e.data === "string" ? e.data : "");
    });

    await fetch(BASE + "/agents/ws-agent-delete", { method: "DELETE" });

    const msg = await msgPromise;
    const event = JSON.parse(msg);
    expect(event.type).toBe("agent.deleted");
    expect(event.agentId).toBe("ws-agent-delete");

    ws.close();
  });
});
