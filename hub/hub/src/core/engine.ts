import { v4 as uuidv4 } from "uuid";
import { Storage } from "./storage.js";
import {
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
  CreateProjectInputSchema,
  PublishEventInputSchema,
  TaskStatus,
} from "./models.js";
import type {
  Task,
  Project,
  Event,
  CreateTaskInput,
  UpdateTaskInput,
  CreateProjectInput,
  PublishEventInput,
  TaskFilter,
} from "./models.js";

export interface BoardView {
  pending: Task[];
  running: Task[];
  blocked: Task[];
  waiting: Task[];
  done: Task[];
  failed: Task[];
  archived: Task[];
}

export class NerveCore {
  private storage: Storage;

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath ??
      process.env.NERVE_DB_PATH ??
      `${process.cwd()}/.nerve/hub.db`;
    this.storage = new Storage(resolvedPath);
  }

  // ── Tasks ─────────────────────────────────────────────────────────

  readonly tasks = {
    create: (params: CreateTaskInput): Task => {
      const input = CreateTaskInputSchema.parse(params);
      const now = new Date().toISOString();
      const task: Task = {
        id: uuidv4(),
        projectId: input.projectId,
        parentId: input.parentId ?? null,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        priority: input.priority,
        status: TaskStatus.pending,
        assignee: input.assignee ?? null,
        progress: 0,
        result: null,
        error: null,
        dependencies: input.dependencies,
        metadata: input.metadata,
        tags: input.tags,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
      };
      this.storage.createTask(task);
      return task;
    },

    get: (id: string): Task | null => {
      return this.storage.getTask(id);
    },

    update: (id: string, updates: UpdateTaskInput, actor: string = "system"): Task | null => {
      const existing = this.storage.getTask(id);
      if (!existing) return null;

      const input = UpdateTaskInputSchema.parse(updates);

      // Log state changes
      for (const [key, newValue] of Object.entries(input)) {
        const oldValue = (existing as any)[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          this.storage.createStateLog({
            id: uuidv4(),
            taskId: id,
            field: key,
            oldValue: oldValue ?? null,
            newValue: newValue ?? null,
            actor,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Auto-set timestamps based on status changes
      const extraUpdates: Record<string, unknown> = {};
      if (input.status === TaskStatus.running && existing.status !== TaskStatus.running) {
        extraUpdates.startedAt = new Date().toISOString();
      }
      if (input.status === TaskStatus.done && existing.status !== TaskStatus.done) {
        extraUpdates.completedAt = new Date().toISOString();
        extraUpdates.progress = input.progress ?? 100;
      }
      if (input.status === TaskStatus.failed && existing.status !== TaskStatus.failed) {
        extraUpdates.completedAt = new Date().toISOString();
      }

      this.storage.updateTask(id, { ...input, ...extraUpdates });
      return this.storage.getTask(id);
    },

    query: (filter: TaskFilter = {}): Task[] => {
      return this.storage.queryTasks(filter);
    },

    delete: (id: string): boolean => {
      return this.storage.deleteTask(id);
    },
  };

  // ── Projects ──────────────────────────────────────────────────────

  readonly projects = {
    create: (name: string, description?: string, metadata?: Record<string, unknown>): Project => {
      const input = CreateProjectInputSchema.parse({ name, description, metadata });
      const now = new Date().toISOString();
      const project: Project = {
        id: uuidv4(),
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      };
      this.storage.createProject(project);
      return project;
    },

    get: (id: string): Project | null => {
      return this.storage.getProject(id);
    },

    list: (): Project[] => {
      return this.storage.listProjects();
    },

    getBoard: (projectId: string): BoardView => {
      const allTasks = this.storage.queryTasks({ projectId });
      const board: BoardView = {
        pending: [],
        running: [],
        blocked: [],
        waiting: [],
        done: [],
        failed: [],
        archived: [],
      };
      for (const task of allTasks) {
        const status = task.status as keyof BoardView;
        if (status in board) {
          board[status].push(task);
        }
      }
      return board;
    },
  };

  // ── Events ────────────────────────────────────────────────────────

  readonly events = {
    publish: (projectId: string, channel: string, type: string, source: string, payload: Record<string, unknown> = {}): Event => {
      const input = PublishEventInputSchema.parse({ projectId, channel, type, source, payload });
      const event: Event = {
        id: uuidv4(),
        projectId: input.projectId,
        channel: input.channel,
        type: input.type,
        source: input.source,
        payload: input.payload,
        timestamp: new Date().toISOString(),
      };
      this.storage.createEvent(event);
      return event;
    },

    list: (projectId: string, since?: string): Event[] => {
      return this.storage.listEvents(projectId, since);
    },
  };

  // ── Lifecycle ─────────────────────────────────────────────────────

  close(): void {
    this.storage.close();
  }
}
