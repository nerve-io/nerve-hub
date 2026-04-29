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
import { statusColor, priorityColor, typeColor, taskStatusLabel, taskPriorityLabel, taskTypeLabel } from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useTranslation } from 'react-i18next';
import type { Task, TaskStatus, TaskPriority, TaskType } from '../types';

const STATUSES: TaskStatus[] = ['pending', 'running', 'blocked', 'done', 'failed'];
const PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
const TYPES: TaskType[] = ['code', 'review', 'test', 'deploy', 'research', 'custom'];

interface Props {
  projectId: string;
}

export function Kanban({ projectId }: Props) {
  const { t } = useTranslation();
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
      toastWithUndo(
        t('kanban.movedToStatus', { status: taskStatusLabel(status) }),
        async () => {
          try {
            await updateTask(taskId, { status: previousStatus });
            load();
          } catch (err: any) {
            toast(err.message);
          }
        },
      );
    } catch (err: any) {
      toast(err.message);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterAssignee && !(t.assignee || '').toLowerCase().includes(filterAssignee.toLowerCase())) return false;
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
    <div className="flex h-[calc(100vh-6rem)] min-h-[620px] flex-col">
      <div className="mb-5 shrink-0">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block no-underline">← {t('common.back')}</Link>
        <div className="page-header">
          <div>
            <h1 className="page-title">{project?.name || t('page.loading')}</h1>
            {project?.description && (
              <p className="page-description">{project.description}</p>
            )}
          </div>
          {hasFilter && (
            <span className="rounded-full border border-border/70 bg-background/50 px-3 py-1 text-sm text-muted-foreground">
              {t('kanban.taskCount', { filtered: filteredTasks.length, total: tasks.length, unit: t('common.tasksUnit') })}
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="surface-card mb-4 flex shrink-0 flex-wrap items-center gap-3 p-3">
        <div className="relative">
          <Input
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            placeholder={t('kanban.filterAssignee')}
            className="h-9 w-[220px] text-sm"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as TaskType | 'all')}>
          <SelectTrigger className="h-9 w-[150px] text-sm">
            <SelectValue placeholder={t('kanban.allTypes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('kanban.allTypes')}</SelectItem>
            {TYPES.map((typ) => (
              <SelectItem key={typ} value={typ} color={typeColor(typ)}>{taskTypeLabel(typ)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as TaskPriority | 'all')}>
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder={t('kanban.allPriorities')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('kanban.allPriorities')}</SelectItem>
            {PRIORITIES.map((pr) => (
              <SelectItem key={pr} value={pr} color={priorityColor(pr)}>{taskPriorityLabel(pr)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => { setFilterAssignee(''); setFilterType('all'); setFilterPriority('all'); }}
          >
            ✕ {t('kanban.clearFilters')}
          </Button>
        )}
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-3">
        {columns.map((col) => (
          <div
            key={col.status}
            className={`surface-card flex min-w-[280px] flex-[1_1_0] flex-col transition-colors xl:min-w-[300px] ${
              dragOverCol === col.status ? 'border-primary/60 shadow-[0_0_15px_hsl(var(--glow-primary)/0.2)]' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(col.status)}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold capitalize text-foreground">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: statusColor(col.status) }}
                />
                {taskStatusLabel(col.status)}
                <Badge variant="secondary" className="ml-1 bg-background/70 text-xs font-medium">
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
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
              {col.tasks.length === 0 ? (
                <div className="muted-panel flex min-h-[120px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  {hasFilter ? t('kanban.noFilteredTasks') : t('kanban.emptyColumn')}
                </div>
              ) : col.tasks.map((task) => {
                const blocked = blockedByMap[task.id] === true;
                const assigneeStr = task.assignee?.trim() ?? '';
                const creatorStr = task.creator?.trim() ?? '';
                const primaryAgent = assigneeStr || creatorStr;
                return (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className={`block rounded-lg border border-border/70 bg-background/55 p-3 no-underline text-inherit backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-[0_2px_12px_hsl(var(--glow-primary)/0.15)] active:cursor-grabbing ${
                      blocked ? 'border-l-[3px] border-l-destructive' : ''
                    }`}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{taskPriorityLabel(task.priority)}</span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: statusColor(task.status) }}
                        title={task.status}
                      />
                    </div>
                    <div className="mb-3 line-clamp-3 text-sm font-medium leading-5">
                      {task.title}
                    </div>
                    <div className="flex items-center justify-between gap-2 min-h-[22px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ background: priorityColor(task.priority) }}
                          title={task.priority}
                        />
                        <Badge variant="secondary" className="text-[11px] bg-white/[0.06] truncate max-w-[min(100%,11rem)]">
                          {taskTypeLabel(task.type)}
                        </Badge>
                      </div>
                      {primaryAgent && (
                        <div className="flex items-center gap-1.5 shrink-0 max-w-[55%]">
                          <span
                            className="text-[11px] text-muted-foreground truncate text-right"
                            title={assigneeStr ? t('kanban.assigneeLabel', { name: assigneeStr }) : t('kanban.creatorLabel', { name: creatorStr })}
                          >
                            {assigneeStr ? (
                              <>
                                <span className="text-muted-foreground">{t('kanban.assigneePrefix')}：</span>
                                <span className="text-foreground/90">{assigneeStr}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-muted-foreground">{t('kanban.creatorPrefix')}：</span>
                                <span className="text-foreground/90">{creatorStr}</span>
                              </>
                            )}
                          </span>
                          <span
                            className="w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center shrink-0"
                            title={primaryAgent}
                          >
                            {primaryAgent.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AppDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('kanban.newTaskTitle')}>
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-title">{t('kanban.taskTitle')}</Label>
              <span className={`text-[11px] ${formTitle.length > 200 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formTitle.length}/200
              </span>
            </div>
            <Input
              id="task-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={t('kanban.taskTitlePlaceholder')}
              maxLength={200}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-desc">{t('kanban.description')}</Label>
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
              <Label>{t('kanban.priority')}</Label>
              <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((pr) => (
                    <SelectItem key={pr} value={pr} color={priorityColor(pr)}>{taskPriorityLabel(pr)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>{t('kanban.type')}</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((typ) => (
                    <SelectItem key={typ} value={typ} color={typeColor(typ)}>{taskTypeLabel(typ)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('kanban.assignee')}</Label>
            <Select value={formAssignee} onValueChange={setFormAssignee}>
              <SelectTrigger>
                <SelectValue placeholder={t('kanban.selectAgent')} />
              </SelectTrigger>
              <SelectContent>
                {loadingAgents ? (
                  <SelectItem value="" disabled>{t('kanban.loadingAgents')}</SelectItem>
                ) : agents.length === 0 ? (
                  <SelectItem value="" disabled>{t('kanban.noAgentsAvailable')}</SelectItem>
                ) : (
                  agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('kanban.dependsOn')}</Label>
            <Select value={formDep} onValueChange={setFormDep}>
              <SelectTrigger>
                <SelectValue placeholder={t('common.none')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('common.none')}</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateTask} disabled={!formTitle.trim()}>
              {t('common.create')}
            </Button>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
