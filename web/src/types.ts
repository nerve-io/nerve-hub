// ─── Types matching backend db.ts ─────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'code' | 'review' | 'test' | 'deploy' | 'research' | 'custom';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface Event {
  id: string;
  projectId: string;
  taskId: string;
  actor: string;
  action: string;
  payload: string;
  createdAt: string;
}

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

export interface CreateProjectInput {
  name: string;
  description?: string;
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
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  assignee?: string;
  dependencies?: string[];
  result?: string;
}

export const ALL_STATUSES: TaskStatus[] = ['pending', 'running', 'blocked', 'done', 'failed'];
export const ALL_PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
export const ALL_TYPES: TaskType[] = ['code', 'review', 'test', 'deploy', 'research', 'custom'];
