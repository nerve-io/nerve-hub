import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Project, Task, Event, StateLog, TaskFilter } from "./models.js";

export class Storage {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'custom',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        assignee TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        result TEXT,
        error TEXT,
        dependencies TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        timestamp TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS state_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        actor TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
      CREATE INDEX IF NOT EXISTS idx_events_project_id ON events(project_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_state_logs_task_id ON state_logs(task_id);
    `);
  }

  // ── Projects ──────────────────────────────────────────────────────

  createProject(p: Project): void {
    this.db.prepare(`
      INSERT INTO projects (id, name, description, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(p.id, p.name, p.description, JSON.stringify(p.metadata), p.createdAt, p.updatedAt);
  }

  getProject(id: string): Project | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.rowToProject(row);
  }

  listProjects(): Project[] {
    const rows = this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => this.rowToProject(r));
  }

  // ── Tasks ─────────────────────────────────────────────────────────

  createTask(t: Task): void {
    this.db.prepare(`
      INSERT INTO tasks (
        id, project_id, parent_id, title, description, type, priority, status,
        assignee, progress, result, error, dependencies, metadata, tags,
        created_at, updated_at, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t.id, t.projectId, t.parentId, t.title, t.description, t.type, t.priority,
      t.status, t.assignee, t.progress,
      t.result ? JSON.stringify(t.result) : null,
      t.error,
      JSON.stringify(t.dependencies),
      JSON.stringify(t.metadata),
      JSON.stringify(t.tags),
      t.createdAt, t.updatedAt, t.startedAt, t.completedAt,
    );
  }

  getTask(id: string): Task | null {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.rowToTask(row);
  }

  updateTask(id: string, updates: Record<string, unknown>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    const columnMap: Record<string, string> = {
      title: "title",
      description: "description",
      type: "type",
      priority: "priority",
      status: "status",
      assignee: "assignee",
      progress: "progress",
      error: "error",
      startedAt: "started_at",
      completedAt: "completed_at",
      updatedAt: "updated_at",
      parentId: "parent_id",
    };

    const jsonFields = ["result", "dependencies", "metadata", "tags"];

    for (const [key, value] of Object.entries(updates)) {
      if (key === "updatedAt") continue; // handled separately
      const col = columnMap[key];
      if (col) {
        fields.push(`${col} = ?`);
        values.push(value);
      } else if (jsonFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      }
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`
    ).run(...values);
  }

  queryTasks(filter: TaskFilter): Task[] {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.projectId) {
      conditions.push("project_id = ?");
      values.push(filter.projectId);
    }
    if (filter.status) {
      conditions.push("status = ?");
      values.push(filter.status);
    }
    if (filter.assignee) {
      conditions.push("assignee = ?");
      values.push(filter.assignee);
    }
    if (filter.type) {
      conditions.push("type = ?");
      values.push(filter.type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db.prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`).all(...values) as any[];
    return rows.map((r) => this.rowToTask(r));
  }

  deleteTask(id: string): boolean {
    const result = this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return result.changes > 0;
  }

  // ── Events ────────────────────────────────────────────────────────

  createEvent(e: Event): void {
    this.db.prepare(`
      INSERT INTO events (id, project_id, channel, type, source, payload, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(e.id, e.projectId, e.channel, e.type, e.source, JSON.stringify(e.payload), e.timestamp);
  }

  listEvents(projectId: string, since?: string): Event[] {
    let rows: any[];
    if (since) {
      rows = this.db.prepare(
        "SELECT * FROM events WHERE project_id = ? AND timestamp >= ? ORDER BY timestamp DESC"
      ).all(projectId, since) as any[];
    } else {
      rows = this.db.prepare(
        "SELECT * FROM events WHERE project_id = ? ORDER BY timestamp DESC"
      ).all(projectId) as any[];
    }
    return rows.map((r) => this.rowToEvent(r));
  }

  // ── State Logs ────────────────────────────────────────────────────

  createStateLog(log: StateLog): void {
    this.db.prepare(`
      INSERT INTO state_logs (id, task_id, field, old_value, new_value, actor, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.id, log.taskId, log.field,
      log.oldValue !== null && log.oldValue !== undefined ? JSON.stringify(log.oldValue) : null,
      log.newValue !== null && log.newValue !== undefined ? JSON.stringify(log.newValue) : null,
      log.actor, log.timestamp,
    );
  }

  listStateLogs(taskId: string): StateLog[] {
    const rows = this.db.prepare(
      "SELECT * FROM state_logs WHERE task_id = ? ORDER BY timestamp DESC"
    ).all(taskId) as any[];
    return rows.map((r) => this.rowToStateLog(r));
  }

  // ── Close ─────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }

  // ── Row Mappers ───────────────────────────────────────────────────

  private rowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToTask(row: any): Task {
    return {
      id: row.id,
      projectId: row.project_id,
      parentId: row.parent_id,
      title: row.title,
      description: row.description,
      type: row.type,
      priority: row.priority,
      status: row.status,
      assignee: row.assignee,
      progress: row.progress,
      result: row.result ? JSON.parse(row.result) : null,
      error: row.error,
      dependencies: JSON.parse(row.dependencies),
      metadata: JSON.parse(row.metadata),
      tags: JSON.parse(row.tags),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  private rowToEvent(row: any): Event {
    return {
      id: row.id,
      projectId: row.project_id,
      channel: row.channel,
      type: row.type,
      source: row.source,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
    };
  }

  private rowToStateLog(row: any): StateLog {
    return {
      id: row.id,
      taskId: row.task_id,
      field: row.field,
      oldValue: row.old_value ? JSON.parse(row.old_value) : null,
      newValue: row.new_value ? JSON.parse(row.new_value) : null,
      actor: row.actor,
      timestamp: row.timestamp,
    };
  }
}
