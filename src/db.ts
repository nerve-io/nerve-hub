/**
 * db.ts — SQLite storage, the only state in the system.
 *
 * Three tables: projects, tasks, events.
 * Versioned migrations: schema upgrades are applied automatically on startup.
 * Uses bun:sqlite (zero native rebuilds).
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { dirname, join } from "path";
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
  rules: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  rules?: string;
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
  creator: string;
  logPath: string | null;
  reflection: string | null;
  selftestReport: string | null;
  knownIssues: string | null;
  uncoveredScope: string | null;
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
  creator?: string;
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
  logPath?: string | null;
  reflection?: string | null;
  selftestReport?: string | null;
  knownIssues?: string | null;
  uncoveredScope?: string | null;
}

export interface ListFilter {
  projectId?: string;
  status?: string;
  priority?: string;
  type?: string;
  assignee?: string;
  search?: string;
  limit?: number;
  offset?: number;
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
  offset?: number;
  assigneeFilter?: string;
}

export type BatchCompleteFn = (projectId: string, stats: { total: number; doneCount: number; failedCount: number }) => void;

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
  comments: Comment[];
}

export interface Comment {
  id: string;
  taskId: string;
  projectId: string;
  actor: string;
  body: string;
  createdAt: string;
}

// ─── Agent ──────────────────────────────────────────────────────────────────

export type AgentType = 'webhook' | 'manual';
export type AgentStatus = 'online' | 'offline' | 'busy';
export type PermissionLevel = 'readonly' | 'task-self' | 'task-any' | 'admin';
export type VisibilityScope = 'own' | 'global';

const PERMISSION_ORDER: Record<PermissionLevel, number> = {
  'readonly': 0,
  'task-self': 1,
  'task-any': 2,
  'admin': 3,
};

export interface AgentCapabilities {
  taskTypes?: string[];
  languages?: string[];
  priorities?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  endpoint?: string;
  heartbeatInterval?: number;
  lastSeen?: string;
  status: AgentStatus;
  metadata?: string;
  capabilities?: AgentCapabilities;
  permissionLevel?: PermissionLevel;
  visibilityScope?: VisibilityScope;
  rules?: string;
  createdAt: string;
}

// ─── Agent Credentials ───────────────────────────────────────────────────────

export type AgentCredentialStatus = 'active' | 'revoked' | 'expired';

export interface AgentCredential {
  id: string;
  agentId: string;
  keyId: string;
  tokenHash: string;
  status: AgentCredentialStatus;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  createdBy: string;
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
  {
    version: 7,
    name: "add_comments_table",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comments (
          id         TEXT PRIMARY KEY,
          task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          project_id TEXT NOT NULL,
          actor      TEXT NOT NULL DEFAULT 'system',
          body       TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
      `);
    },
  },
  {
    version: 8,
    name: "add_agents_table",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS agents (
          id                TEXT PRIMARY KEY,
          name              TEXT NOT NULL,
          type              TEXT NOT NULL,
          endpoint          TEXT,
          heartbeat_interval INTEGER,
          last_seen         TEXT,
          status            TEXT NOT NULL DEFAULT 'offline',
          metadata          TEXT,
          created_at        TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 9,
    name: "add_project_rules",
    up(db) {
      db.exec(`ALTER TABLE projects ADD COLUMN rules TEXT NOT NULL DEFAULT ''`);
    },
  },
  {
    version: 10,
    name: "add_agent_capabilities",
    up(db) {
      db.exec(`ALTER TABLE agents ADD COLUMN capabilities TEXT`);
    },
  },
  {
    version: 11,
    name: "add_agent_rules",
    up(db) {
      addColumnIfNotExists(db, "agents", "rules", "TEXT NOT NULL DEFAULT ''");
    },
  },
  {
    version: 12,
    name: "add_task_creator",
    up(db) {
      addColumnIfNotExists(db, "tasks", "creator", "TEXT NOT NULL DEFAULT ''");
    },
  },
  {
    version: 13,
    name: "add_agent_credentials_table",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_credentials (
          id          TEXT PRIMARY KEY,
          agent_id    TEXT NOT NULL REFERENCES agents(id),
          key_id      TEXT UNIQUE NOT NULL,
          token_hash  TEXT UNIQUE NOT NULL,
          status      TEXT NOT NULL DEFAULT 'active',
          issued_at   TEXT NOT NULL,
          expires_at  TEXT,
          revoked_at  TEXT,
          last_used_at TEXT,
          created_by  TEXT NOT NULL DEFAULT 'operator'
        );
        CREATE INDEX IF NOT EXISTS idx_agent_credentials_token_hash ON agent_credentials(token_hash);
        CREATE INDEX IF NOT EXISTS idx_agent_credentials_agent_id   ON agent_credentials(agent_id);
      `);
    },
  },
  {
    version: 14,
    name: "add_task_log_path",
    up(db) {
      addColumnIfNotExists(db, "tasks", "log_path", "TEXT");
    },
  },
  {
    version: 15,
    name: "add_task_reflection",
    up(db) {
      addColumnIfNotExists(db, "tasks", "reflection", "TEXT");
    },
  },
  {
    version: 16,
    name: "add_task_acceptance_fields",
    up(db) {
      addColumnIfNotExists(db, "tasks", "selftest_report", "TEXT");
      addColumnIfNotExists(db, "tasks", "known_issues", "TEXT");
      addColumnIfNotExists(db, "tasks", "uncovered_scope", "TEXT");
    },
  },
  {
    version: 17,
    name: "add_agent_permission_fields",
    up(db) {
      db.exec(`ALTER TABLE agents ADD COLUMN permission_level TEXT NOT NULL DEFAULT 'task-any'`);
      db.exec(`ALTER TABLE agents ADD COLUMN visibility_scope TEXT NOT NULL DEFAULT 'global'`);
      db.exec(`UPDATE agents SET permission_level = 'admin' WHERE id = 'claude-desktop'`);
    },
  },
  {
    version: 18,
    name: "backfill_event_task_titles",
    up(db) {
      // For events that are missing $.title in payload, backfill from the
      // task.created event for the same task_id (which always had title).
      db.exec(`
        UPDATE events
        SET payload = json_set(
          payload,
          '$.title',
          (SELECT json_extract(e2.payload, '$.title')
           FROM events e2
           WHERE e2.task_id = events.task_id
             AND e2.action = 'task.created'
             AND json_extract(e2.payload, '$.title') IS NOT NULL
           LIMIT 1)
        )
        WHERE action IN ('task.updated', 'task.status_changed', 'task.commented', 'task.comment_deleted')
          AND task_id != ''
          AND (json_extract(payload, '$.title') IS NULL
               OR json_type(payload, '$.title') = 'null')
          AND EXISTS (
            SELECT 1 FROM events e3
            WHERE e3.task_id = events.task_id
              AND e3.action = 'task.created'
              AND json_extract(e3.payload, '$.title') IS NOT NULL
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
  /** Absolute path to the file-inbox directory (e.g. .nerve/inbox/). */
  readonly inboxDir: string;
  private _onBatchComplete?: BatchCompleteFn;

  constructor(dbPath: string, hooks?: { onBatchComplete?: BatchCompleteFn }) {
    const dir = dirname(dbPath);
    this.inboxDir = process.env.NERVE_INBOX_PATH ?? join(dir, "inbox");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this._onBatchComplete = hooks?.onBatchComplete;
    this.db = new Database(dbPath);
    // busy_timeout: wait up to 10s instead of immediately throwing "database is locked".
    // Needed when MCP binary and dev server share the same DB file concurrently.
    this.db.exec("PRAGMA busy_timeout = 10000");
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
    let fromClause = "events";
    const joins: string[] = [];

    if (filter?.assigneeFilter) {
      joins.push("JOIN tasks ON events.task_id = tasks.id");
      conditions.push("(tasks.assignee = ? OR events.task_id = '')");
      params.push(filter.assigneeFilter);
    }

    if (filter?.projectId) {
      conditions.push("events.project_id = ?");
      params.push(filter.projectId);
    }
    if (filter?.taskId) {
      conditions.push("events.task_id = ?");
      params.push(filter.taskId);
    }

    const joinStr = joins.length > 0 ? " " + joins.join(" ") : "";
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(filter?.limit ?? 50, 200);
    const offset = filter?.offset ?? 0;

    const rows = this.db.prepare(
      `SELECT events.* FROM ${fromClause}${joinStr} ${where} ORDER BY events.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as any[];

    return rows.map(r => this.toEvent(r));
  }

  countEvents(filter?: { projectId?: string; taskId?: string; assigneeFilter?: string }): number {
    const conditions: string[] = [];
    const params: any[] = [];
    let fromClause = "events";
    const joins: string[] = [];

    if (filter?.assigneeFilter) {
      joins.push("JOIN tasks ON events.task_id = tasks.id");
      conditions.push("(tasks.assignee = ? OR events.task_id = '')");
      params.push(filter.assigneeFilter);
    }
    if (filter?.projectId) {
      conditions.push("events.project_id = ?");
      params.push(filter.projectId);
    }
    if (filter?.taskId) {
      conditions.push("events.task_id = ?");
      params.push(filter.taskId);
    }

    const joinStr = joins.length > 0 ? " " + joins.join(" ") : "";
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const row = this.db.prepare(`SELECT COUNT(*) as c FROM ${fromClause}${joinStr} ${where}`).get(...params) as any;
    return row?.c ?? 0;
  }

  // ─── Project CRUD ───────────────────────────────────────────────────────

  createProject(input: CreateProjectInput): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? "",
      rules: input.rules ?? "",
      createdAt: now,
      updatedAt: now,
    };
    this.db.prepare(
      `INSERT INTO projects (id, name, description, rules, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(project.id, project.name, project.description, project.rules, project.createdAt, project.updatedAt);
    return project;
  }

  getProject(id: string): Project | undefined {
    // Accept either UUID or project name (case-insensitive)
    const row = this.db.prepare(
      "SELECT * FROM projects WHERE id = ? OR lower(name) = lower(?)"
    ).get(id, id) as any;
    return row ? this.toProject(row) : undefined;
  }

  listProjects(): Project[] {
    const rows = this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as any[];
    return rows.map(r => this.toProject(r));
  }

  updateProject(id: string, input: { name?: string; description?: string; rules?: string }): Project | undefined {
    const now = new Date().toISOString();
    const sets: string[] = [];
    const vals: any[] = [];
    if (input.name !== undefined) { sets.push("name = ?"); vals.push(input.name); }
    if (input.description !== undefined) { sets.push("description = ?"); vals.push(input.description); }
    if (input.rules !== undefined) { sets.push("rules = ?"); vals.push(input.rules); }
    if (sets.length === 0) return this.getProject(id);
    sets.push("updated_at = ?");
    vals.push(now);
    vals.push(id);
    this.db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    return this.getProject(id);
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
      creator: input.creator ?? '',
      logPath: null,
      reflection: null,
      selftestReport: null,
      knownIssues: null,
      uncoveredScope: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.prepare(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, type, assignee, dependencies, result, creator, log_path, reflection, selftest_report, known_issues, uncovered_scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(task.id, task.projectId, task.title, task.description, task.status, task.priority, task.type, task.assignee, JSON.stringify(task.dependencies), task.result, task.creator, task.logPath ?? null, task.reflection ?? null, task.selftestReport ?? null, task.knownIssues ?? null, task.uncoveredScope ?? null, task.createdAt, task.updatedAt);

    this.logEvent({ projectId: task.projectId, taskId: task.id, actor, action: "task.created", payload: { title: task.title, creator: task.creator } });

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
    if (filter?.search) {
      conditions.push("(LOWER(title) LIKE '%' || LOWER(?) || '%' OR LOWER(description) LIKE '%' || LOWER(?) || '%')");
      params.push(filter.search, filter.search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(filter?.limit ?? 20, 100);
    const offset = filter?.offset ?? 0;
    const rows = this.db.prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];
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
      logPath: input.logPath !== undefined ? input.logPath : existing.logPath,
      reflection: input.reflection !== undefined ? input.reflection : existing.reflection,
      selftestReport: input.selftestReport !== undefined ? input.selftestReport : existing.selftestReport,
      knownIssues: input.knownIssues !== undefined ? input.knownIssues : existing.knownIssues,
      uncoveredScope: input.uncoveredScope !== undefined ? input.uncoveredScope : existing.uncoveredScope,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(
      `UPDATE tasks SET project_id = ?, title = ?, description = ?, status = ?, priority = ?, type = ?, assignee = ?, dependencies = ?, result = ?, log_path = ?, reflection = ?, selftest_report = ?, known_issues = ?, uncovered_scope = ?, updated_at = ? WHERE id = ?`
    ).run(updated.projectId, updated.title, updated.description, updated.status, updated.priority, updated.type, updated.assignee, JSON.stringify(updated.dependencies), updated.result, updated.logPath, updated.reflection, updated.selftestReport, updated.knownIssues, updated.uncoveredScope, updated.updatedAt, updated.id);

    // Log events
    const inputWithoutCreator = { ...input };
    delete (inputWithoutCreator as any).creator;
    this.logEvent({ projectId: updated.projectId, taskId: id, actor, action: "task.updated", payload: { title: updated.title, ...Object.fromEntries(Object.entries(inputWithoutCreator)) } });

    if (input.status && input.status !== existing.status) {
      this.logEvent({ projectId: updated.projectId, taskId: id, actor, action: "task.status_changed", payload: { title: updated.title, from: existing.status, to: input.status } });
      this._checkBatchComplete(updated, existing.status);
    }

    return updated;
  }

  // ─── Batch complete hook ──────────────────────────────────────────────

  private _checkBatchComplete(task: Task, previousStatus: string): void {
    if (!task.projectId) return;
    const terminals = ["done", "failed"];
    if (!terminals.includes(task.status) || terminals.includes(previousStatus)) return;

    const allTasks = this.list({ projectId: task.projectId });
    const allTerminal = allTasks.every(t => terminals.includes(t.status));
    if (!allTerminal || !this._onBatchComplete) return;

    const total = allTasks.length;
    const doneCount = allTasks.filter(t => t.status === "done").length;
    const failedCount = allTasks.filter(t => t.status === "failed").length;
    this._onBatchComplete(task.projectId, { total, doneCount, failedCount });
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

  getProjectBlockedStatuses(projectId: string): Record<string, boolean> {
    const rows = this.db.prepare(`
      SELECT t.id,
        EXISTS(
          SELECT 1 FROM tasks dep
          WHERE dep.id IN (
            SELECT value FROM json_each(t.dependencies)
          ) AND dep.status != 'done'
        ) AS is_blocked
      FROM tasks t
      WHERE t.project_id = ?
    `).all(projectId) as any[];

    const result: Record<string, boolean> = {};
    for (const row of rows) {
      result[row.id] = row.is_blocked === 1;
    }
    return result;
  }

  validateDependencies(taskId: string | null, deps: string[]): string | null {
    // 1. 去重检查
    const unique = new Set(deps);
    if (unique.size !== deps.length) {
      return "dependencies contains duplicate IDs";
    }

    // 2. 自引用检查
    if (taskId !== null && deps.includes(taskId)) {
      return "a task cannot depend on itself";
    }

    // 3. 存在性检查
    for (const depId of deps) {
      const dep = this.get(depId);
      if (!dep) {
        return `dependency not found: ${depId}`;
      }
    }

    // 4. 直接循环检查
    if (taskId !== null) {
      for (const depId of deps) {
        const dep = this.get(depId)!;
        if (dep.dependencies.includes(taskId)) {
          return `circular dependency detected: ${taskId} → ${depId} → ${taskId}`;
        }
      }
    }

    return null;
  }

  /** Require acceptance fields + reflection before marking code/research/review tasks done. */
  validateDoneGates(id: string, input: { status?: string; selftestReport?: string | null; knownIssues?: string | null; uncoveredScope?: string | null; reflection?: string | null }): string | null {
    if (input.status !== 'done') return null;

    const task = this.get(id);
    if (!task) return 'task not found';

    const GATED_TYPES = new Set(['code', 'research', 'review']);
    if (!GATED_TYPES.has(task.type)) return null;

    // Merge incoming values with existing task state
    const selftest = input.selftestReport !== undefined ? input.selftestReport : task.selftestReport;
    const known   = input.knownIssues !== undefined ? input.knownIssues : task.knownIssues;
    const scope   = input.uncoveredScope !== undefined ? input.uncoveredScope : task.uncoveredScope;
    const refl    = input.reflection !== undefined ? input.reflection : task.reflection;

    const missing: string[] = [];
    if (!selftest?.trim()) missing.push('selftestReport（自测过程与结论）');
    if (!known?.trim())   missing.push('knownIssues（已知未修复问题）');
    if (!scope?.trim())   missing.push('uncoveredScope（未覆盖的测试范围）');
    if (!refl?.trim())    missing.push('reflection（执行反思，100字以内）');

    if (missing.length > 0) {
      return `完成门禁未通过。以下必填字段为空，请在标记完成前通过 update_task 填入：\n${missing.map(f => `  - ${f}`).join('\n')}`;
    }

    return null;
  }

  // ─── Comments ────────────────────────────────────────────────────────────────

  createComment(input: { taskId: string; body: string }, actor = "system"): Comment {
    const task = this.get(input.taskId);
    if (!task) throw new Error("task not found");

    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO comments (id, task_id, project_id, actor, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.taskId, task.projectId, actor, input.body, now);

    this.logEvent({
      projectId: task.projectId,
      taskId: input.taskId,
      actor,
      action: "task.commented",
      payload: { title: task.title, body: input.body.slice(0, 100) },
    });

    return { id, taskId: input.taskId, projectId: task.projectId, actor, body: input.body, createdAt: now };
  }

  listComments(taskId: string, options?: { limit?: number; offset?: number }): Comment[] {
    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;
    return this.db.prepare(
      `SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`
    ).all(taskId, limit, offset).map((r: any) => ({
      id: r.id,
      taskId: r.task_id,
      projectId: r.project_id,
      actor: r.actor,
      body: r.body,
      createdAt: r.created_at,
    }));
  }

  getComment(commentId: string): Comment | undefined {
    const r = this.db.prepare(`SELECT * FROM comments WHERE id = ?`).get(commentId) as any;
    if (!r) return undefined;
    return { id: r.id, taskId: r.task_id, projectId: r.project_id, actor: r.actor, body: r.body, createdAt: r.created_at };
  }

  deleteComment(commentId: string, actor = "system"): boolean {
    const comment = this.db.prepare(`SELECT * FROM comments WHERE id = ?`).get(commentId) as any;
    if (!comment) return false;
    this.db.prepare(`DELETE FROM comments WHERE id = ?`).run(commentId);
    const task = this.get(comment.task_id);
    this.logEvent({
      projectId: comment.project_id,
      taskId: comment.task_id,
      actor,
      action: "task.comment_deleted",
      payload: { title: task?.title ?? comment.task_id },
    });
    return true;
  }

  // ─── Contexts ───────────────────────────────────────────────────────────

  getProjectContext(projectId: string, taskLimit = 200): ProjectContext | undefined {
    const project = this.getProject(projectId);
    if (!project) return undefined;

    const tasks = this.list({ projectId, limit: taskLimit });
    const total = (this.db.prepare("SELECT COUNT(*) as c FROM tasks WHERE project_id = ?").get(projectId) as any)?.c ?? tasks.length;
    const byStatus: Record<string, number> = {};
    // stats use full counts, not just the loaded slice
    const statusRows = this.db.prepare("SELECT status, COUNT(*) as c FROM tasks WHERE project_id = ? GROUP BY status").all(projectId) as any[];
    for (const row of statusRows) {
      byStatus[row.status] = row.c;
    }

    return { project, tasks, stats: { total, byStatus } };
  }

  getTaskContext(taskId: string): TaskContext | undefined {
    const task = this.get(taskId);
    if (!task) return undefined;

    const project = task.projectId ? (this.getProject(task.projectId) ?? null) : null;
    const blockedBy = this.getBlockedBy(taskId);
    const events = this.getEvents({ taskId, limit: 20 });
    const comments = this.listComments(taskId);

    return { task, project, blockedBy, events, comments };
  }

  // ─── Agent CRUD ──────────────────────────────────────────────────────────

  registerAgent(input: {
    id: string;
    name: string;
    type: AgentType;
    endpoint?: string;
    heartbeatInterval?: number;
    metadata?: string;
    capabilities?: AgentCapabilities | string;
    permissionLevel?: PermissionLevel;
    visibilityScope?: VisibilityScope;
  }): Agent {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO agents (id, name, type, endpoint, heartbeat_interval, last_seen, status, metadata, capabilities, permission_level, visibility_scope, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, 'offline', ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        endpoint = excluded.endpoint,
        heartbeat_interval = excluded.heartbeat_interval,
        metadata = excluded.metadata,
        capabilities = excluded.capabilities
    `).run(
      input.id,
      input.name,
      input.type,
      input.endpoint ?? null,
      input.heartbeatInterval ?? null,
      input.metadata ?? null,
      input.capabilities
        ? (typeof input.capabilities === "string" ? input.capabilities : JSON.stringify(input.capabilities))
        : null,
      input.permissionLevel ?? 'task-any',
      input.visibilityScope ?? 'global',
      now,
    );
    return this.getAgent(input.id)!;
  }

  getAgent(id: string): Agent | undefined {
    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as any;
    return row ? this.toAgent(row) : undefined;
  }

  listAgents(): Agent[] {
    const rows = this.db.prepare("SELECT * FROM agents ORDER BY created_at DESC").all() as any[];
    return rows.map(r => this.toAgent(r));
  }

  deleteAgent(id: string): boolean {
    const result = this.db.prepare("DELETE FROM agents WHERE id = ?").run(id);
    return result.changes > 0;
  }

  updateAgentStatus(id: string, status: AgentStatus, lastSeen?: string): boolean {
    const existing = this.getAgent(id);
    if (!existing) return false;

    this.db.prepare(`
      UPDATE agents SET status = ?, last_seen = COALESCE(?, last_seen) WHERE id = ?
    `).run(status, lastSeen ?? null, id);

    return true;
  }

  updateAgentRules(id: string, rules: string): Agent | undefined {
    this.db.prepare(
      `UPDATE agents SET rules = ? WHERE id = ?`
    ).run(rules, id);
    return this.getAgent(id);
  }

  updateAgentPermissions(id: string, fields: { permissionLevel?: PermissionLevel; visibilityScope?: VisibilityScope }): Agent | undefined {
    const existing = this.getAgent(id);
    if (!existing) return undefined;

    const updates: string[] = [];
    const params: any[] = [];

    if (fields.permissionLevel !== undefined) {
      updates.push("permission_level = ?");
      params.push(fields.permissionLevel);
    }
    if (fields.visibilityScope !== undefined) {
      updates.push("visibility_scope = ?");
      params.push(fields.visibilityScope);
    }

    if (updates.length === 0) return existing;

    params.push(id);
    this.db.prepare(`UPDATE agents SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    return this.getAgent(id);
  }

  /** Return sorted list of tasks, optionally restricted by visibility scope. */
  listTasksWithScope(filter: Parameters<typeof this.list>[0], agentId?: string, visibilityScope?: string): Task[] {
    if (visibilityScope !== 'own' || !agentId) {
      return this.list(filter);
    }

    const where = `(assignee = ? OR assignee IS NULL)`;
    const conditions: string[] = [where];
    const params: any[] = [agentId];

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
      // Allow the caller to further narrow within own tasks
      conditions.push("assignee = ?");
      params.push(filter.assignee);
    }
    if (filter?.search) {
      conditions.push("(LOWER(title) LIKE '%' || LOWER(?) || '%' OR LOWER(description) LIKE '%' || LOWER(?) || '%')");
      params.push(filter.search, filter.search);
    }

    const fullWhere = `WHERE ${conditions.join(" AND ")}`;
    const limit = Math.min(filter?.limit ?? 20, 100);
    const offset = filter?.offset ?? 0;
    const rows = this.db.prepare(`SELECT * FROM tasks ${fullWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];
    return rows.map(r => this.toTask(r));
  }

  /** Check whether an agent has sufficient permission level. Returns null if OK, or an error message string. */
  checkPermissionLevel(agent: Agent | undefined, required: PermissionLevel): string | null {
    if (!agent) return 'Agent not found. Are you registered? Contact the project admin (Neil) to register.';

    const current = agent.permissionLevel ?? 'task-any';
    const currentOrd = PERMISSION_ORDER[current];
    const requiredOrd = PERMISSION_ORDER[required];

    if (currentOrd >= requiredOrd) return null;

    return `权限不足：你的当前级别为「${current}」，此操作需要级别「${required}」。请联系 Neil（admin）在 WebUI 提升你的权限级别。`;
  }

  /** Check whether an agent can read a task given visibility scope.
   *  Returns null if OK, or an error message string. */
  checkTaskAccess(task: Task | null | undefined, agent: Agent | null | undefined): string | null {
    if (!task) return 'task not found';
    if (!agent) return null; // unauthenticated — allow (backward-compatible with legacy env-only mode)
    if (agent.visibilityScope !== 'own') return null; // global scope sees everything
    if (!task.assignee) return null; // unassigned tasks are visible to all
    if (task.assignee === agent.id) return null; // own task
    return `你的可见范围为「own」，无权查看此任务。当前任务接单人是「${task.assignee}」，需要「global」可见范围才能查看他人任务。请联系 Neil（admin）在 WebUI 调整你的 visibilityScope。`;
  }

  // ─── Agent Credentials CRUD ────────────────────────────────────────────────

  createAgentCredential(input: {
    agentId: string;
    keyId: string;
    tokenHash: string;
    expiresAt?: string;
  }): AgentCredential {
    const now = new Date().toISOString();
    const credential: AgentCredential = {
      id: `cred_${randomUUID().slice(0, 12)}`,
      agentId: input.agentId,
      keyId: input.keyId,
      tokenHash: input.tokenHash,
      status: 'active',
      issuedAt: now,
      expiresAt: input.expiresAt,
      createdBy: 'operator',
    };
    this.db.prepare(
      `INSERT INTO agent_credentials (id, agent_id, key_id, token_hash, status, issued_at, expires_at, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      credential.id,
      credential.agentId,
      credential.keyId,
      credential.tokenHash,
      credential.status,
      credential.issuedAt,
      credential.expiresAt ?? null,
      credential.createdBy
    );
    return credential;
  }

  getAgentCredentialByTokenHash(tokenHash: string): AgentCredential | undefined {
    const row = this.db.prepare(
      "SELECT * FROM agent_credentials WHERE token_hash = ?"
    ).get(tokenHash) as any;
    return row ? this.toAgentCredential(row) : undefined;
  }

  getAgentCredentialByKeyId(keyId: string): AgentCredential | undefined {
    const row = this.db.prepare(
      "SELECT * FROM agent_credentials WHERE key_id = ?"
    ).get(keyId) as any;
    return row ? this.toAgentCredential(row) : undefined;
  }

  listAgentCredentials(agentId: string): AgentCredential[] {
    const rows = this.db.prepare(
      "SELECT * FROM agent_credentials WHERE agent_id = ? ORDER BY issued_at DESC"
    ).all(agentId) as any[];
    return rows.map(r => this.toAgentCredential(r));
  }

  revokeAgentCredential(keyId: string): boolean {
    const now = new Date().toISOString();
    const result = this.db.prepare(
      `UPDATE agent_credentials SET status = 'revoked', revoked_at = ? WHERE key_id = ? AND status = 'active'`
    ).run(now, keyId);
    return result.changes > 0;
  }

  updateAgentCredentialLastUsed(tokenHash: string): boolean {
    const now = new Date().toISOString();
    const result = this.db.prepare(
      `UPDATE agent_credentials SET last_used_at = ? WHERE token_hash = ?`
    ).run(now, tokenHash);
    return result.changes > 0;
  }

  // ─── Handoff Queue ────────────────────────────────────────────────────

  getHandoffQueue(limit = 50, offset = 0): Task[] {
    const cappedLimit = Math.min(limit, 200);
    const rows = this.db.prepare(`
      SELECT tasks.* FROM tasks
      JOIN agents ON tasks.assignee = agents.id
      WHERE agents.type = 'manual'
        AND tasks.status NOT IN ('done', 'cancelled')
      ORDER BY
        CASE tasks.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        tasks.created_at ASC
      LIMIT ? OFFSET ?
    `).all(cappedLimit, offset) as any[];
    return rows.map(r => this.toTask(r));
  }

  generateBriefing(taskId: string): string | null {
    const task = this.get(taskId);
    if (!task) return null;

    const project = task.projectId ? this.getProject(task.projectId) : undefined;
    const blockedBy = this.getBlockedBy(taskId);
    const eventsTotal = this.db.prepare("SELECT COUNT(*) as c FROM events WHERE task_id = ?").get(taskId) as any;
    const events = this.getEvents({ taskId, limit: 5 });
    const commentsTotal = this.db.prepare("SELECT COUNT(*) as c FROM comments WHERE task_id = ?").get(taskId) as any;
    const comments = this.listComments(taskId, { limit: 5, offset: Math.max(0, (commentsTotal?.c ?? 0) - 5) });

    const projectName = project ? project.name : "(无项目)";
    const description = task.description || "（无描述）";
    const result = task.result || "（尚无结果）";

    const blockedBySection = blockedBy.length > 0
      ? blockedBy.map(t => `- [${t.status}] ${t.title} (${t.id})`).join("\n")
      : "（无阻塞项）";

    const eventsTruncated = (eventsTotal?.c ?? 0) > 5;
    const eventsSection = events.length > 0
      ? events.map(e => `- ${e.createdAt} [${e.action}] ${e.payload}`).join("\n")
      : "（无事件）";
    const eventsNote = eventsTruncated ? `（已截断，共 ${eventsTotal.c} 条）` : "";

    const commentsTruncated = (commentsTotal?.c ?? 0) > 5;
    const commentsSection = comments.length > 0
      ? comments.map(c => `- ${c.createdAt} [${c.actor}] ${c.body}`).join("\n")
      : "（无评论）";
    const commentsNote = commentsTruncated ? `（已截断，共 ${commentsTotal.c} 条）` : "";

    const lines: string[] = [
      `# 任务简报 — ${task.title}`,
      "",
      "## 基本信息",
      `- 任务 ID：${task.id}`,
      `- 项目：${projectName}`,
      `- 优先级：${task.priority}`,
      `- 负责人：${task.assignee}`,
      `- 状态：${task.status}`,
      `- 类型：${task.type}`,
      "",
      "## 任务描述",
      description,
      "",
    ];

    if (task.result) {
      lines.push("## 当前结果");
      lines.push(result);
      lines.push("");
    }

    lines.push(`## 阻塞项（${blockedBy.length} 个）`);
    lines.push(blockedBySection);
    lines.push("");
    lines.push(`## 近期事件（最近 ${events.length} 条）${eventsNote}`);
    lines.push(eventsSection);
    lines.push("");
    lines.push(`## 评论（${comments.length} 条）${commentsNote}`);
    lines.push(commentsSection);
    lines.push("");
    lines.push("---");
    lines.push("## 完成后如何回填结果");
    lines.push("");
    lines.push("**你已通过 MCP 软件集成接入了 nerve-hub。** 直接用你的 MCP 工具调用：");
    lines.push("");
    lines.push("```");
    lines.push(`complete_task`);
    lines.push(`  id:     "${task.id}"`);
    lines.push(`  result: "一段话描述你完成了什么、关键输出是什么"`);
    lines.push("```");
    lines.push("");
    lines.push("**如果你的 MCP 集成当前不可用**，备选方案是写入文件：");
    lines.push(`    .nerve/inbox/${task.id}.done.json`);
    lines.push("内容：");
    lines.push("```json");
    lines.push(JSON.stringify({ taskId: task.id, result: "<结果描述>" }, null, 2));
    lines.push("```");
    lines.push("服务器每 5 秒轮询该目录，自动完成回填。");

    return lines.join("\n");
  }

  // ─── Event helpers (public) ───────────────────────────────────────────

  logTaskDispatched(taskId: string, agentId: string, endpoint: string, projectId?: string): void {
    this.logEvent({
      projectId,
      taskId,
      actor: agentId,
      action: "task.dispatched",
      payload: { agentId, endpoint },
    });
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
      rules: row.rules,
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
      creator: row.creator ?? '',
      logPath: row.log_path ?? null,
      reflection: row.reflection ?? null,
      selftestReport: row.selftest_report ?? null,
      knownIssues: row.known_issues ?? null,
      uncoveredScope: row.uncovered_scope ?? null,
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

  private toAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      endpoint: row.endpoint ?? undefined,
      heartbeatInterval: row.heartbeat_interval ?? undefined,
      lastSeen: row.last_seen ?? undefined,
      status: row.status,
      metadata: row.metadata ?? undefined,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : undefined,
      permissionLevel: row.permission_level as PermissionLevel | undefined,
      visibilityScope: row.visibility_scope as VisibilityScope | undefined,
      rules: row.rules || undefined,
      createdAt: row.created_at,
    };
  }

  private toAgentCredential(row: any): AgentCredential {
    return {
      id: row.id,
      agentId: row.agent_id,
      keyId: row.key_id,
      tokenHash: row.token_hash,
      status: row.status,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at ?? undefined,
      revokedAt: row.revoked_at ?? undefined,
      lastUsedAt: row.last_used_at ?? undefined,
      createdBy: row.created_by,
    };
  }
}
