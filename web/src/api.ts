const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
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

import type { Agent, AgentStatus } from './types';

export const listAgents = () => request<Agent[]>('/agents');
export const registerAgent = (input: Partial<Agent> & { id: string; name: string; type: Agent['type'] }) =>
  request<Agent>('/agents', { method: 'POST', body: JSON.stringify(input) });
export const deleteAgent = (id: string) =>
  request<{ deleted: boolean }>(`/agents/${id}`, { method: 'DELETE' });
export const updateAgentStatus = (id: string, status: AgentStatus) =>
  request<Agent>(`/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

// ─── Handoff Queue ──────────────────────────────────────────────────────────

export const getHandoffQueue = () => request<any[]>('/handoff');
export const getTaskBriefing = (taskId: string) => request<{ taskId: string; briefing: string }>(`/tasks/${taskId}/briefing`);
