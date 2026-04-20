import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const TaskType = z.enum([
  "code",
  "review",
  "test",
  "deploy",
  "research",
  "custom",
]);
export type TaskType = z.infer<typeof TaskType>;

export const TaskPriority = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const TaskStatus = z.enum([
  "pending",
  "running",
  "blocked",
  "waiting",
  "done",
  "failed",
  "archived",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

// ─── Project ────────────────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

// ─── Task ───────────────────────────────────────────────────────────────────

export const TaskResultSchema = z.object({
  type: z.string().optional(),
  path: z.string().optional(),
  content: z.unknown().optional(),
  summary: z.string().optional(),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  type: TaskType.default("custom"),
  priority: TaskPriority.default("medium"),
  status: TaskStatus.default("pending"),
  assignee: z.string().optional().default(""),
  progress: z.number().int().min(0).max(100).optional().default(0),
  result: TaskResultSchema.nullable().optional(),
  error: z.string().optional().default(""),
  dependencies: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInput = z.object({
  projectId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  type: TaskType.optional().default("custom"),
  priority: TaskPriority.optional().default("medium"),
  assignee: z.string().optional().default(""),
  dependencies: z.array(z.string().uuid()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: TaskType.optional(),
  priority: TaskPriority.optional(),
  status: TaskStatus.optional(),
  assignee: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  result: TaskResultSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

// ─── Event ──────────────────────────────────────────────────────────────────

export const EventSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  channel: z.string(),
  type: z.string(),
  source: z.string(),
  payload: z.record(z.unknown()).default({}),
  timestamp: z.string().datetime(),
});
export type Event = z.infer<typeof EventSchema>;

export const CreateEventInput = z.object({
  projectId: z.string().uuid(),
  channel: z.string().min(1),
  type: z.string().min(1),
  source: z.string().min(1),
  payload: z.record(z.unknown()).optional().default({}),
});
export type CreateEventInput = z.infer<typeof CreateEventInput>;

// ─── StateLog ───────────────────────────────────────────────────────────────

export const StateLogSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  field: z.string(),
  oldValue: z.unknown().nullable().optional(),
  newValue: z.unknown().nullable().optional(),
  actor: z.string(),
  timestamp: z.string().datetime(),
});
export type StateLog = z.infer<typeof StateLogSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString();
}

export function generateId(): string {
  return crypto.randomUUID();
}
