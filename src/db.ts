/**
 * db.ts — SQLite storage, the only state in the system.
 *
 * One table: tasks. That's it.
 * Uses bun:sqlite (zero native rebuilds).
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { dirname } from "path";
import { mkdirSync, existsSync } from "fs";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "done" | "failed";
  result: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: "pending" | "done" | "failed";
  result?: string;
}

// ─── Database ────────────────────────────────────────────────────────────────

export class TaskDB {
  private db: Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'pending',
        result      TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `);
  }

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? "",
      status: "pending",
      result: "",
      createdAt: now,
      updatedAt: now,
    };
    this.db.prepare(
      `INSERT INTO tasks (id, title, description, status, result, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(task.id, task.title, task.description, task.status, task.result, task.createdAt, task.updatedAt);
    return task;
  }

  get(id: string): Task | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    return row ? this.toTask(row) : undefined;
  }

  list(status?: string): Task[] {
    if (status) {
      const rows = this.db.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC").all(status) as any[];
      return rows.map(r => this.toTask(r));
    }
    const rows = this.db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as any[];
    return rows.map(r => this.toTask(r));
  }

  update(id: string, input: UpdateTaskInput): Task | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;

    const updated: Task = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      status: input.status ?? existing.status,
      result: input.result ?? existing.result,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(
      `UPDATE tasks SET title = ?, description = ?, status = ?, result = ?, updated_at = ? WHERE id = ?`
    ).run(updated.title, updated.description, updated.status, updated.result, updated.updatedAt, updated.id);

    return updated;
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }

  private toTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      result: row.result,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
