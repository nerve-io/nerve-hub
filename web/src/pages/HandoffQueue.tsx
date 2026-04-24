import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getHandoffQueue, getTaskBriefing } from '../api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
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
        toast('Notifications enabled');
      }
    } catch {
      toast('Notification not supported');
    }
  };

  const handleCopyBriefing = async (taskId: string) => {
    setCopyingId(taskId);
    try {
      const { briefing } = await getTaskBriefing(taskId);
      await navigator.clipboard.writeText(briefing);
      toast('Briefing copied to clipboard');
    } catch (err: any) {
      toast(err.message);
    } finally {
      setTimeout(() => setCopyingId(null), 1500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Handoff Queue</h1>
        {!notifyEnabled && (
          <Button onClick={handleEnableNotify} variant="outline" size="sm">
            🔔 Enable Notifications
          </Button>
        )}
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
          <svg className="w-12 h-12 mb-4 opacity-20 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div className="text-base font-medium mb-1">Queue is empty</div>
          <div className="text-sm opacity-70">All Manual Agent tasks have been completed 🎉</div>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <Link to={`/tasks/${task.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
                      {task.priority}
                    </span>
                    <span className={`text-xs ${STATUS_STYLES[task.status] || 'text-muted-foreground'}`}>
                      {task.status}
                    </span>
                  </div>
                  <h3 className="font-medium text-sm truncate">{task.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {task.assignee && <span>👤 {task.assignee}</span>}
                    {task.projectId && <span>📁 {task.projectId}</span>}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {task.description.length > 100 ? task.description.slice(0, 100) + '...' : task.description}
                    </p>
                  )}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-8 px-3 text-xs cursor-pointer"
                  onClick={(e) => { e.preventDefault(); handleCopyBriefing(task.id); }}
                  disabled={copyingId === task.id}
                >
                  {copyingId === task.id ? '✅ Copied' : '📋 Copy Briefing'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
