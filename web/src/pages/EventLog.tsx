import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listEvents, listProjects } from '../api';
import { toast } from '@/lib/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relativeTime, absoluteTime, formatAction } from '../utils';
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
          <div className="text-5xl mb-4 opacity-30">📋</div>
          <div className="text-base font-medium mb-1">No events yet</div>
        </div>
      ) : (
        <div className="flex flex-col">
          {events.map((event) => (
            <div key={event.id} className="grid grid-cols-[80px_12px_1fr] py-2.5 border-b border-border/50 hover:bg-white/[0.03] transition-colors">
              <div className="text-muted-foreground text-[12px] text-right pr-3 pt-0.5" title={absoluteTime(event.createdAt)}>
                {relativeTime(event.createdAt)}
              </div>
              <div className="w-2 h-2 rounded-full bg-border mt-1.5" />
              <div className="pl-3">
                <div className="text-[13px] text-foreground mb-0.5">
                  <span className="text-primary font-medium">[{event.actor}]</span>{' '}
                  {formatAction(event.action, event.payload)}
                </div>
                {event.taskId && (
                  <Link to={`/tasks/${event.taskId}`} className="text-[12px] text-muted-foreground hover:text-primary no-underline">
                    View task →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
