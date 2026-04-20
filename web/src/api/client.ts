import type {
  Project,
  CreateProjectInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  Board,
  ProjectContext,
  NerveEvent,
  StateLog,
  HealthCheck,
} from '../types';

const BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Health ──────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<HealthCheck> {
  const res = await fetch('/health');
  return res.json();
}

// ─── Projects ────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  return request<Project[]>('/projects');
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getProjectBoard(projectId: string): Promise<Board> {
  return request<Board>(`/projects/${projectId}/board`);
}

export async function getProjectContext(projectId: string): Promise<ProjectContext> {
  return request<ProjectContext>(`/projects/${projectId}/context`);
}

// ─── Tasks ───────────────────────────────────────────────────────────────

export async function queryTasks(filters: {
  projectId?: string;
  status?: string;
  assignee?: string;
  type?: string;
}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.status) params.set('status', filters.status);
  if (filters.assignee) params.set('assignee', filters.assignee);
  if (filters.type) params.set('type', filters.type);
  const qs = params.toString();
  return request<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
}

export async function getTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
}

// ─── Events ──────────────────────────────────────────────────────────────

export async function listEvents(projectId: string, limit = 100): Promise<NerveEvent[]> {
  return request<NerveEvent[]>(`/projects/${projectId}/events?limit=${limit}`);
}

// ─── State Logs ──────────────────────────────────────────────────────────

export async function listStateLogs(taskId: string, limit = 100): Promise<StateLog[]> {
  return request<StateLog[]>(`/tasks/${taskId}/logs?limit=${limit}`);
}
