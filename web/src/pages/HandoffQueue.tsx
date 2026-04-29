import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getHandoffQueue, getTaskBriefing } from '../api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { taskPriorityLabel, taskStatusLabel } from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-yellow-400',
  running: 'text-blue-400',
  blocked: 'text-red-400',
  failed: 'text-red-500',
  done: 'text-green-400',
};

export function HandoffQueue() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<any[]>([]);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    try { return localStorage.getItem('notifyHandoff') === 'true'; } catch { return false; }
  });

  const load = useCallback(async () => {
    try {
      const data = await getHandoffQueue();
      setTasks(data);
    } catch (err: any) {
      toast(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(null, load);

  const handleEnableNotify = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem('notifyHandoff', 'true');
        setNotifyEnabled(true);
        toast(t('handoff.notificationsEnabled'));
      }
    } catch {
      toast(t('handoff.notificationUnsupported'));
    }
  };

  const handleCopyBriefing = async (taskId: string) => {
    setCopyingId(taskId);
    try {
      const { briefing } = await getTaskBriefing(taskId);
      await navigator.clipboard.writeText(briefing);
      toast(t('handoff.briefingCopied'));
    } catch (err: any) {
      toast(err.message);
    } finally {
      setTimeout(() => setCopyingId(null), 1500);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('page.handoff')}</h1>
        </div>
        {!notifyEnabled && (
          <Button onClick={handleEnableNotify} variant="outline" size="sm">
            🔔 {t('handoff.enableNotifications')}
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
          <svg className="w-12 h-12 mb-4 opacity-20 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div className="text-base font-medium mb-1">{t('handoff.queueEmpty')}</div>
          <div className="text-sm opacity-70">{t('handoff.queueEmptyHint')}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="surface-card p-4 transition-colors hover:bg-card/70"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <Link to={`/tasks/${task.id}`} className="min-w-0 flex-1 no-underline text-inherit">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
                      {taskPriorityLabel(task.priority)}
                    </span>
                    <span className={`text-xs ${STATUS_STYLES[task.status] || 'text-muted-foreground'}`}>
                      {taskStatusLabel(task.status)}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-base font-semibold leading-6">{task.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {task.assignee && <span>{t('handoff.assigneePrefix', { name: task.assignee })}</span>}
                    {task.projectId && <span>{t('handoff.projectPrefix', { id: task.projectId })}</span>}
                  </div>
                  {task.description && (
                    <ExpandableText text={task.description} maxLen={100} />
                  )}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 self-start px-3 text-sm"
                  onClick={(e) => { e.preventDefault(); handleCopyBriefing(task.id); }}
                  disabled={copyingId === task.id}
                >
                  {copyingId === task.id ? t('common.copied') : t('common.copyBriefing')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandableText({ text, maxLen }: { text: string; maxLen: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (text.length <= maxLen) {
    return <p className="mt-3 max-w-5xl text-sm leading-6 text-muted-foreground">{text}</p>;
  }
  return (
    <div className="mt-3 max-w-5xl text-sm leading-6 text-muted-foreground">
      {expanded ? text : `${text.slice(0, maxLen)}...`}
      <button
        type="button"
        className="ml-1 text-primary hover:underline cursor-pointer"
        onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}
      >
        {expanded ? t('common.collapse') : t('common.expand')}
      </button>
    </div>
  );
}
