export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
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

export function formatAction(action: string, payload: string): string {
  try {
    const p = JSON.parse(payload);
    
    switch (action) {
      case 'task.created':
        return `创建了任务《${p.title || '未知任务'}》`;
      case 'task.claimed':
        return `领取了任务《${p.title || '未知任务'}》`;
      case 'task.completed':
        const duration = p.duration ? `，耗时 ${Math.round(p.duration / 60)} 分钟` : '';
        return `完成了任务《${p.title || '未知任务'}》${duration}`;
      case 'task.status_changed':
        return `将《${p.title || '未知任务'}》状态改为 ${p.to}`;
      case 'task.updated':
        return `更新了任务《${p.title || '未知任务'}》`;
      case 'agent.updated':
      case 'agent.status_changed':
        switch (p.status) {
          case 'online':
            return '上线';
          case 'offline':
            return '下线';
          case 'busy':
            return '变为忙碌';
          default:
            return `状态变为 ${p.status}`;
        }
      case 'comment.added':
        return `在《${p.title || '未知任务'}》下留言`;
      default:
        return action;
    }
  } catch {
    return action;
  }
}

export function getEventColor(action: string): string {
  switch (action) {
    case 'task.created':
      return 'hsl(153, 59%, 53%)'; // 绿色
    case 'task.claimed':
      return 'hsl(217, 91%, 60%)'; // 蓝色
    case 'task.completed':
      return 'hsl(153, 59%, 53%)'; // 绿色
    case 'task.status_changed':
      return 'hsl(37, 91%, 55%)'; // 橙色
    case 'task.updated':
      return 'hsl(217, 91%, 60%)'; // 蓝色
    case 'agent.updated':
    case 'agent.status_changed':
      return 'hsl(180, 80%, 60%)'; // 青色
    case 'comment.added':
      return 'hsl(270, 80%, 60%)'; // 紫色
    default:
      return 'hsl(var(--muted-foreground))'; // 灰色
  }
}
