import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getTaskContext, updateTask } from '../api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineEdit } from '@/components/InlineEdit';
import { MetaRow } from '@/components/MetaRow';
import { relativeTime, absoluteTime, statusColor, priorityColor, formatAction } from '../utils';
import type { TaskContext as TaskContextType, TaskStatus } from '../types';

interface Props {
  taskId: string;
}

export function TaskDetail({ taskId }: Props) {
  const [ctx, setCtx] = useState<TaskContextType | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getTaskContext(taskId);
      setCtx(data);
    } catch (err: any) {
      toast(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (status: TaskStatus) => {
    try {
      await updateTask(taskId, { status });
      load();
    } catch (err: any) {
      toast(err.message);
    }
  };

  const handleInlineEdit = async (field: 'title' | 'description' | 'result', value: string) => {
    try {
      await updateTask(taskId, { [field]: value });
      load();
    } catch (err: any) {
      toast(err.message);
    }
  };

  if (loading) {
    return <div className="max-w-[1100px]">Loading…</div>;
  }

  if (!ctx) {
    return <div className="max-w-[1100px]">Task not found</div>;
  }

  const { task, project, blockedBy, events } = ctx;

  return (
    <div className="max-w-[1100px]">
      <div className="mb-5">
        <Link to={project ? `/projects/${project.id}` : '/'} className="text-sm text-muted-foreground hover:text-foreground no-underline">
          ← Back
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        {/* Left column */}
        <div>
          <InlineEdit
            value={task.title}
            onSave={(v) => handleInlineEdit('title', v)}
            className="text-[22px] font-semibold tracking-tight mb-3"
            tag="h1"
          />

          <InlineEdit
            value={task.description}
            onSave={(v) => handleInlineEdit('description', v)}
            className="text-sm text-muted-foreground mb-5 whitespace-pre-wrap min-h-5"
            tag="p"
            placeholder="No description"
            multiline
          />

          <div className="flex gap-2 mb-6 flex-wrap bg-card/40 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            {task.status === 'pending' && (
              <Button onClick={() => handleStatusChange('running')}>
                Claim → Running
              </Button>
            )}
            {(task.status === 'running' || task.status === 'pending') && (
              <Button variant="success" onClick={() => handleStatusChange('done')}>
                ✓ Complete
              </Button>
            )}
            {(task.status === 'running' || task.status === 'pending') && (
              <Button variant="destructive" onClick={() => handleStatusChange('failed')}>
                ✕ Mark Failed
              </Button>
            )}
            {task.status === 'blocked' && (
              <Button variant="warning" onClick={() => handleStatusChange('running')}>
                → Unblock
              </Button>
            )}
          </div>

          {(task.status === 'done' || task.status === 'failed') && (
            <div className="mb-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Result</h3>
              <InlineEdit
                value={task.result}
                onSave={(v) => handleInlineEdit('result', v)}
                className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                tag="div"
                placeholder="No result"
                multiline
              />
            </div>
          )}

          {blockedBy.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Blocked By</h3>
              <div className="flex flex-col gap-1">
                {blockedBy.map((dep) => (
                  <Link key={dep.id} to={`/tasks/${dep.id}`} className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.06] backdrop-blur-sm border border-border rounded-md text-[13px] transition-all hover:border-primary no-underline text-foreground">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: statusColor(dep.status) }}
                    />
                    <span className="flex-1 truncate">{dep.title}</span>
                    <span
                      className="text-[11px] font-medium capitalize shrink-0"
                      style={{ color: statusColor(dep.status) }}
                    >
                      {dep.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <MetaRow label="Status">
                  <span className="flex items-center gap-1.5 font-medium capitalize">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(task.status) }} />
                    <span style={{ color: statusColor(task.status) }}>{task.status}</span>
                  </span>
                </MetaRow>
                <MetaRow label="Priority">
                  <span className="flex items-center gap-1.5 font-medium capitalize">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityColor(task.priority) }} />
                    <span style={{ color: priorityColor(task.priority) }}>{task.priority}</span>
                  </span>
                </MetaRow>
                <MetaRow label="Type">{task.type}</MetaRow>
                <MetaRow label="Assignee">{task.assignee || '—'}</MetaRow>
                {project && (
                  <MetaRow label="Project">
                    <Link to={`/projects/${project.id}`} className="no-underline">{project.name}</Link>
                  </MetaRow>
                )}
                <MetaRow label="Created">{relativeTime(task.createdAt)}</MetaRow>
                <MetaRow label="Updated">{relativeTime(task.updatedAt)}</MetaRow>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                {events.length === 0 ? (
                  <div className="text-[13px] text-muted-foreground py-2">No events</div>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="grid grid-cols-[60px_12px_1fr] py-1.5 text-[12px]">
                      <div className="text-muted-foreground text-right pr-2" title={absoluteTime(event.createdAt)}>
                        {relativeTime(event.createdAt)}
                      </div>
                      <div className="w-2 h-2 rounded-full bg-border mt-1" />
                      <div className="pl-2 text-muted-foreground">
                        <span className="text-primary font-medium">[{event.actor}]</span>{' '}
                        <span>{formatAction(event.action, event.payload)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
