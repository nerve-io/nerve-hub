import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTaskContext, updateTask, deleteTask, getTaskLog, createComment } from '../api';
import { toast, toastWithUndo } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineEdit } from '@/components/InlineEdit';
import { MetaRow } from '@/components/MetaRow';
import { CommentSection } from '@/components/CommentSection';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { relativeTime, absoluteTime, statusColor, priorityColor, formatAction } from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { TaskContext as TaskContextType, TaskStatus } from '../types';

interface Props {
  taskId: string;
}

export function TaskDetail({ taskId }: Props) {
  const [ctx, setCtx] = useState<TaskContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const navigate = useNavigate();

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

  const [logLines, setLogLines] = useState<string[] | null>(null);

  const loadLog = useCallback(async () => {
    try {
      const data = await getTaskLog(taskId);
      setLogLines(data.lines);
    } catch {
      setLogLines([]);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadLog();
    const timer = setInterval(loadLog, 10_000); // poll every 10s while viewing
    return () => clearInterval(timer);
  }, [loadLog]);

  useRealtimeSync(ctx?.task?.projectId ?? null, load);

  const handleStatusChange = async (status: TaskStatus) => {
    const previousStatus = ctx?.task?.status;
    if (!previousStatus || previousStatus === status) return;

    try {
      await updateTask(taskId, { status });
      load();
      toastWithUndo(`已变更为 ${status}`, async () => {
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

  const handleInlineEdit = async (field: 'title' | 'description' | 'result' | 'reflection' | 'selftestReport' | 'knownIssues' | 'uncoveredScope', value: string) => {
    try {
      await updateTask(taskId, { [field]: value });
      load();
    } catch (err: any) {
      toast(err.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTask(taskId);
      toast('Task deleted');
      navigate(project ? `/projects/${project.id}` : '/');
    } catch (err: any) {
      toast(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleReject = async () => {
  if (!rejectReason.trim()) return;
  setRejecting(true);
  try {
    await createComment(taskId, `[驳回] ${rejectReason.trim()}`);
    await updateTask(taskId, { status: 'pending' });
    setRejectOpen(false);
    setRejectReason('');
    toast('已驳回，任务状态回退至 pending');
    load();
  } catch (err: any) {
    toast(err.message);
  } finally {
    setRejecting(false);
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
        <Link to={project ? `/projects/${project.id}` : '/'} className="text-sm text-muted-foreground hover:text-foreground no-underline cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          ← Back
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-6">
          <div>
            <InlineEdit
              value={task.title}
              onSave={(v) => handleInlineEdit('title', v)}
              className="text-[22px] font-semibold tracking-tight mb-3"
              tag="h1"
              maxLength={200}
            />

            <InlineEdit
              value={task.description}
              onSave={(v) => handleInlineEdit('description', v)}
              className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
              tag="p"
              placeholder="No description"
              multiline
              maxLength={5000}
              markdown
            />
          </div>

          <div className="flex gap-2 flex-wrap bg-card/40 backdrop-blur-sm rounded-xl p-4 border border-border/50">
            {task.status === 'pending' && (
              <Button onClick={() => handleStatusChange('running')}>
                Claim → Running
              </Button>
            )}
            {(task.status === 'running' || task.status === 'pending') && (
              <Button variant="success" onClick={() => handleStatusChange('done')}>
                <svg className="w-4 h-4 inline mr-1 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Complete
              </Button>
            )}
            {(task.status === 'running' || task.status === 'pending') && (
              <Button variant="destructive" onClick={() => handleStatusChange('failed')}>
                <svg className="w-4 h-4 inline mr-1 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>Mark Failed
              </Button>
            )}
            {task.status === 'blocked' && (
              <Button variant="warning" onClick={() => handleStatusChange('running')}>
                → Unblock
              </Button>
            )}
            {task.status === 'done' && (
              <Button variant="warning" onClick={() => { setRejectReason(''); setRejectOpen(true); }}>
                Reject
              </Button>
            )}
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <svg className="w-4 h-4 inline mr-1 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>Delete
            </Button>
          </div>

          {(task.status === 'done' || task.status === 'failed') && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Result</h3>
              <InlineEdit
                value={task.result}
                onSave={(v) => handleInlineEdit('result', v)}
                className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                tag="div"
                placeholder="No result"
                multiline
                maxLength={5000}
                markdown
              />
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Reflection</h3>
            <InlineEdit
              value={task.reflection || ''}
              onSave={(v) => handleInlineEdit('reflection', v)}
              className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
              tag="div"
              placeholder="暂无反思"
              multiline
              maxLength={5000}
              markdown
            />
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">验收材料</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">自测报告</h4>
                <InlineEdit
                  value={task.selftestReport || ''}
                  onSave={(v) => handleInlineEdit('selftestReport', v)}
                  className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                  tag="div"
                  placeholder="暂无自测报告"
                  multiline
                  maxLength={10000}
                  markdown
                />
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">已知问题</h4>
                <InlineEdit
                  value={task.knownIssues || ''}
                  onSave={(v) => handleInlineEdit('knownIssues', v)}
                  className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                  tag="div"
                  placeholder="暂无已知问题"
                  multiline
                  maxLength={5000}
                  markdown
                />
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">未覆盖范围</h4>
                <InlineEdit
                  value={task.uncoveredScope || ''}
                  onSave={(v) => handleInlineEdit('uncoveredScope', v)}
                  className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                  tag="div"
                  placeholder="暂无未覆盖范围说明"
                  multiline
                  maxLength={5000}
                  markdown
                />
              </div>
            </div>
          </div>

          {blockedBy.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Blocked By</h3>
              <div className="flex flex-col gap-1">
                {blockedBy.map((dep) => (
                  <Link key={dep.id} to={`/tasks/${dep.id}`} className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.06] backdrop-blur-sm border border-border rounded-md text-[13px] transition-all duration-200 hover:border-primary no-underline text-foreground cursor-pointer focus-visible:ring-2 focus-visible:ring-ring">
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
        <div className="space-y-4">
          <Card>
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
                {task.creator && (
                  <MetaRow label="创建方">{task.creator}</MetaRow>
                )}
                {project && (
                  <MetaRow label="Project">
                    <Link to={`/projects/${project.id}`} className="no-underline cursor-pointer hover:text-primary">{project.name}</Link>
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentSection taskId={taskId} comments={ctx.comments} onUpdated={load} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">执行日志</CardTitle>
            </CardHeader>
            <CardContent>
              {logLines === null ? (
                <p className="text-xs text-muted-foreground animate-pulse">加载中...</p>
              ) : logLines.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无日志</p>
              ) : (
                <pre className="text-[11px] leading-relaxed text-muted-foreground max-h-[400px] overflow-auto whitespace-pre-wrap font-mono bg-black/40 rounded-md p-3">
                  {logLines.slice(-100).join('\n')}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(v) => !v && setConfirmOpen(false)}>
        <DialogContent className="sm:max-w-[400px] backdrop-blur-xl bg-card/80 border-border/50">
          <DialogHeader>
            <DialogTitle>删除任务</DialogTitle>
            <DialogDescription>
              确定要删除任务「{task.title}」吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '删除中...' : '删除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={(v) => !v && !rejecting && setRejectOpen(false)}>
        <DialogContent className="sm:max-w-[440px] backdrop-blur-xl bg-card/80 border-border/50">
          <DialogHeader>
            <DialogTitle>驳回任务</DialogTitle>
            <DialogDescription>
              将任务「{task.title}」驳回至 pending 状态。请填写驳回原因（必填）。
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <textarea
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-vertical min-h-[80px] focus:outline-none focus:border-primary"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="驳回原因（必填）"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={rejecting}>取消</Button>
            <Button variant="warning" onClick={handleReject} disabled={rejecting || !rejectReason.trim()}>
              {rejecting ? '驳回中...' : '确认驳回'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
