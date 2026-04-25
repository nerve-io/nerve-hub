import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listEvents, listProjects } from '../api';
import { toast } from '@/lib/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relativeTime, absoluteTime, formatAction, getEventColor } from '../utils';
import type { Event, Project } from '../types';

export function EventLog() {
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState('all');

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '100' };
      if (filterProject && filterProject !== 'all') params.projectId = filterProject;
      const [evts, projs] = await Promise.all([
        listEvents(params),
        listProjects(),
      ]);
      setEvents(evts);
      setProjects(projs);
    } catch (err: any) {
      toast(err.message);
    }
  }, [filterProject]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-[900px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Event Log</h1>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
          <svg className="w-12 h-12 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
          <div className="text-base font-medium mb-1">No events yet</div>
        </div>
      ) : (
        <div className="flex flex-col">
          {events.map((event, index) => {
            const eventColor = getEventColor(event.action);
            const hasResult = event.action === 'task.completed';
            let resultSummary = '';
            
            try {
              const payload = JSON.parse(event.payload);
              if (hasResult && payload.result) {
                resultSummary = payload.result.substring(0, 50) + (payload.result.length > 50 ? '...' : '');
              }
            } catch {}
            
            return (
              <div key={event.id} className="relative pl-8 pb-6">
                {/* Timeline line */}
                {index < events.length - 1 && (
                  <div className="absolute left-1.5 top-4 bottom-0 w-px bg-border" />
                )}
                
                {/* Timeline dot */}
                <div 
                  className="absolute left-1 top-1 w-3 h-3 rounded-full" 
                  style={{ backgroundColor: eventColor }}
                />
                
                {/* Event content */}
                <div>
                  <div className="flex items-start gap-2">
                    <div className="text-muted-foreground text-[12px] whitespace-nowrap" title={absoluteTime(event.createdAt)}>
                      {relativeTime(event.createdAt)}
                    </div>
                    <div className="text-[13px] text-foreground">
                      <span className="text-primary font-medium">[{event.actor}]</span>{' '}
                      {formatAction(event.action, event.payload)}
                    </div>
                  </div>
                  
                  {/* Result summary */}
                  {resultSummary && (
                    <div className="text-[12px] text-muted-foreground mt-1 pl-14">
                      {resultSummary}
                    </div>
                  )}
                  
                  {/* Task link */}
                  {event.taskId && (
                    <div className="mt-1 pl-14">
                      <Link to={`/tasks/${event.taskId}`} className="text-[12px] text-muted-foreground hover:text-primary no-underline cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                        View task →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
