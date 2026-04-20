import { Storage } from "./storage.js";
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

type EventCallback = (event: Event) => void;

export class NerveCore {
  private storage: Storage;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  constructor(dbPath: string) {
    this.storage = new Storage(dbPath);
  }

  close(): void {
    this.storage.close();
  }

  // ─── Event Emitter ───────────────────────────────────────────────────────

  on(channel: string, callback: EventCallback): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);
  }

  off(channel: string, callback: EventCallback): void {
    this.listeners.get(channel)?.delete(callback);
  }

  private emit(event: Event): void {
    const cbs = this.listeners.get(event.channel);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(event);
        } catch {
          // swallow errors in event handlers
        }
      }
    }
    // Also notify wildcard listeners
    const wildcard = this.listeners.get("*");
    if (wildcard) {
      for (const cb of wildcard) {
        try {
          cb(event);
        } catch {
          // swallow errors in event handlers
        }
      }
    }
  }

  // ─── Projects ────────────────────────────────────────────────────────────

  createProject(input: CreateProjectInput): Project {
    return this.storage.createProject(input);
  }

  getProject(id: string): Project | null {
    return this.storage.getProject(id);
  }

  listProjects(): Project[] {
    return this.storage.listProjects();
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────

  createTask(input: CreateTaskInput, actor = "system"): Task {
    // Validate that the project exists
    const project = this.storage.getProject(input.projectId);
    if (!project) {
      throw new Error(`Project ${input.projectId} not found`);
    }

    // Validate dependencies exist
    if (input.dependencies && input.dependencies.length > 0) {
      for (const depId of input.dependencies) {
        const dep = this.storage.getTask(depId);
        if (!dep) {
          throw new Error(`Dependency task ${depId} not found`);
        }
      }
    }

    const task = this.storage.createTask(input);

    // Emit event
    const event = this.storage.createEvent({
      projectId: task.projectId,
      channel: "tasks",
      type: "task.created",
      source: actor,
      payload: { task },
    });
    this.emit(event);

    return task;
  }

  getTask(id: string): Task | null {
    return this.storage.getTask(id);
  }

  updateTask(id: string, input: UpdateTaskInput, actor = "system"): Task | null {
    const existing = this.storage.getTask(id);
    if (!existing) return null;

    // Track changed fields for state logs
    const changes: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && key in existing) {
        const oldVal = (existing as any)[key];
        // Deep comparison for objects
        if (JSON.stringify(oldVal) !== JSON.stringify(value)) {
          changes.push({ field: key, oldValue: oldVal, newValue: value });
        }
      }
    }

    const updated = this.storage.updateTask(id, input);
    if (!updated) return null;

    // Create state log entries
    for (const change of changes) {
      this.storage.createStateLog(
        id,
        change.field,
        change.oldValue,
        change.newValue,
        actor
      );
    }

    // Emit event
    const event = this.storage.createEvent({
      projectId: updated.projectId,
      channel: "tasks",
      type: "task.updated",
      source: actor,
      payload: { taskId: id, changes },
    });
    this.emit(event);

    return updated;
  }

  queryTasks(filters: {
    projectId?: string;
    status?: string;
    assignee?: string;
    type?: string;
  }): Task[] {
    return this.storage.queryTasks(filters);
  }

  deleteTask(id: string, actor = "system"): boolean {
    const task = this.storage.getTask(id);
    if (!task) return false;

    const result = this.storage.deleteTask(id);

    if (result) {
      const event = this.storage.createEvent({
        projectId: task.projectId,
        channel: "tasks",
        type: "task.deleted",
        source: actor,
        payload: { taskId: id },
      });
      this.emit(event);
    }

    return result;
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  createEvent(input: CreateEventInput): Event {
    const event = this.storage.createEvent(input);
    this.emit(event);
    return event;
  }

  listEvents(projectId: string, limit?: number): Event[] {
    return this.storage.listEvents(projectId, limit);
  }

  // ─── State Logs ──────────────────────────────────────────────────────────

  listStateLogs(taskId: string, limit?: number): StateLog[] {
    return this.storage.listStateLogs(taskId, limit);
  }

  // ─── Board View ──────────────────────────────────────────────────────────

  getProjectBoard(
    projectId: string
  ): Record<string, Task[]> {
    const tasks = this.storage.queryTasks({ projectId });
    const board: Record<string, Task[]> = {
      pending: [],
      running: [],
      blocked: [],
      waiting: [],
      done: [],
      failed: [],
      archived: [],
    };

    for (const task of tasks) {
      const status = task.status;
      if (status in board) {
        board[status].push(task);
      }
    }

    return board;
  }

  // ─── Project Context ─────────────────────────────────────────────────────

  getProjectContext(projectId: string): {
    project: Project | null;
    taskSummary: Record<string, number>;
    recentTasks: Task[];
  } {
    const project = this.storage.getProject(projectId);
    const tasks = this.storage.queryTasks({ projectId });

    const taskSummary: Record<string, number> = {};
    for (const task of tasks) {
      taskSummary[task.status] = (taskSummary[task.status] || 0) + 1;
    }

    return {
      project,
      taskSummary,
      recentTasks: tasks.slice(0, 20),
    };
  }
}
