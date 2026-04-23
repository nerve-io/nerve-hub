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

// ─── Helpers ────────────────────────────────────────────────────────────────

async function postTask(title: string, extra?: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, ...extra }),
  });
  expect(res.status).toBe(201);
  return res.json();
}

async function patchTask(id: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ─── Basic CRUD (existing) ──────────────────────────────────────────────────

describe("basic CRUD", () => {
  let taskId: string;

  test("POST /tasks → 201", async () => {
    const task = await postTask("Implement login", { description: "OAuth2 flow" });
    expect(typeof task.id).toBe("string");
    expect(task.status).toBe("pending");
    expect(task.priority).toBe("medium");
    expect(task.type).toBe("custom");
    expect(task.assignee).toBe("");
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
    const { body: task } = await patchTask(taskId, { status: "done", result: "PR #42 merged" });
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

// ─── Extended statuses ──────────────────────────────────────────────────────

describe("extended statuses (running, blocked)", () => {
  test("PATCH → status=running", async () => {
    const task = await postTask("Refactor API");
    const { body: updated } = await patchTask(task.id, { status: "running" });
    expect(updated.status).toBe("running");
  });

  test("PATCH → status=blocked", async () => {
    const task = await postTask("Deploy staging");
    const { body: updated } = await patchTask(task.id, { status: "blocked" });
    expect(updated.status).toBe("blocked");
  });

  test("PATCH → invalid status → 400", async () => {
    const task = await postTask("Invalid status test");
    const { status, body } = await patchTask(task.id, { status: "hacked" });
    expect(status).toBe(400);
    expect(body.error).toContain("invalid status");
  });

  test("GET /tasks?status=invalid → 400", async () => {
    const res = await fetch(`${BASE}/tasks?status=garbage`);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("invalid status");
  });
});

// ─── Assignee ───────────────────────────────────────────────────────────────

describe("assignee field", () => {
  test("POST /tasks with assignee", async () => {
    const task = await postTask("Design schema", { assignee: "claude" });
    expect(task.assignee).toBe("claude");
  });

  test("PATCH assignee", async () => {
    const task = await postTask("Write tests");
    const { body: updated } = await patchTask(task.id, { assignee: "cursor" });
    expect(updated.assignee).toBe("cursor");
  });

  test("GET /tasks?assignee=claude → filtered", async () => {
    await postTask("Claude task 1", { assignee: "claude" });
    await postTask("Claude task 2", { assignee: "claude" });
    await postTask("Cursor task", { assignee: "cursor" });

    const res = await fetch(`${BASE}/tasks?assignee=claude`);
    const list = await res.json() as any[];
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.every((t: any) => t.assignee === "claude")).toBe(true);
  });

  test("GET /tasks?assignee=nonexistent → empty", async () => {
    const res = await fetch(`${BASE}/tasks?assignee=nobody`);
    const list = await res.json() as any[];
    expect(list.length).toBe(0);
  });

  test("GET /tasks?status=pending&assignee=claude → combined filter", async () => {
    const res = await fetch(`${BASE}/tasks?status=pending&assignee=claude`);
    const list = await res.json() as any[];
    expect(list.every((t: any) => t.status === "pending" && t.assignee === "claude")).toBe(true);
  });
});

// ─── Claim + Complete workflow (simulates MCP claim_task / complete_task) ───

describe("claim + complete workflow", () => {
  test("claim: PATCH status=running + assignee in one call", async () => {
    const task = await postTask("Build auth module");
    const { body: claimed } = await patchTask(task.id, { status: "running", assignee: "claude" });
    expect(claimed.status).toBe("running");
    expect(claimed.assignee).toBe("claude");
  });

  test("complete: PATCH status=done + result in one call", async () => {
    const task = await postTask("Fix typo");
    // claim first
    await patchTask(task.id, { status: "running", assignee: "gpt" });
    // complete
    const { body: completed } = await patchTask(task.id, { status: "done", result: "Fixed 3 typos in README" });
    expect(completed.status).toBe("done");
    expect(completed.result).toBe("Fixed 3 typos in README");
    expect(completed.assignee).toBe("gpt");
  });

  test("full lifecycle: pending → running → done", async () => {
    const task = await postTask("Full lifecycle test");
    expect(task.status).toBe("pending");

    const { body: claimed } = await patchTask(task.id, { status: "running", assignee: "claude" });
    expect(claimed.status).toBe("running");
    expect(claimed.assignee).toBe("claude");

    const { body: completed } = await patchTask(task.id, { status: "done", result: "All good" });
    expect(completed.status).toBe("done");
    expect(completed.result).toBe("All good");
  });
});

// ─── Priority ───────────────────────────────────────────────────────────────

describe("priority field", () => {
  test("POST /tasks with priority=critical", async () => {
    const task = await postTask("Hotfix auth bypass", { priority: "critical" });
    expect(task.priority).toBe("critical");
  });

  test("POST /tasks without priority → defaults to medium", async () => {
    const task = await postTask("No priority task");
    expect(task.priority).toBe("medium");
  });

  test("PATCH priority", async () => {
    const task = await postTask("Upgrade deps");
    const { body: updated } = await patchTask(task.id, { priority: "high" });
    expect(updated.priority).toBe("high");
  });

  test("GET /tasks?priority=critical → filtered", async () => {
    await postTask("Critical 1", { priority: "critical" });
    await postTask("Critical 2", { priority: "critical" });
    await postTask("Low priority", { priority: "low" });

    const res = await fetch(`${BASE}/tasks?priority=critical`);
    const list = await res.json() as any[];
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.every((t: any) => t.priority === "critical")).toBe(true);
  });

  test("GET /tasks?priority=invalid → 400", async () => {
    const res = await fetch(`${BASE}/tasks?priority=urgent`);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("invalid priority");
  });

  test("PATCH → invalid priority → 400", async () => {
    const task = await postTask("Invalid priority test");
    const { status, body } = await patchTask(task.id, { priority: "urgent" });
    expect(status).toBe(400);
    expect(body.error).toContain("invalid priority");
  });
});

// ─── Type ───────────────────────────────────────────────────────────────────

describe("type field", () => {
  test("POST /tasks with type=code", async () => {
    const task = await postTask("Implement feature", { type: "code" });
    expect(task.type).toBe("code");
  });

  test("POST /tasks without type → defaults to custom", async () => {
    const task = await postTask("No type task");
    expect(task.type).toBe("custom");
  });

  test("PATCH type", async () => {
    const task = await postTask("Review PR");
    const { body: updated } = await patchTask(task.id, { type: "review" });
    expect(updated.type).toBe("review");
  });

  test("GET /tasks?type=code → filtered", async () => {
    await postTask("Code task 1", { type: "code" });
    await postTask("Code task 2", { type: "code" });
    await postTask("Deploy task", { type: "deploy" });

    const res = await fetch(`${BASE}/tasks?type=code`);
    const list = await res.json() as any[];
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.every((t: any) => t.type === "code")).toBe(true);
  });

  test("GET /tasks?type=invalid → 400", async () => {
    const res = await fetch(`${BASE}/tasks?type=bugfix`);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("invalid type");
  });

  test("PATCH → invalid type → 400", async () => {
    const task = await postTask("Invalid type test");
    const { status, body } = await patchTask(task.id, { type: "bugfix" });
    expect(status).toBe(400);
    expect(body.error).toContain("invalid type");
  });
});

// ─── Project CRUD ────────────────────────────────────────────────────────────

async function postProject(name: string, extra?: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ...extra }),
  });
  expect(res.status).toBe(201);
  return res.json();
}

describe("project CRUD", () => {
  test("POST /projects → 201", async () => {
    const project = await postProject("nerve-hub", { description: "AI Agent task bus" });
    expect(typeof project.id).toBe("string");
    expect(project.name).toBe("nerve-hub");
    expect(project.description).toBe("AI Agent task bus");
  });

  test("GET /projects → array", async () => {
    await postProject("project-alpha");
    const res = await fetch(`${BASE}/projects`);
    const list = await res.json() as any[];
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  test("GET /projects/:id → found", async () => {
    const project = await postProject("project-beta");
    const res = await fetch(`${BASE}/projects/${project.id}`);
    const p = await res.json() as any;
    expect(p.id).toBe(project.id);
    expect(p.name).toBe("project-beta");
  });

  test("GET /projects/:id → not found", async () => {
    const res = await fetch(`${BASE}/projects/nonexistent`);
    expect(res.status).toBe(404);
  });

  test("POST /tasks with projectId", async () => {
    const project = await postProject("project-gamma");
    const task = await postTask("Task in project", { projectId: project.id });
    expect(task.projectId).toBe(project.id);
  });

  test("GET /tasks?projectId= → filtered", async () => {
    const project = await postProject("project-delta");
    await postTask("Delta task 1", { projectId: project.id });
    await postTask("Delta task 2", { projectId: project.id });
    await postTask("Orphan task"); // no projectId

    const res = await fetch(`${BASE}/tasks?projectId=${project.id}`);
    const list = await res.json() as any[];
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.every((t: any) => t.projectId === project.id)).toBe(true);
  });

  test("DELETE /projects/:id → 200", async () => {
    const project = await postProject("project-to-delete");
    const res = await fetch(`${BASE}/projects/${project.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.deleted).toBe(true);
  });

  test("DELETE /projects/:id → not found", async () => {
    const res = await fetch(`${BASE}/projects/nonexistent`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

// ─── Project Context ─────────────────────────────────────────────────────────

describe("project context", () => {
  let projectId: string;

  test("GET /projects/:id/context → full context", async () => {
    const project = await postProject("context-project");
    projectId = project.id;

    // Create tasks with various statuses
    await postTask("Pending task", { projectId });
    await postTask("Running task", { projectId });
    await postTask("Done task", { projectId });

    // Set statuses
    const tasks = db.list({ projectId });
    await patchTask(tasks[1].id, { status: "running" });
    await patchTask(tasks[2].id, { status: "done", result: "Completed" });

    // Get context
    const res = await fetch(`${BASE}/projects/${projectId}/context`);
    expect(res.status).toBe(200);
    const ctx = await res.json() as any;

    expect(ctx.project.id).toBe(projectId);
    expect(ctx.project.name).toBe("context-project");
    expect(ctx.tasks.length).toBe(3);
    expect(ctx.stats.total).toBe(3);
    expect(ctx.stats.byStatus.pending).toBe(1);
    expect(ctx.stats.byStatus.running).toBe(1);
    expect(ctx.stats.byStatus.done).toBe(1);
  });

  test("GET /projects/:id/context → empty project", async () => {
    const project = await postProject("empty-project");
    const res = await fetch(`${BASE}/projects/${project.id}/context`);
    const ctx = await res.json() as any;
    expect(ctx.stats.total).toBe(0);
    expect(Object.keys(ctx.stats.byStatus).length).toBe(0);
  });

  test("GET /projects/:id/context → not found", async () => {
    const res = await fetch(`${BASE}/projects/nonexistent/context`);
    expect(res.status).toBe(404);
  });
});

// ─── Task Dependencies ───────────────────────────────────────────────────────

describe("task dependencies", () => {
  test("POST /tasks with dependencies", async () => {
    const dep1 = await postTask("Dependency 1");
    const dep2 = await postTask("Dependency 2");
    const task = await postTask("Dependent task", { dependencies: [dep1.id, dep2.id] });
    expect(Array.isArray(task.dependencies)).toBe(true);
    expect(task.dependencies).toHaveLength(2);
    expect(task.dependencies).toContain(dep1.id);
    expect(task.dependencies).toContain(dep2.id);
  });

  test("POST /tasks without dependencies → defaults to empty array", async () => {
    const task = await postTask("No deps task");
    expect(Array.isArray(task.dependencies)).toBe(true);
    expect(task.dependencies).toHaveLength(0);
  });

  test("PATCH dependencies", async () => {
    const dep = await postTask("New dep");
    const task = await postTask("Task to update");
    const { body: updated } = await patchTask(task.id, { dependencies: [dep.id] });
    expect(updated.dependencies).toHaveLength(1);
    expect(updated.dependencies[0]).toBe(dep.id);
  });

  test("POST /tasks with invalid dependencies → 400", async () => {
    const res = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Bad deps", dependencies: ["valid-id", 123] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("dependencies must be an array of strings");
  });

  test("PATCH with invalid dependencies → 400", async () => {
    const task = await postTask("Bad patch deps");
    const { status, body } = await patchTask(task.id, { dependencies: "not-an-array" as any });
    expect(status).toBe(400);
    expect(body.error).toContain("dependencies must be an array of strings");
  });

  test("GET /tasks/:id/blocked-by → returns unfinished dependencies", async () => {
    const dep1 = await postTask("Blocking dep 1");
    const dep2 = await postTask("Blocking dep 2");
    const task = await postTask("Blocked task", { dependencies: [dep1.id, dep2.id] });

    const res = await fetch(`${BASE}/tasks/${task.id}/blocked-by`);
    expect(res.status).toBe(200);
    const blockedBy = await res.json() as any[];
    expect(blockedBy.length).toBe(2);
    expect(blockedBy.every((t: any) => t.status !== "done")).toBe(true);
  });

  test("GET /tasks/:id/blocked-by → empty when all deps done", async () => {
    const dep = await postTask("Done dep");
    await patchTask(dep.id, { status: "done", result: "Finished" });
    const task = await postTask("Unblocked task", { dependencies: [dep.id] });

    const res = await fetch(`${BASE}/tasks/${task.id}/blocked-by`);
    const blockedBy = await res.json() as any[];
    expect(blockedBy).toHaveLength(0);
  });

  test("GET /tasks/:id/blocked-by → empty when no dependencies", async () => {
    const task = await postTask("No deps");
    const res = await fetch(`${BASE}/tasks/${task.id}/blocked-by`);
    const blockedBy = await res.json() as any[];
    expect(blockedBy).toHaveLength(0);
  });

  test("GET /tasks/:id/blocked-by → partial completion", async () => {
    const dep1 = await postTask("Done dep");
    const dep2 = await postTask("Pending dep");
    await patchTask(dep1.id, { status: "done", result: "Finished" });
    const task = await postTask("Partially blocked", { dependencies: [dep1.id, dep2.id] });

    const res = await fetch(`${BASE}/tasks/${task.id}/blocked-by`);
    const blockedBy = await res.json() as any[];
    expect(blockedBy).toHaveLength(1);
    expect(blockedBy[0].id).toBe(dep2.id);
  });

  test("GET /tasks/:id/blocked-by → not found", async () => {
    const res = await fetch(`${BASE}/tasks/nonexistent/blocked-by`);
    expect(res.status).toBe(404);
  });
});

// ─── DB Migrations ────────────────────────────────────────────────────────────

describe("db migrations", () => {
  test("fresh DB: migrations table exists and version is 6", () => {
    expect(db.getMigrationVersion()).toBe(6);
  });

  test("fresh DB: all 6 migrations recorded", () => {
    // We can't query migrations table directly, but we can verify the version
    expect(db.getMigrationVersion()).toBe(6);
  });

  test("idempotent: reopening the same DB does not throw", () => {
    // Open the same DB file again — migrations should be a no-op
    const db2 = new TaskDB(TEST_DB);
    expect(db2.getMigrationVersion()).toBe(6);
    db2.close();
  });

  test("fresh DB: all columns exist on tasks table", () => {
    // Create a task with all fields to verify the full schema
    const task = db.create({
      title: "Full schema test",
      description: "desc",
      priority: "critical",
      type: "code",
      assignee: "claude",
      dependencies: [],
    });
    const fetched = db.get(task.id)!;
    expect(fetched.title).toBe("Full schema test");
    expect(fetched.description).toBe("desc");
    expect(fetched.priority).toBe("critical");
    expect(fetched.type).toBe("code");
    expect(fetched.assignee).toBe("claude");
    expect(fetched.dependencies).toEqual([]);
    expect(fetched.projectId).toBe("");
  });

  test("data survives migration: pre-existing data is preserved", () => {
    // Create a task, close DB, reopen, verify data still there
    const task = db.create({ title: "Survival test", assignee: "gpt" });
    const taskId = task.id;

    // Reopen the same DB
    const db2 = new TaskDB(TEST_DB);
    const fetched = db2.get(taskId);
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe("Survival test");
    expect(fetched!.assignee).toBe("gpt");
    expect(fetched!.status).toBe("pending");
    db2.close();
  });
});

// ─── Event Log ────────────────────────────────────────────────────────────────

describe("event log", () => {
  test("task.created event is logged after creating a task", async () => {
    const task = await postTask("Event test task");
    const events = db.getEvents({ taskId: task.id });
    const created = events.find((e: any) => e.action === "task.created");
    expect(created).toBeDefined();
    expect(created!.taskId).toBe(task.id);
    expect(created!.actor).toBe("system");
  });

  test("task.status_changed event is logged on status change", async () => {
    const task = await postTask("Status change event");
    await patchTask(task.id, { status: "running" });

    const events = db.getEvents({ taskId: task.id });
    const statusChanged = events.find((e: any) => e.action === "task.status_changed");
    expect(statusChanged).toBeDefined();
    const payload = JSON.parse(statusChanged!.payload);
    expect(payload.from).toBe("pending");
    expect(payload.to).toBe("running");
  });

  test("X-Nerve-Agent header is recorded as actor", async () => {
    const res = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nerve-Agent": "claude" },
      body: JSON.stringify({ title: "Actor test" }),
    });
    const task = await res.json() as any;

    const events = db.getEvents({ taskId: task.id });
    const created = events.find((e: any) => e.action === "task.created");
    expect(created!.actor).toBe("claude");
  });

  test("GET /events?projectId= filters events by project", async () => {
    const project = await postProject("event-project");
    await postTask("Project event task", { projectId: project.id });

    const res = await fetch(`${BASE}/events?projectId=${project.id}`);
    const events = await res.json() as any[];
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.every((e: any) => e.projectId === project.id)).toBe(true);
  });

  test("GET /events?taskId= filters events by task", async () => {
    const task = await postTask("Task event filter");
    await patchTask(task.id, { status: "done", result: "Complete" });

    const res = await fetch(`${BASE}/events?taskId=${task.id}`);
    const events = await res.json() as any[];
    expect(events.length).toBeGreaterThanOrEqual(2); // created + updated + status_changed
    expect(events.every((e: any) => e.taskId === task.id)).toBe(true);
  });

  test("GET /events?limit= respects limit", async () => {
    // Create multiple tasks to generate events
    for (let i = 0; i < 5; i++) {
      await postTask(`Limit task ${i}`);
    }

    const res = await fetch(`${BASE}/events?limit=3`);
    const events = await res.json() as any[];
    expect(events.length).toBe(3);
  });

  test("task.deleted event is logged", async () => {
    const task = await postTask("Delete event task");
    await fetch(`${BASE}/tasks/${task.id}`, { method: "DELETE" });

    const events = db.getEvents({ taskId: task.id });
    const deleted = events.find((e: any) => e.action === "task.deleted");
    expect(deleted).toBeDefined();
  });
});

// ─── get_task_context ─────────────────────────────────────────────────────────

describe("get_task_context", () => {
  test("returns task, project, blockedBy, and events", async () => {
    const project = await postProject("ctx-project");
    const dep = await postTask("Ctx dep", { projectId: project.id });
    const task = await postTask("Ctx task", { projectId: project.id, dependencies: [dep.id] });

    const res = await fetch(`${BASE}/tasks/${task.id}/context`);
    expect(res.status).toBe(200);
    const ctx = await res.json() as any;

    expect(ctx.task.id).toBe(task.id);
    expect(ctx.project.id).toBe(project.id);
    expect(ctx.blockedBy).toHaveLength(1);
    expect(ctx.blockedBy[0].id).toBe(dep.id);
    expect(ctx.events.length).toBeGreaterThanOrEqual(1);
  });

  test("project is null when task has no project", async () => {
    const task = await postTask("No project ctx");

    const res = await fetch(`${BASE}/tasks/${task.id}/context`);
    const ctx = await res.json() as any;
    expect(ctx.project).toBeNull();
    expect(ctx.task.id).toBe(task.id);
    expect(ctx.blockedBy).toHaveLength(0);
    expect(ctx.events.length).toBeGreaterThanOrEqual(1);
  });

  test("returns 404 for nonexistent task", async () => {
    const res = await fetch(`${BASE}/tasks/nonexistent/context`);
    expect(res.status).toBe(404);
  });
});

// ─── Batch Blocked Statuses (S1-01) ──────────────────────────────────────────

describe("batch blocked-statuses", () => {
  test("GET /projects/:id/blocked-statuses → correct map", async () => {
    const project = await postProject("blocked-project");
    const dep1 = await postTask("Blocking dep", { projectId: project.id });
    const dep2 = await postTask("Done dep", { projectId: project.id });
    await patchTask(dep2.id, { status: "done", result: "Finished" });
    const task1 = await postTask("Blocked task", { projectId: project.id, dependencies: [dep1.id] });
    const task2 = await postTask("Unblocked task", { projectId: project.id, dependencies: [dep2.id] });
    const task3 = await postTask("No deps task", { projectId: project.id });

    const res = await fetch(`${BASE}/projects/${project.id}/blocked-statuses`);
    expect(res.status).toBe(200);
    const map = await res.json() as Record<string, boolean>;
    expect(map[task1.id]).toBe(true);   // dep1 未完成
    expect(map[task2.id]).toBe(false);  // dep2 已完成
    expect(map[task3.id]).toBe(false);  // 无依赖
  });

  test("GET /projects/:id/blocked-statuses → empty project", async () => {
    const project = await postProject("empty-blocked-project");
    const res = await fetch(`${BASE}/projects/${project.id}/blocked-statuses`);
    expect(res.status).toBe(200);
    const map = await res.json() as Record<string, boolean>;
    expect(Object.keys(map)).toHaveLength(0);
  });

  test("GET /projects/:id/blocked-statuses → not found", async () => {
    const res = await fetch(`${BASE}/projects/nonexistent/blocked-statuses`);
    expect(res.status).toBe(404);
  });
});

// ─── Input Length Validation (S1-03) ──────────────────────────────────────────

describe("input length validation", () => {
  test("POST /projects with name > 100 chars → 400", async () => {
    const res = await fetch(`${BASE}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "a".repeat(101) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("100 characters or less");
  });

  test("POST /tasks with title > 200 chars → 400", async () => {
    const res = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "t".repeat(201) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("200 characters or less");
  });

  test("PATCH /tasks/:id with description > 5000 chars → 400", async () => {
    const task = await postTask("Length test");
    const { status, body } = await patchTask(task.id, { description: "d".repeat(5001) });
    expect(status).toBe(400);
    expect(body.error).toContain("5000 characters or less");
  });

  test("POST /tasks with assignee > 100 chars → 400", async () => {
    const res = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Assignee length test", assignee: "a".repeat(101) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("100 characters or less");
  });
});

// ─── Dependency Validation (S1-04) ────────────────────────────────────────────

describe("dependency validation", () => {
  test("POST /tasks with nonexistent dependency → 400", async () => {
    const res = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Bad dep", dependencies: ["nonexistent-id"] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("dependency not found");
  });

  test("PATCH /tasks/:id self-reference → 400", async () => {
    const task = await postTask("Self ref");
    const { status, body } = await patchTask(task.id, { dependencies: [task.id] });
    expect(status).toBe(400);
    expect(body.error).toContain("cannot depend on itself");
  });

  test("POST /tasks with duplicate dependencies → 400", async () => {
    const dep = await postTask("Dup dep");
    const res = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Dup test", dependencies: [dep.id, dep.id] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("duplicate");
  });

  test("direct circular dependency → 400", async () => {
    const taskA = await postTask("Task A");
    const taskB = await postTask("Task B", { dependencies: [taskA.id] });
    const { status, body } = await patchTask(taskA.id, { dependencies: [taskB.id] });
    expect(status).toBe(400);
    expect(body.error).toContain("circular dependency");
  });

  test("valid dependency → 201", async () => {
    const dep = await postTask("Valid dep");
    const task = await postTask("Valid task", { dependencies: [dep.id] });
    expect(task.dependencies).toHaveLength(1);
    expect(task.dependencies[0]).toBe(dep.id);
  });
});
