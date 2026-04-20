import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import type {
  Project,
  CreateProjectInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  Event,
  CreateEventInput,
  StateLog,
} from "./models.js";
import { generateId, nowISO } from "./models.js";

export class Storage {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure parent directory exists
    const dir = dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.init();
  }

  private init(): void {
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
        description TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'custom',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        assignee TEXT NOT NULL DEFAULT '',
        progress INTEGER NOT NULL DEFAULT 0,
        result TEXT,
        error TEXT NOT NULL DEFAULT '',
        dependencies TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        timestamp TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS state_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        actor TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
      CREATE INDEX IF NOT EXISTS idx_events_project_id ON events(project_id);
      CREATE INDEX IF NOT EXISTS idx_state_logs_task_id ON state_logs(task_id);
    `);
  }

  close(): void {
    this.db.close();
  }

  // ─── Projects ────────────────────────────────────────────────────────────

  createProject(input: CreateProjectInput): Project {
    const now = nowISO();
    const project: Project = {
      id: generateId(),
      name: input.name,
      description: input.description ?? "",
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(
      `INSERT INTO projects (id, name, description, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      project.id,
      project.name,
      project.description,
      JSON.stringify(project.metadata),
      project.createdAt,
      project.updatedAt
    );

    return project;
  }

  getProject(id: string): Project | null {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as any;
    return row ? this.rowToProject(row) : null;
  }

  listProjects(): Project[] {
    const rows = this.db
      .prepare("SELECT * FROM projects ORDER BY created_at DESC")
      .all() as any[];
    return rows.map((r) => this.rowToProject(r));
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────

  createTask(input: CreateTaskInput): Task {
    const now = nowISO();
    const task: Task = {
      id: generateId(),
      projectId: input.projectId,
      parentId: input.parentId ?? null,
      title: input.title,
      description: input.description ?? "",
      type: input.type ?? "custom",
      priority: input.priority ?? "medium",
      status: "pending",
      assignee: input.assignee ?? "",
      progress: 0,
      result: null,
      error: "",
      dependencies: input.dependencies ?? [],
      metadata: input.metadata ?? {},
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    };

    this.db.prepare(
      `INSERT INTO tasks
        (id, project_id, parent_id, title, description, type, priority, status,
         assignee, progress, result, error, dependencies, metadata, tags,
         created_at, updated_at, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      task.id,
      task.projectId,
      task.parentId,
      task.title,
      task.description,
      task.type,
      task.priority,
      task.status,
      task.assignee,
      task.progress,
      task.result ? JSON.stringify(task.result) : null,
      task.error,
      JSON.stringify(task.dependencies),
      JSON.stringify(task.metadata),
      JSON.stringify(task.tags),
      task.createdAt,
      task.updatedAt,
      task.startedAt,
      task.completedAt
    );

    return task;
  }

  getTask(id: string): Task | null {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(id) as any;
    return row ? this.rowToTask(row) : null;
  }

  updateTask(id: string, input: UpdateTaskInput): Task | null {
    const existing = this.getTask(id);
    if (!existing) return null;

    const updated: Task = {
      ...existing,
      ...input,
      updatedAt: nowISO(),
    };

    // Handle startedAt/completedAt based on status changes
    if (input.status === "running" && existing.status !== "running") {
      updated.startedAt = nowISO();
    }
    if (
      (input.status === "done" || input.status === "failed") &&
      existing.status !== "done" &&
      existing.status !== "failed"
    ) {
      updated.completedAt = nowISO();
    }

    this.db.prepare(
      `UPDATE tasks SET
        parent_id = ?, title = ?, description = ?, type = ?, priority = ?,
        status = ?, assignee = ?, progress = ?, result = ?, error = ?,
        dependencies = ?, metadata = ?, tags = ?, updated_at = ?,
        started_at = ?, completed_at = ?
       WHERE id = ?`
    ).run(
      updated.parentId,
      updated.title,
      updated.description,
      updated.type,
      updated.priority,
      updated.status,
      updated.assignee,
      updated.progress,
      updated.result ? JSON.stringify(updated.result) : null,
      updated.error,
      JSON.stringify(updated.dependencies),
      JSON.stringify(updated.metadata),
      JSON.stringify(updated.tags),
      updated.updatedAt,
      updated.startedAt,
      updated.completedAt,
      updated.id
    );

    return updated;
  }

  queryTasks(filters: {
    projectId?: string;
    status?: string;
    assignee?: string;
    type?: string;
  }): Task[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.projectId) {
      conditions.push("project_id = ?");
      params.push(filters.projectId);
    }
    if (filters.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.assignee) {
      conditions.push("assignee = ?");
      params.push(filters.assignee);
    }
    if (filters.type) {
      conditions.push("type = ?");
      params.push(filters.type);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`)
      .all(...params) as any[];

    return rows.map((r) => this.rowToTask(r));
  }

  deleteTask(id: string): boolean {
    const result = this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return result.changes > 0;
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  createEvent(input: CreateEventInput): Event {
    const event: Event = {
      id: generateId(),
      projectId: input.projectId,
      channel: input.channel,
      type: input.type,
      source: input.source,
      payload: input.payload ?? {},
      timestamp: nowISO(),
    };

    this.db.prepare(
      `INSERT INTO events (id, project_id, channel, type, source, payload, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.id,
      event.projectId,
      event.channel,
      event.type,
      event.source,
      JSON.stringify(event.payload),
      event.timestamp
    );

    return event;
  }

  listEvents(projectId: string, limit = 100): Event[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM events WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`
      )
      .all(projectId, limit) as any[];
    return rows.map((r) => this.rowToEvent(r));
  }

  // ─── State Logs ──────────────────────────────────────────────────────────

  createStateLog(
    taskId: string,
    field: string,
    oldValue: unknown,
    newValue: unknown,
    actor: string
  ): StateLog {
    const log: StateLog = {
      id: generateId(),
      taskId,
      field,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      actor,
      timestamp: nowISO(),
    };

    this.db.prepare(
      `INSERT INTO state_logs (id, task_id, field, old_value, new_value, actor, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      log.id,
      log.taskId,
      log.field,
      JSON.stringify(log.oldValue),
      JSON.stringify(log.newValue),
      log.actor,
      log.timestamp
    );

    return log;
  }

  listStateLogs(taskId: string, limit = 100): StateLog[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM state_logs WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?`
      )
      .all(taskId, limit) as any[];
    return rows.map((r) => this.rowToStateLog(r));
  }

  // ─── Row Mappers ─────────────────────────────────────────────────────────

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
