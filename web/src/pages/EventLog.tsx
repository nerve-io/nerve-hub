import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listEventsWithCount, listProjects } from '../api';
import { toast } from '@/lib/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paginator } from '@/components/ui/paginator';
import { relativeTime, absoluteTime, formatAction, getEventColor } from '../utils';
import type { Event, Project } from '../types';

const DEFAULT_PAGE_SIZE = 20;

export function EventLog() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState('all');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: String(pageSize), offset: String(offset) };
      if (filterProject && filterProject !== 'all') params.projectId = filterProject;
      const [{ items, total: t }, projs] = await Promise.all([
        listEventsWithCount(params),
        listProjects(),
      ]);
      setEvents(items);
      setProjects(projs);
      setTotal(t);
    } catch (err: any) {
      toast(err.message);
    }
  }, [filterProject, pageSize, offset]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset offset when filter or pageSize changes
  const handleFilterChange = (val: string) => {
    setFilterProject(val);
    setOffset(0);
  };
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setOffset(0);
  };

  const hasMore = offset + pageSize < total;

  const paginatorLabels = {
    showing: t('common.paginator.showing'),
    page: t('common.paginator.page'),
    of: t('common.paginator.of'),
    perPage: t('common.paginator.perPage'),
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('page.eventLog')}</h1>
        </div>
        <Select value={filterProject} onValueChange={handleFilterChange}>
          <SelectTrigger className="h-9 w-full sm:w-[260px]">
            <SelectValue placeholder={t('eventLog.filterAllProjects')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('eventLog.filterAllProjects')}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
          <svg className="w-12 h-12 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
          <div className="text-base font-medium mb-1">{t('eventLog.noEvents')}</div>
        </div>
      ) : (
        <div className="surface-card flex flex-col p-4">
          {events.map((event, index) => {
            const eventColor = getEventColor(event.action);
            let resultSummary = '';

            try {
              const payload = JSON.parse(event.payload);
              if (payload.result) {
                resultSummary = payload.result.substring(0, 50) + (payload.result.length > 50 ? '...' : '');
              }
            } catch {
              /* ignore */
            }

            return (
              <div key={event.id} className="relative pl-8 pb-6 last:pb-1">
                {index < events.length - 1 && (
                  <div className="absolute left-1.5 top-4 bottom-0 w-px bg-border" />
                )}

                <div
                  className="absolute left-1 top-1 w-3 h-3 rounded-full"
                  style={{ backgroundColor: eventColor }}
                />

                <div className="rounded-lg px-2 py-1 transition-colors hover:bg-background/45">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                    <div className="text-muted-foreground text-xs whitespace-nowrap sm:w-20" title={absoluteTime(event.createdAt)}>
                      {relativeTime(event.createdAt)}
                    </div>
                    <div className="min-w-0 text-sm leading-6 text-foreground">
                      <span className="text-primary font-medium">[{event.actor}]</span>{' '}
                      <span>{formatAction(event.action, event.payload)}</span>
                    </div>
                  </div>

                  {resultSummary && (
                    <div className="text-sm text-muted-foreground mt-1 sm:pl-[5.75rem]">
                      {resultSummary}
                    </div>
                  )}

                  {event.taskId && (
                    <div className="mt-1 sm:pl-[5.75rem]">
                      <Link to={`/tasks/${event.taskId}`} className="text-sm text-muted-foreground hover:text-primary no-underline cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                        {t('eventLog.viewTaskLink')}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <Paginator
            pageSize={pageSize}
            offset={offset}
            total={total}
            hasMore={hasMore}
            onPageSizeChange={handlePageSizeChange}
            onPrev={() => setOffset(prev => Math.max(0, prev - pageSize))}
            onNext={() => setOffset(prev => prev + pageSize)}
            labels={paginatorLabels}
          />
        </div>
      )}
    </div>
  );
}
