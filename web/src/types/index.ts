// ─── Nerve Hub API Types ─────────────────────────────────────────────────

export type TaskType = 'code' | 'review' | 'test' | 'deploy' | 'research' | 'custom';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'running' | 'blocked' | 'waiting' | 'done' | 'failed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  type?: string;
  path?: string;
  content?: unknown;
  summary?: string;
}

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignee: string;
  progress: number;
  result: TaskResult | null;
  error: string;
  dependencies: string[];
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateTaskInput {
  projectId: string;
  parentId?: string;
  title: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  assignee?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignee?: string;
  progress?: number;
  result?: TaskResult | null;
  error?: string | null;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface NerveEvent {
  id: string;
  projectId: string;
  channel: string;
  type: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface StateLog {
  id: string;
  taskId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  actor: string;
  timestamp: string;
}

export interface Board {
  project: Project;
  board: Record<TaskStatus, Task[]>;
}

export interface ProjectContext {
  project: Project;
  taskSummary: Record<string, number>;
  recentTasks: Task[];
}

export interface HealthCheck {
  status: string;
  service: string;
  version: string;
}
