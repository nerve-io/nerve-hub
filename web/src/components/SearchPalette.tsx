import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchTasks } from '../api';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { statusColor, priorityColor, relativeTime } from '../utils';
import type { Task, Project } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  projects: Project[];
}

export function SearchPalette({ open, onClose, projects }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const projectMap = useCallback(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const tasks = await searchTasks(query.trim());
        setResults(tasks.slice(0, 20));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (task: Task) => {
    onClose();
    navigate(`/tasks/${task.id}`);
  };

  const pMap = projectMap();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px] backdrop-blur-xl bg-card/80 border-border/50 p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <svg className="w-4 h-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索任务…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {!query.trim() && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              输入关键词搜索任务
            </div>
          )}
          {loading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              搜索中…
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              未找到匹配的任务
            </div>
          )}
          {results.map((task) => (
            <button
              key={task.id}
              onClick={() => handleSelect(task)}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-border/30 last:border-0 flex items-start gap-3"
            >
              <span
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ background: statusColor(task.status) }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{task.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{pMap[task.projectId] || '—'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ color: priorityColor(task.priority) }}>
                    {task.priority}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{relativeTime(task.createdAt)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
