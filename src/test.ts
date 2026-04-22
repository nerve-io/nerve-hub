/**
 * test.ts — End-to-end smoke test.
 *
 * Starts the API server, exercises all 5 endpoints, then exits.
 * Run: tsx src/test.ts
 */

import { TaskDB } from "./db.js";
import { createServer } from "./api.js";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = "/tmp/nerve-hub-test.db";
const PORT = 13141;
const BASE = `http://localhost:${PORT}`;

async function run() {
  // Clean up
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

  const db = new TaskDB(TEST_DB);
  const app = await createServer(db, PORT);

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}${detail ? ": " + detail : ""}`);
      failed++;
    }
  }

  try {
    console.log("\n─── nerve-hub MVP smoke test ───\n");

    // 1. Create task
    const res1 = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Implement login", description: "OAuth2 flow" }),
    });
    const task1 = await res1.json() as any;
    assert("POST /tasks → 201", res1.status === 201);
    assert("task has id", typeof task1.id === "string");
    assert("task status = pending", task1.status === "pending");

    // 2. List tasks
    const res2 = await fetch(`${BASE}/tasks`);
    const list = await res2.json() as any[];
    assert("GET /tasks → array", Array.isArray(list));
    assert("list has 1 task", list.length === 1);

    // 3. Get task
    const res3 = await fetch(`${BASE}/tasks/${task1.id}`);
    const got = await res3.json() as any;
    assert("GET /tasks/:id → found", got.id === task1.id);
    assert("title matches", got.title === "Implement login");

    // 4. Update task (mark done with result)
    const res4 = await fetch(`${BASE}/tasks/${task1.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", result: "PR #42 merged" }),
    });
    const updated = await res4.json() as any;
    assert("PATCH /tasks/:id → status=done", updated.status === "done");
    assert("result set", updated.result === "PR #42 merged");

    // 5. Filter by status
    const res5 = await fetch(`${BASE}/tasks?status=pending`);
    const pending = await res5.json() as any[];
    assert("GET /tasks?status=pending → empty", pending.length === 0);

    const res6 = await fetch(`${BASE}/tasks?status=done`);
    const done = await res6.json() as any[];
    assert("GET /tasks?status=done → 1", done.length === 1);

    // 6. Delete task
    const res7 = await fetch(`${BASE}/tasks/${task1.id}`, { method: "DELETE" });
    assert("DELETE /tasks/:id → 200", res7.status === 200);

    const res8 = await fetch(`${BASE}/tasks/${task1.id}`);
    assert("GET deleted task → 404", res8.status === 404);

    // 7. 404 on unknown task
    const res9 = await fetch(`${BASE}/tasks/nonexistent`);
    assert("GET unknown → 404", res9.status === 404);

    console.log(`\n─── Results: ${passed} passed, ${failed} failed ───\n`);

  } finally {
    await app.close();
    db.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
