import { z } from "zod";

// ── Enums as const objects ──────────────────────────────────────────

export const TaskType = {
  code: "code",
  review: "review",
  test: "test",
  deploy: "deploy",
  research: "research",
  custom: "custom",
} as const;

export const Priority = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
} as const;

export const TaskStatus = {
  pending: "pending",
  running: "running",
  blocked: "blocked",
  waiting: "waiting",
  done: "done",
  failed: "failed",
  archived: "archived",
} as const;

// ── Zod Schemas ─────────────────────────────────────────────────────

export const TaskResultSchema = z.object({
  type: z.enum(["file", "url", "text", "artifact"]),
  path: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentId: z.string().nullable().default(null),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  type: z.nativeEnum(TaskType).default("custom"),
  priority: z.nativeEnum(Priority).default("medium"),
  status: z.nativeEnum(TaskStatus).default("pending"),
  assignee: z.string().nullable().default(null),
  progress: z.number().min(0).max(100).default(0),
  result: TaskResultSchema.nullable().default(null),
  error: z.string().nullable().default(null),
  dependencies: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
});

export const EventSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  channel: z.string(),
  type: z.string(),
  source: z.string(),
  payload: z.record(z.unknown()).default({}),
  timestamp: z.string(),
});

export const StateLogSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  field: z.string(),
  oldValue: z.unknown().nullable().default(null),
  newValue: z.unknown().nullable().default(null),
  actor: z.string(),
  timestamp: z.string(),
});

// ── Input schemas (for API / MCP validation) ────────────────────────

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const CreateTaskInputSchema = z.object({
  projectId: z.string(),
  parentId: z.string().nullable().optional().default(null),
  title: z.string().min(1),
  description: z.string().nullable().optional().default(null),
  type: z.nativeEnum(TaskType).optional().default("custom"),
  priority: z.nativeEnum(Priority).optional().default("medium"),
  assignee: z.string().nullable().optional().default(null),
  dependencies: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
});

export const UpdateTaskInputSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assignee: z.string().nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
  result: TaskResultSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  dependencies: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional(),
});

export const PublishEventInputSchema = z.object({
  projectId: z.string(),
  channel: z.string(),
  type: z.string(),
  source: z.string(),
  payload: z.record(z.unknown()).optional().default({}),
});

// ── Inferred Types ──────────────────────────────────────────────────

export type TaskTypeValues = (typeof TaskType)[keyof typeof TaskType];
export type PriorityValues = (typeof Priority)[keyof typeof Priority];
export type TaskStatusValues = (typeof TaskStatus)[keyof typeof TaskStatus];

export type TaskResult = z.infer<typeof TaskResultSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Event = z.infer<typeof EventSchema>;
export type StateLog = z.infer<typeof StateLogSchema>;

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
export type PublishEventInput = z.infer<typeof PublishEventInputSchema>;

export interface TaskFilter {
  projectId?: string;
  status?: string;
  assignee?: string;
  type?: string;
}
