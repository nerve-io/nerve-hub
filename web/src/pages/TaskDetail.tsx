import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { Pencil } from 'lucide-react';
import { getTaskContext, updateTask, deleteTask, getTaskLog, createComment } from '../api';
import { toast, toastWithUndo } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineEdit } from '@/components/InlineEdit';
import { MetaRow } from '@/components/MetaRow';
import { CommentSection } from '@/components/CommentSection';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import {
  relativeTime,
  absoluteTime,
  statusColor,
  priorityColor,
  formatAction,
  taskStatusLabel,
  taskPriorityLabel,
  taskTypeLabel,
} from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { TaskContext as TaskContextType, TaskStatus } from '../types';

interface Props {
  taskId: string;
}

export function TaskDetail({ taskId }: Props) {
  const { t } = useTranslation();
  const [ctx, setCtx] = useState<TaskContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descSaving, setDescSaving] = useState(false);
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
      toastWithUndo(t('taskDetail.statusChangedToast', { status: taskStatusLabel(status) }), async () => {
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
      toast(t('taskDetail.taskDeleted'));
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
    toast(t('taskDetail.rejectToast'));
    load();
  } catch (err: any) {
    toast(err.message);
  } finally {
    setRejecting(false);
  }
};

  if (loading) {
    return <div className="w-full">{t('common.loading')}</div>;
  }

  if (!ctx) {
    return <div className="w-full">{t('taskDetail.taskNotFound')}</div>;
  }

  const { task, project, blockedBy, events } = ctx;

  const handleSaveDescription = async () => {
    if (descDraft.length > 5000) {
      toast(t('taskDetail.descriptionTooLong'));
      return;
    }
    setDescSaving(true);
    try {
      await updateTask(taskId, { description: descDraft });
      await load();
      setDescModalOpen(false);
    } catch (err: any) {
      toast(err.message);
    } finally {
      setDescSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="mb-5">
        <Link to={project ? `/projects/${project.id}` : '/'} className="text-sm text-muted-foreground hover:text-foreground no-underline cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          ← {t('common.back')}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-[minmax(0,1.75fr)_420px]">
        {/* Left column */}
        <div className="space-y-6">
          <div>
            <InlineEdit
              value={task.title}
              onSave={(v) => handleInlineEdit('title', v)}
              className="page-title mb-4"
              tag="h1"
              maxLength={200}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('taskDetail.sectionDescription')}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setDescDraft(task.description);
                    setDescModalOpen(true);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  {t('taskDetail.editDescription')}
                </Button>
              </div>
              <div className="muted-panel min-h-[8rem] p-4 text-sm leading-6 text-foreground/90">
                {task.description?.trim() ? (
                  <div className="prose dark:prose-invert max-w-none leading-7">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {task.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span className="italic text-muted-foreground">{t('taskDetail.noDescription')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="surface-card flex flex-wrap gap-2 p-4">
            {task.status === 'pending' && (
              <Button onClick={() => handleStatusChange('running')}>
                {t('taskDetail.claimRunning')}
              </Button>
            )}
            {(task.status === 'running' || task.status === 'pending') && (
              <Button variant="success" onClick={() => handleStatusChange('done')}>
                <svg className="w-4 h-4 inline mr-1 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                {t('taskDetail.complete')}
              </Button>
            )}
            {(task.status === 'running' || task.status === 'pending') && (
              <Button variant="destructive" onClick={() => handleStatusChange('failed')}>
                <svg className="w-4 h-4 inline mr-1 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                {t('taskDetail.markFailed')}
              </Button>
            )}
            {task.status === 'blocked' && (
              <Button variant="warning" onClick={() => handleStatusChange('running')}>
                → {t('taskDetail.unblock')}
              </Button>
            )}
            {task.status === 'done' && (
              <Button variant="warning" onClick={() => { setRejectReason(''); setRejectOpen(true); }}>
                {t('taskDetail.reject')}
              </Button>
            )}
            <Button variant="outline" className="ml-auto text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)}>
              <svg className="w-4 h-4 inline mr-1 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              {t('common.delete')}
            </Button>
          </div>

          {(task.status === 'done' || task.status === 'failed') && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('taskDetail.resultSection')}</h3>
              <InlineEdit
                value={task.result}
                onSave={(v) => handleInlineEdit('result', v)}
                className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                tag="div"
                placeholder={t('taskDetail.placeholderResult')}
                multiline
                maxLength={5000}
                markdown
              />
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('taskDetail.reflectionSection')}</h3>
            <InlineEdit
              value={task.reflection || ''}
              onSave={(v) => handleInlineEdit('reflection', v)}
              className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
              tag="div"
              placeholder={t('taskDetail.placeholderReflection')}
              multiline
              maxLength={5000}
              markdown
            />
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('taskDetail.acceptanceSection')}</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{t('taskDetail.selftestReport')}</h4>
                <InlineEdit
                  value={task.selftestReport || ''}
                  onSave={(v) => handleInlineEdit('selftestReport', v)}
                  className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                  tag="div"
                  placeholder={t('taskDetail.placeholderSelftest')}
                  multiline
                  maxLength={10000}
                  markdown
                />
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{t('taskDetail.knownIssues')}</h4>
                <InlineEdit
                  value={task.knownIssues || ''}
                  onSave={(v) => handleInlineEdit('knownIssues', v)}
                  className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                  tag="div"
                  placeholder={t('taskDetail.placeholderIssues')}
                  multiline
                  maxLength={5000}
                  markdown
                />
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{t('taskDetail.uncoveredScope')}</h4>
                <InlineEdit
                  value={task.uncoveredScope || ''}
                  onSave={(v) => handleInlineEdit('uncoveredScope', v)}
                  className="text-sm text-muted-foreground whitespace-pre-wrap min-h-5"
                  tag="div"
                  placeholder={t('taskDetail.placeholderScope')}
                  multiline
                  maxLength={5000}
                  markdown
                />
              </div>
            </div>
          </div>

          {blockedBy.length > 0 && (
            <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{t('taskDetail.blockedSection')}</h3>
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
                      {taskStatusLabel(dep.status)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('taskDetail.detailCard')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <MetaRow label={t('taskDetail.statusLabel')}>
                  <span className="flex items-center gap-1.5 font-medium capitalize">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(task.status) }} />
                    <span style={{ color: statusColor(task.status) }}>{taskStatusLabel(task.status)}</span>
                  </span>
                </MetaRow>
                <MetaRow label={t('taskDetail.priorityLabel')}>
                  <span className="flex items-center gap-1.5 font-medium capitalize">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityColor(task.priority) }} />
                    <span style={{ color: priorityColor(task.priority) }}>{taskPriorityLabel(task.priority)}</span>
                  </span>
                </MetaRow>
                <MetaRow label={t('taskDetail.typeLabel')}>{taskTypeLabel(task.type)}</MetaRow>
                <MetaRow label={t('taskDetail.assigneeLabel')}>{task.assignee || t('common.dash')}</MetaRow>
                {task.creator && (
                  <MetaRow label={t('taskDetail.creatorLabel')}>{task.creator}</MetaRow>
                )}
                {project && (
                  <MetaRow label={t('taskDetail.projectLabel')}>
                    <Link to={`/projects/${project.id}`} className="no-underline cursor-pointer hover:text-primary">{project.name}</Link>
                  </MetaRow>
                )}
                <MetaRow label={t('taskDetail.createdLabel')}>{relativeTime(task.createdAt)}</MetaRow>
                <MetaRow label={t('taskDetail.updatedLabel')}>{relativeTime(task.updatedAt)}</MetaRow>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('taskDetail.timelineCard')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                {events.length === 0 ? (
                  <div className="text-[13px] text-muted-foreground py-2">{t('taskDetail.noEvents')}</div>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="grid grid-cols-[76px_12px_1fr] py-2 text-sm">
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

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('taskDetail.commentsCard')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentSection taskId={taskId} comments={ctx.comments} onUpdated={load} />
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('taskDetail.executionLog')}</CardTitle>
            </CardHeader>
            <CardContent>
              {logLines === null ? (
                <p className="text-xs text-muted-foreground animate-pulse">{t('taskDetail.logLoading')}</p>
              ) : logLines.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('taskDetail.noLog')}</p>
              ) : (
                <pre className="text-[11px] leading-relaxed text-muted-foreground max-h-[400px] overflow-auto whitespace-pre-wrap font-mono bg-black/40 rounded-md p-3">
                  {logLines.slice(-100).join('\n')}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={descModalOpen}
        onOpenChange={(open) => {
          if (!open) setDescModalOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto backdrop-blur-xl bg-card/95 border-border/70">
          <DialogHeader>
            <DialogTitle>{t('taskDetail.editDescriptionModalTitle')}</DialogTitle>
            <DialogDescription>{t('taskDetail.editDescriptionHint')}</DialogDescription>
          </DialogHeader>
          <MarkdownEditor
            value={descDraft}
            onChange={setDescDraft}
            height={320}
            className="rounded-md border border-border"
          />
          <div className={`text-[11px] ${descDraft.length > 5000 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {descDraft.length}/5000
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDescModalOpen(false)}
              disabled={descSaving}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveDescription()}
              disabled={descSaving || descDraft.length > 5000}
            >
              {descSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(v) => !v && setConfirmOpen(false)}>
        <DialogContent className="sm:max-w-[400px] backdrop-blur-xl bg-card/80 border-border/50">
          <DialogHeader>
            <DialogTitle>{t('taskDetail.deleteTask')}</DialogTitle>
            <DialogDescription>
              {t('taskDetail.deleteConfirm', { title: task.title })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('common.deleting') : t('common.delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={(v) => !v && !rejecting && setRejectOpen(false)}>
        <DialogContent className="sm:max-w-[440px] backdrop-blur-xl bg-card/80 border-border/50">
          <DialogHeader>
            <DialogTitle>{t('taskDetail.rejectTitle')}</DialogTitle>
            <DialogDescription>
              {t('taskDetail.rejectHint', { title: task.title, status: taskStatusLabel('pending') })}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <textarea
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-vertical min-h-[80px] focus:outline-none focus:border-primary"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('taskDetail.rejectPlaceholder')}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={rejecting}>{t('common.cancel')}</Button>
            <Button variant="warning" onClick={handleReject} disabled={rejecting || !rejectReason.trim()}>
              {rejecting ? t('taskDetail.rejecting') : t('taskDetail.rejectConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
