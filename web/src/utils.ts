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

export function formatAction(action: string, payload: string): string {
  if (action === 'task.status_changed') {
    try {
      const p = JSON.parse(payload);
      return `${p.from} → ${p.to}`;
    } catch {
      return action;
    }
  }
  if (action === 'task.created') return 'created';
  if (action === 'task.updated') return 'updated';
  if (action === 'task.deleted') return 'deleted';
  return action;
}
