import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getProjectContext, getProjectBlockedStatuses, createTask, updateTask, listAgents } from '../api';
import { AppDialog } from '@/components/ui/AppDialog';
import { toast, toastWithUndo } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { statusColor, priorityColor, typeColor } from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import type { Task, TaskStatus, TaskPriority, TaskType } from '../types';

const STATUSES: TaskStatus[] = ['pending', 'running', 'blocked', 'done', 'failed'];
const PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
const TYPES: TaskType[] = ['code', 'review', 'test', 'deploy', 'research', 'custom'];

interface Props {
  projectId: string;
}

export function Kanban({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blockedByMap, setBlockedByMap] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragTaskIdRef = useRef<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formType, setFormType] = useState<TaskType>('custom');
  const [formAssignee, setFormAssignee] = useState('');
  const [formDep, setFormDep] = useState('');

  // Agent state
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Filter state
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterType, setFilterType] = useState<TaskType | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const [ctx, blockedStatuses] = await Promise.all([
        getProjectContext(projectId),
        getProjectBlockedStatuses(projectId).catch(() => ({})),
      ]);
      setProject(ctx.project);
      setTasks(ctx.tasks);
      setBlockedByMap(blockedStatuses);
    } catch (err: any) {
      toast(err.message);
    }
  }, [projectId]);

  // Load agents
  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const agentList = await listAgents();
      setAgents(agentList);
    } catch (err: any) {
      toast(err.message);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadAgents();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load, loadAgents]);

  useRealtimeSync(projectId, load);

  useKeyboardShortcut('n', () => {
    resetForm();
    setModalOpen(true);
  });

  const handleCreateTask = async () => {
    if (!formTitle.trim()) return;
    try {
      await createTask({
        title: formTitle.trim(),
        projectId,
        description: formDesc.trim(),
        priority: formPriority,
        type: formType,
        assignee: formAssignee.trim(),
        dependencies: formDep ? [formDep] : [],
      });
      setModalOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      toast(err.message);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormPriority('medium');
    setFormType('custom');
    setFormAssignee('');
    setFormDep('');
  };

  // Drag & Drop
  const handleDragStart = (taskId: string) => {
    dragTaskIdRef.current = taskId;
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverCol(status);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (status: string) => {
    setDragOverCol(null);
    const taskId = dragTaskIdRef.current;
    if (!taskId) return;
    dragTaskIdRef.current = null;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const previousStatus = task.status;

    if (previousStatus === status) return;

    try {
      await updateTask(taskId, { status: status as TaskStatus });
      load();
      toastWithUndo(`已移至 ${status}`, async () => {
        try {
          await updateTask(taskId, { status: previousStatus });
          load();
        } catch (err: any) {
          toast(err.message);
        }
      });
    } catch (err: any) {
      toast(err.message);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterAssignee && !t.assignee.toLowerCase().includes(filterAssignee.toLowerCase())) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const hasFilter = filterAssignee !== '' || filterType !== 'all' || filterPriority !== 'all';

  const columns = STATUSES.map((status) => ({
    status,
    tasks: filteredTasks.filter((t) => t.status === status),
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="mb-5 shrink-0">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block no-underline">← Back</Link>
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight">{project?.name || 'Loading…'}</h1>
          {project?.description && (
            <span className="text-sm text-muted-foreground">{project.description}</span>
          )}
          {hasFilter && (
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredTasks.length} / {tasks.length} tasks
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
        <div className="relative">
          <Input
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            placeholder="Filter by assignee"
            className="h-8 w-[180px] text-[13px]"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as TaskType | 'all')}>
          <SelectTrigger className="h-8 w-[130px] text-[13px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t} color={typeColor(t)}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as TaskPriority | 'all')}>
          <SelectTrigger className="h-8 w-[140px] text-[13px]">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} color={priorityColor(p)}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setFilterAssignee(''); setFilterType('all'); setFilterPriority('all'); }}
          >
            ✕ 清除
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-1 overflow-x-auto overflow-y-hidden pb-2">
        {columns.map((col) => (
          <div
            key={col.status}
            className={`flex-1 min-w-[220px] bg-card/40 backdrop-blur-sm border border-border rounded-lg flex flex-col transition-colors ${
              dragOverCol === col.status ? 'border-primary/60 shadow-[0_0_15px_hsl(var(--glow-primary)/0.2)]' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(col.status)}
          >
            <div className="flex items-center justify-between px-3 py-3 pb-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold capitalize text-muted-foreground">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: statusColor(col.status) }}
                />
                {col.status}
                <Badge variant="secondary" className="ml-1 text-[11px] font-medium bg-white/[0.08]">
                  {col.tasks.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  resetForm();
                  setModalOpen(true);
                }}
              >
                +
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1.5">
              {col.tasks.map((task) => {
                const blocked = blockedByMap[task.id] === true;
                return (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className={`block backdrop-blur-sm bg-card/50 border border-border rounded-md p-2.5 px-3 cursor-grab transition-all hover:border-white/20 hover:shadow-[0_2px_10px_hsl(0_0%_0%/0.3)] active:cursor-grabbing no-underline text-inherit ${
                      blocked ? 'border-l-[3px] border-l-destructive' : ''
                    }`}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                  >
                    <div className="flex justify-end mb-1">
                      <span
                        className="w-2 h-2 rounded-sm"
                        style={{ background: priorityColor(task.priority) }}
                        title={task.priority}
                      />
                    </div>
                    <div className="text-[13px] font-medium leading-snug line-clamp-2 mb-2">
                      {task.title}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[11px] bg-white/[0.06]">
                        {task.type}
                      </Badge>
                      {task.assignee && (
                        <span
                          className="w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center"
                          title={task.assignee}
                        >
                          {task.assignee.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {task.creator && (
                      <span className="text-[11px] text-muted-foreground mt-1 inline-block">
                        派单：{task.creator}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AppDialog open={modalOpen} onClose={() => setModalOpen(false)} title="New Task">
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-title">Title</Label>
              <span className={`text-[11px] ${formTitle.length > 200 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formTitle.length}/200
              </span>
            </div>
            <Input
              id="task-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Task title"
              maxLength={200}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-desc">Description</Label>
              <span className={`text-[11px] ${formDesc.length > 5000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formDesc.length}/5000
              </span>
            </div>
            <MarkdownEditor
              value={formDesc}
              onChange={(v) => setFormDesc(v)}
              height={150}
              className="rounded border border-border"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label>Priority</Label>
              <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} color={priorityColor(p)}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t} color={typeColor(t)}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={formAssignee} onValueChange={setFormAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {loadingAgents ? (
                  <SelectItem value="" disabled>Loading agents...</SelectItem>
                ) : agents.length === 0 ? (
                  <SelectItem value="" disabled>暂无可用 Agent</SelectItem>
                ) : (
                  agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Depends on</Label>
            <Select value={formDep} onValueChange={setFormDep}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!formTitle.trim()}>
              Create
            </Button>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
