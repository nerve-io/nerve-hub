/**
 * test.ts — End-to-end smoke test using Bun's built-in test runner.
 *
 * Run: bun test src/test.ts
 */

import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import { TaskDB } from "./db.js";
import { createServer } from "./api.js";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = "/tmp/nerve-hub-test.db";
const PORT = 13141;
const BASE = `http://localhost:${PORT}`;

let db: TaskDB;
let server: any;

beforeAll(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  db = new TaskDB(TEST_DB);
  server = createServer(db, PORT);
});

afterAll(() => {
  server.stop();
  db.close();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

describe("nerve-hub MVP smoke test", () => {
  let taskId: string;

  test("POST /tasks → 201", async () => {
    const res = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Implement login", description: "OAuth2 flow" }),
    });
    expect(res.status).toBe(201);
    const task = await res.json() as any;
    expect(typeof task.id).toBe("string");
    expect(task.status).toBe("pending");
    taskId = task.id;
  });

  test("GET /tasks → array", async () => {
    const res = await fetch(`${BASE}/tasks`);
    const list = await res.json() as any[];
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);
  });

  test("GET /tasks/:id → found", async () => {
    const res = await fetch(`${BASE}/tasks/${taskId}`);
    const task = await res.json() as any;
    expect(task.id).toBe(taskId);
    expect(task.title).toBe("Implement login");
  });

  test("PATCH /tasks/:id → status=done", async () => {
    const res = await fetch(`${BASE}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", result: "PR #42 merged" }),
    });
    const task = await res.json() as any;
    expect(task.status).toBe("done");
    expect(task.result).toBe("PR #42 merged");
  });

  test("GET /tasks?status=pending → empty", async () => {
    const res = await fetch(`${BASE}/tasks?status=pending`);
    const list = await res.json() as any[];
    expect(list.length).toBe(0);
  });

  test("GET /tasks?status=done → 1", async () => {
    const res = await fetch(`${BASE}/tasks?status=done`);
    const list = await res.json() as any[];
    expect(list.length).toBe(1);
  });

  test("DELETE /tasks/:id → 200", async () => {
    const res = await fetch(`${BASE}/tasks/${taskId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  test("GET deleted task → 404", async () => {
    const res = await fetch(`${BASE}/tasks/${taskId}`);
    expect(res.status).toBe(404);
  });

  test("GET unknown task → 404", async () => {
    const res = await fetch(`${BASE}/tasks/nonexistent`);
    expect(res.status).toBe(404);
  });

  test("GET /health → ok", async () => {
    const res = await fetch(`${BASE}/health`);
    const body = await res.json() as any;
    expect(body.status).toBe("ok");
  });
});
