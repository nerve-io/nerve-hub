// ─── Types matching backend db.ts ─────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'code' | 'review' | 'test' | 'deploy' | 'research' | 'custom';

export interface Project {
  id: string;
  name: string;
  description: string;
  rules?: string;
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
  creator: string;
  reflection?: string | null;
  selftestReport?: string | null;
  knownIssues?: string | null;
  uncoveredScope?: string | null;
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
  rules?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  rules?: string;
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
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  assignee?: string;
  dependencies?: string[];
  result?: string;
  reflection?: string | null;
  selftestReport?: string | null;
  knownIssues?: string | null;
  uncoveredScope?: string | null;
}

export const ALL_STATUSES: TaskStatus[] = ['pending', 'running', 'blocked', 'done', 'failed'];
export const ALL_PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
export const ALL_TYPES: TaskType[] = ['code', 'review', 'test', 'deploy', 'research', 'custom'];

// ─── Agent ──────────────────────────────────────────────────────────────────

export type AgentType = 'webhook' | 'manual';
export type AgentStatus = 'online' | 'offline' | 'busy';

/** 与后端 agents.permission_level 一致 */
export type PermissionLevel = 'readonly' | 'task-self' | 'task-any' | 'admin';

/** 与后端 agents.visibility_scope 一致 */
export type VisibilityScope = 'own' | 'global';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  endpoint?: string;
  heartbeatInterval?: number;
  lastSeen?: string;
  status: AgentStatus;
  metadata?: string;
  capabilities?: {
    taskTypes: string[];
    languages: string[];
  };
  rules?: string;
  permissionLevel?: PermissionLevel;
  visibilityScope?: VisibilityScope;
  createdAt: string;
}
