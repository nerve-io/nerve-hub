const BASE = '/api';

const TOKEN_STORAGE_KEY = 'nerve_hub_token';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {
    /* private mode */
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Web UI：读写浏览器中的 MCP token，用于需要鉴权的 API（如 PATCH /agents/:id） */
export function getStoredHubToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredHubToken(token: string | null): void {
  try {
    if (token === null || token === '') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    /* ignore */
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch('/health');
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Projects ────────────────────────────────────────────────────────────────

import type {
  Project,
  ProjectContext,
  CreateProjectInput,
  UpdateProjectInput,
} from './types';

export const listProjects = () => request<Project[]>('/projects');
export const getProject = (id: string) => request<Project>(`/projects/${id}`);
export const createProject = (input: CreateProjectInput) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) });
export const updateProject = (id: string, input: UpdateProjectInput) =>
  request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const deleteProject = (id: string) =>
  request<{ deleted: boolean }>(`/projects/${id}`, { method: 'DELETE' });
export const getProjectContext = (id: string) =>
  request<ProjectContext>(`/projects/${id}/context`);
export const getProjectBlockedStatuses = (id: string) =>
  request<Record<string, boolean>>(`/projects/${id}/blocked-statuses`);

// ─── Tasks ───────────────────────────────────────────────────────────────────

import type {
  Task,
  TaskContext,
  CreateTaskInput,
  UpdateTaskInput,
} from './types';

export const listTasks = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<Task[]>(`/tasks${qs}`);
};
export const getTask = (id: string) => request<Task>(`/tasks/${id}`);
export const searchTasks = (query: string) =>
  request<Task[]>(`/tasks?search=${encodeURIComponent(query)}`);
export const createTask = (input: CreateTaskInput) =>
  request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) });
export const updateTask = (id: string, input: UpdateTaskInput) =>
  request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const deleteTask = (id: string) =>
  request<{ deleted: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
export const getTaskContext = (id: string) =>
  request<TaskContext>(`/tasks/${id}/context`);
export const getBlockedBy = (id: string) =>
  request<Task[]>(`/tasks/${id}/blocked-by`);
export const getTaskLog = (id: string) =>
  request<{ taskId: string; lines: string[]; totalLines?: number; hint?: string }>(`/tasks/${id}/log`);

// ─── Comments ────────────────────────────────────────────────────────────────

import type { Comment } from './types';

export const getComments = (taskId: string) => request<Comment[]>(`/tasks/${taskId}/comments`);
export const createComment = (taskId: string, body: string) =>
  request<Comment>(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
export const deleteComment = (id: string) => request(`/comments/${id}`, { method: 'DELETE' });

// ─── Events ──────────────────────────────────────────────────────────────────

import type { Event } from './types';

export const listEvents = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<Event[]>(`/events${qs}`);
};

// ─── Agents ──────────────────────────────────────────────────────────────────

import type { Agent, AgentStatus, PermissionLevel, VisibilityScope } from './types';

export const listAgents = () => request<Agent[]>('/agents');
export const registerAgent = (input: Partial<Agent> & { id: string; name: string; type: Agent['type'] }) =>
  request<Agent>('/agents', { method: 'POST', body: JSON.stringify(input) });
export const deleteAgent = (id: string) =>
  request<{ deleted: boolean }>(`/agents/${id}`, { method: 'DELETE' });
export const updateAgentStatus = (id: string, status: AgentStatus) =>
  request<Agent>(`/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

/** Requires Bearer token (admin) — PATCH /agents/:id */
export const patchAgentPermissions = (
  id: string,
  body: { permissionLevel?: PermissionLevel; visibilityScope?: VisibilityScope },
) =>
  request<Agent>(`/agents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

/** Issue credential (localhost / operator only — matches POST /api/agents/:id/credentials) */
export interface IssueCredentialResponse {
  kid: string;
  token: string;
  issued_at: string;
  expires_at?: string | null;
}

export const issueAgentCredential = (agentId: string) =>
  request<IssueCredentialResponse>(`/agents/${encodeURIComponent(agentId)}/credentials`, {
    method: 'POST',
  });

// ─── Handoff Queue ──────────────────────────────────────────────────────────

export const getHandoffQueue = () => request<any[]>('/handoff');
export const getTaskBriefing = (taskId: string) => request<{ taskId: string; briefing: string }>(`/tasks/${taskId}/briefing`);
