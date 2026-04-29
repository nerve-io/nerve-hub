import i18n from './i18n';

export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return i18n.t('time.justNow');
  if (minutes < 60) return i18n.t('time.minutesAgo', { count: minutes });
  if (hours < 24) return i18n.t('time.hoursAgo', { count: hours });
  if (days < 30) return i18n.t('time.daysAgo', { count: days });
  return new Date(dateStr).toLocaleDateString();
}

export function absoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'hsl(var(--status-pending))',
    running: 'hsl(var(--status-running))',
    blocked: 'hsl(var(--status-blocked))',
    done: 'hsl(var(--status-done))',
    failed: 'hsl(var(--status-failed))',
  };
  return map[status] || 'hsl(var(--muted-foreground))';
}

/** Kanban / compact UI：任务状态短标签（随当前语言） */
export function taskStatusLabel(status: string): string {
  return i18n.t(`taskStatus.${status}`, { defaultValue: status });
}

/** 基于 API `lastSeen`（心跳时间）：≤60s 视为在线侧新鲜心跳 */
export function isHeartbeatFresh(lastSeen: string | undefined, windowMs = 60_000): boolean | null {
  const s = lastSeen?.trim();
  if (!s) return null;
  const ts = new Date(s).getTime();
  if (Number.isNaN(ts)) return null;
  return Date.now() - ts <= windowMs;
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    critical: 'hsl(var(--priority-critical))',
    high: 'hsl(var(--priority-high))',
    medium: 'hsl(var(--priority-medium))',
    low: 'hsl(var(--priority-low))',
  };
  return map[priority] || 'hsl(var(--muted-foreground))';
}

export function typeColor(type: string): string {
  const map: Record<string, string> = {
    code: 'hsl(217, 91%, 60%)',
    review: 'hsl(270, 80%, 60%)',
    test: 'hsl(153, 59%, 53%)',
    deploy: 'hsl(37, 91%, 55%)',
    research: 'hsl(180, 80%, 60%)',
    custom: 'hsl(var(--muted-foreground))',
  };
  return map[type] || 'hsl(var(--muted-foreground))';
}

export function taskPriorityLabel(priority: string): string {
  return i18n.t(`taskPriority.${priority}`, { defaultValue: priority });
}

export function taskTypeLabel(type: string): string {
  return i18n.t(`taskType.${type}`, { defaultValue: type });
}

export function agentStatusLabel(status: string): string {
  return i18n.t(`agentStatus.${status}`, { defaultValue: status });
}

export function agentTypeLabel(type: string): string {
  return i18n.t(`agentType.${type}`, { defaultValue: type });
}

export function formatAction(action: string, payload: string): string {
  const deletedTitle = () => i18n.t('events.deletedTask');
  try {
    const p = JSON.parse(payload);

    switch (action) {
      case 'task.created':
        return i18n.t('events.taskCreated', { title: p.title || deletedTitle() });
      case 'task.claimed':
        return i18n.t('events.taskClaimed', { title: p.title || deletedTitle() });
      case 'task.completed': {
        const extra = p.duration
          ? i18n.t('events.durationMinutes', { minutes: Math.round(p.duration / 60) })
          : '';
        return i18n.t('events.taskCompleted', {
          title: p.title || deletedTitle(),
          extra,
        });
      }
      case 'task.status_changed':
        return i18n.t('events.taskStatusChanged', {
          title: p.title || deletedTitle(),
          status: taskStatusLabel(p.to ?? ''),
        });
      case 'task.updated':
        return i18n.t('events.taskUpdated', { title: p.title || deletedTitle() });
      case 'task.dispatched':
        return i18n.t('events.taskDispatchedDispatch', {
          endpoint: p.endpoint ?? '',
          agentId: p.agentId ?? '',
        });
      case 'agent.updated':
      case 'agent.status_changed':
        switch (p.status) {
          case 'online':
            return i18n.t('events.agentOnline');
          case 'offline':
            return i18n.t('events.agentOffline');
          case 'busy':
            return i18n.t('events.agentBusy');
          default:
            return i18n.t('events.agentStatusFallback', { status: p.status ?? '' });
        }
      case 'task.commented':
        return i18n.t('events.commentAdded', { title: p.title || deletedTitle() });
      case 'task.comment_deleted':
        return i18n.t('events.commentDeleted', { title: p.title || deletedTitle() });
      case 'task.deleted':
        return i18n.t('events.taskDeleted', { title: p.title || deletedTitle() });
      default:
        return i18n.t('events.unknownAction', { action });
    }
  } catch {
    return action;
  }
}

export function getEventColor(action: string): string {
  switch (action) {
    case 'task.created':
      return 'hsl(153, 59%, 53%)';
    case 'task.claimed':
      return 'hsl(217, 91%, 60%)';
    case 'task.completed':
      return 'hsl(153, 59%, 53%)';
    case 'task.status_changed':
      return 'hsl(37, 91%, 55%)';
    case 'task.updated':
      return 'hsl(217, 91%, 60%)';
    case 'agent.updated':
    case 'agent.status_changed':
      return 'hsl(180, 80%, 60%)';
    case 'comment.added':
      return 'hsl(270, 80%, 60%)';
    default:
      return 'hsl(var(--muted-foreground))';
  }
}
