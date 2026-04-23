/**
 * db.ts — SQLite storage, the only state in the system.
 *
 * Three tables: projects, tasks, events.
 * Versioned migrations: schema upgrades are applied automatically on startup.
 * Uses bun:sqlite (zero native rebuilds).
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { dirname } from "path";
import { mkdirSync, existsSync } from "fs";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "running" | "done" | "failed" | "blocked";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskType = "code" | "review" | "test" | "deploy" | "research" | "custom";

// ─── Project ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assignee: string;
  dependencies: string[];
  result: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  projectId?: string;
  description?: string;
  priority?: TaskPriority;
  type?: TaskType;
  assignee?: string;
  dependencies?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  projectId?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  assignee?: string;
  dependencies?: string[];
  result?: string;
}

export interface ListFilter {
  projectId?: string;
  status?: string;
  priority?: string;
  type?: string;
  assignee?: string;
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  projectId: string;
  taskId: string;
  actor: string;
  action: string;
  payload: string;
  createdAt: string;
}

export interface EventFilter {
  projectId?: string;
  taskId?: string;
  limit?: number;
}

// ─── Contexts ────────────────────────────────────────────────────────────────

export interface ProjectContext {
  project: Project;
  tasks: Task[];
  stats: {
    total: number;
    byStatus: Record<string, number>;
  };
}

export interface TaskContext {
  task: Task;
  project: Project | null;
  blockedBy: Task[];
  events: Event[];
}

// ─── Migrations ──────────────────────────────────────────────────────────────

interface Migration {
  version: number;
  name: string;
  up(db: Database): void;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_tasks_table",
    up(db) {
      db.exec(`
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
    },
  },
  {
    version: 2,
    name: "add_assignee",
    up(db) {
      addColumnIfNotExists(db, "tasks", "assignee", "TEXT NOT NULL DEFAULT ''");
    },
  },
  {
    version: 3,
    name: "add_priority_and_type",
    up(db) {
      addColumnIfNotExists(db, "tasks", "priority", "TEXT NOT NULL DEFAULT 'medium'");
      addColumnIfNotExists(db, "tasks", "type", "TEXT NOT NULL DEFAULT 'custom'");
    },
  },
  {
    version: 4,
    name: "add_projects_and_project_id",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
      `);
      addColumnIfNotExists(db, "tasks", "project_id", "TEXT NOT NULL DEFAULT ''");
    },
  },
  {
    version: 5,
    name: "add_dependencies",
    up(db) {
      addColumnIfNotExists(db, "tasks", "dependencies", "TEXT NOT NULL DEFAULT '[]'");
    },
  },
  {
    version: 6,
    name: "add_events_table",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          id         TEXT PRIMARY KEY,
          project_id TEXT NOT NULL DEFAULT '',
          task_id    TEXT NOT NULL DEFAULT '',
          actor      TEXT NOT NULL DEFAULT 'system',
          action     TEXT NOT NULL,
          payload    TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
      `);
    },
  },
];

/** Check if a column exists in a table via PRAGMA table_info. */
function columnExists(db: Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return rows.some((r) => r.name === column);
}

/** Add a column only if it doesn't already exist. Safe for SQLite. */
function addColumnIfNotExists(db: Database, table: string, column: string, definition: string): void {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// ─── Database ────────────────────────────────────────────────────────────────

export class TaskDB {
  private db: Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");

    // Ensure migrations tracking table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    // Apply pending migrations
    this.runMigrations();
  }

  private runMigrations(): void {
    const currentVersion = this.getCurrentMigrationVersion();

    for (const migration of MIGRATIONS) {
      if (migration.version <= currentVersion) continue;

      const tx = this.db.transaction(() => {
        migration.up(this.db);
        this.db.prepare(
          `INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)`
        ).run(migration.version, migration.name, new Date().toISOString());
      });

      try {
        tx();
      } catch (err) {
        throw new Error(`Migration v${migration.version} (${migration.name}) failed: ${err}`);
      }
    }
  }

  private getCurrentMigrationVersion(): number {
    const row = this.db.prepare("SELECT MAX(version) as v FROM migrations").get() as any;
    return row?.v ?? 0;
  }

  /** Public: get the current migration version (useful for testing). */
  getMigrationVersion(): number {
    return this.getCurrentMigrationVersion();
  }

  // ─── Event Logging ──────────────────────────────────────────────────────

  private logEvent(input: { projectId?: string; taskId?: string; actor?: string; action: string; payload?: Record<string, any> }): void {
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO events (id, project_id, task_id, actor, action, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      input.projectId ?? "",
      input.taskId ?? "",
      input.actor ?? "system",
      input.action,
      JSON.stringify(input.payload ?? {}),
      now,
    );
  }

  getEvents(filter?: EventFilter): Event[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.projectId) {
      conditions.push("project_id = ?");
      params.push(filter.projectId);
    }
    if (filter?.taskId) {
      conditions.push("task_id = ?");
      params.push(filter.taskId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(filter?.limit ?? 50, 200);

    const rows = this.db.prepare(
      `SELECT * FROM events ${where} ORDER BY created_at DESC LIMIT ?`
    ).all(...params, limit) as any[];

    return rows.map(r => this.toEvent(r));
  }

  // ─── Project CRUD ───────────────────────────────────────────────────────

  createProject(input: CreateProjectInput): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? "",
      createdAt: now,
      updatedAt: now,
    };
    this.db.prepare(
      `INSERT INTO projects (id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(project.id, project.name, project.description, project.createdAt, project.updatedAt);
    return project;
  }

  getProject(id: string): Project | undefined {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
    return row ? this.toProject(row) : undefined;
  }

  listProjects(): Project[] {
    const rows = this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as any[];
    return rows.map(r => this.toProject(r));
  }

  deleteProject(id: string): boolean {
    const result = this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return result.changes > 0;
  }

  // ─── Task CRUD ──────────────────────────────────────────────────────────

  create(input: CreateTaskInput, actor = "system"): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      projectId: input.projectId ?? "",
      title: input.title,
      description: input.description ?? "",
      status: "pending",
      priority: input.priority ?? "medium",
      type: input.type ?? "custom",
      assignee: input.assignee ?? "",
      dependencies: input.dependencies ?? [],
      result: "",
      createdAt: now,
      updatedAt: now,
    };
    this.db.prepare(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, type, assignee, dependencies, result, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(task.id, task.projectId, task.title, task.description, task.status, task.priority, task.type, task.assignee, JSON.stringify(task.dependencies), task.result, task.createdAt, task.updatedAt);

    this.logEvent({ projectId: task.projectId, taskId: task.id, actor, action: "task.created", payload: { title: task.title } });

    return task;
  }

  get(id: string): Task | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    return row ? this.toTask(row) : undefined;
  }

  list(filter?: ListFilter): Task[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.projectId) {
      conditions.push("project_id = ?");
      params.push(filter.projectId);
    }
    if (filter?.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter?.priority) {
      conditions.push("priority = ?");
      params.push(filter.priority);
    }
    if (filter?.type) {
      conditions.push("type = ?");
      params.push(filter.type);
    }
    if (filter?.assignee) {
      conditions.push("assignee = ?");
      params.push(filter.assignee);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db.prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`).all(...params) as any[];
    return rows.map(r => this.toTask(r));
  }

  update(id: string, input: UpdateTaskInput, actor = "system"): Task | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;

    const updated: Task = {
      ...existing,
      projectId: input.projectId ?? existing.projectId,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      status: input.status ?? existing.status,
      priority: input.priority ?? existing.priority,
      type: input.type ?? existing.type,
      assignee: input.assignee ?? existing.assignee,
      dependencies: input.dependencies ?? existing.dependencies,
      result: input.result ?? existing.result,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(
      `UPDATE tasks SET project_id = ?, title = ?, description = ?, status = ?, priority = ?, type = ?, assignee = ?, dependencies = ?, result = ?, updated_at = ? WHERE id = ?`
    ).run(updated.projectId, updated.title, updated.description, updated.status, updated.priority, updated.type, updated.assignee, JSON.stringify(updated.dependencies), updated.result, updated.updatedAt, updated.id);

    // Log events
    this.logEvent({ projectId: updated.projectId, taskId: id, actor, action: "task.updated", payload: Object.fromEntries(Object.entries(input)) });

    if (input.status && input.status !== existing.status) {
      this.logEvent({ projectId: updated.projectId, taskId: id, actor, action: "task.status_changed", payload: { from: existing.status, to: input.status } });
    }

    return updated;
  }

  delete(id: string, actor = "system"): boolean {
    const existing = this.get(id);
    if (!existing) return false;

    const result = this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    if (result.changes > 0) {
      this.logEvent({ projectId: existing.projectId, taskId: id, actor, action: "task.deleted", payload: { title: existing.title } });
    }
    return result.changes > 0;
  }

  // ─── Dependency helpers ────────────────────────────────────────────────

  getBlockedBy(id: string): Task[] {
    const task = this.get(id);
    if (!task || task.dependencies.length === 0) return [];

    return task.dependencies
      .map(depId => this.get(depId))
      .filter((dep): dep is Task => dep !== undefined && dep.status !== "done");
  }

  // ─── Contexts ───────────────────────────────────────────────────────────

  getProjectContext(projectId: string): ProjectContext | undefined {
    const project = this.getProject(projectId);
    if (!project) return undefined;

    const tasks = this.list({ projectId });
    const byStatus: Record<string, number> = {};
    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    }

    return { project, tasks, stats: { total: tasks.length, byStatus } };
  }

  getTaskContext(taskId: string): TaskContext | undefined {
    const task = this.get(taskId);
    if (!task) return undefined;

    const project = task.projectId ? (this.getProject(task.projectId) ?? null) : null;
    const blockedBy = this.getBlockedBy(taskId);
    const events = this.getEvents({ taskId, limit: 20 });

    return { task, project, blockedBy, events };
  }

  close(): void {
    this.db.close();
  }

  // ─── Row mappers ───────────────────────────────────────────────────────

  private toProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toTask(row: any): Task {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      type: row.type,
      assignee: row.assignee,
      dependencies: JSON.parse(row.dependencies || "[]"),
      result: row.result,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toEvent(row: any): Event {
    return {
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      actor: row.actor,
      action: row.action,
      payload: row.payload,
      createdAt: row.created_at,
    };
  }
}
