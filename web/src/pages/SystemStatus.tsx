import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listAgents, listEvents } from '../api';
import { toast } from '@/lib/toast';
import { relativeTime, absoluteTime, formatAction, isHeartbeatFresh, agentTypeLabel } from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { Agent, Event } from '../types';
import { RadioTower, Workflow, AlertTriangle } from 'lucide-react';

function filterRecentFailedEvents(events: Event[], limit: number): Event[] {
  return events
    .filter((e) => {
      if (e.action !== 'task.status_changed') return false;
      try {
        const p = JSON.parse(e.payload);
        return p.to === 'failed';
      } catch {
        return false;
      }
    })
    .slice(0, limit);
}

function findLatestRunnerDispatch(events: Event[]): Event | undefined {
  return events.find((e) => e.action === 'task.dispatched');
}

export function SystemStatus() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const describePresence = useCallback(
    (agent: Agent) => {
      const fresh = isHeartbeatFresh(agent.lastSeen);
      if (fresh === true) {
        return {
          dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]',
          label: t('agentStatus.online'),
          detail: agent.lastSeen ? t('systemStatus.heartbeatFresh', { time: relativeTime(agent.lastSeen) }) : '',
        };
      }
      if (fresh === false) {
        return {
          dotClass: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]',
          label: t('agentStatus.offline'),
          detail: agent.lastSeen ? t('systemStatus.lastSeen', { time: relativeTime(agent.lastSeen) }) : '',
        };
      }
      return {
        dotClass: 'bg-muted-foreground/60',
        label: t('systemStatus.noHeartbeat'),
        detail: t('systemStatus.serverStatus', { status: agent.status }),
      };
    },
    [t],
  );

  const load = useCallback(async () => {
    try {
      const [a, ev] = await Promise.all([
        listAgents(),
        listEvents({ limit: '400' }),
      ]);
      setAgents(a);
      setEvents(ev);
    } catch (err: any) {
      toast(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(null, load);

  const lastDispatch = useMemo(() => findLatestRunnerDispatch(events), [events]);
  const errorEvents = useMemo(() => filterRecentFailedEvents(events, 3), [events]);

  return (
    <div className="page-shell">
      <div>
        <h1 className="page-title">{t('page.systemStatus')}</h1>
        <p className="page-description">
          {t('systemStatus.intro')}
        </p>
      </div>

      <section className="surface-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <RadioTower className="w-4 h-4 text-primary shrink-0" />
          <span className="text-base font-semibold">{t('systemStatus.sectionAgents')}</span>
        </div>
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('systemStatus.noAgentsRegistered')}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {agents.map((agent) => {
              const p = describePresence(agent);
              return (
                <li
                  key={agent.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/45 px-4 py-3"
                >
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${p.dotClass}`} title={p.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-base font-medium truncate">{agent.name}</span>
                      <span className="text-[11px] text-muted-foreground font-mono truncate">{agent.id}</span>
                      <span className="text-[11px] px-1.5 rounded bg-white/[0.06] shrink-0">{agentTypeLabel(agent.type)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                      <span>{p.label}</span>
                      {p.detail && <span title={agent.lastSeen ? absoluteTime(agent.lastSeen) : undefined}>{p.detail}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Workflow className="w-4 h-4 text-primary shrink-0" />
          <span className="text-base font-semibold">{t('systemStatus.sectionRunner')}</span>
        </div>
        {lastDispatch ? (
          <div className="text-sm">
            <span className="text-muted-foreground" title={absoluteTime(lastDispatch.createdAt)}>
              {t('systemStatus.lastDispatch', { time: relativeTime(lastDispatch.createdAt) })}
            </span>
            <div className="text-[13px] mt-2 text-foreground/90">
              <span className="text-primary font-medium">[{lastDispatch.actor}]</span>{' '}
              {formatAction(lastDispatch.action, lastDispatch.payload)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('systemStatus.noDispatch')}
          </p>
        )}
      </section>

      <section
        className={`rounded-xl border p-5 backdrop-blur-sm ${
          errorEvents.length > 0
            ? 'border-destructive/50 bg-destructive/[0.06]'
            : 'border-border bg-card/40'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle
            className={`w-4 h-4 shrink-0 ${errorEvents.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
          />
          <span className="text-base font-semibold">{t('systemStatus.recentFailures')}</span>
          <Link to="/events" className="text-[11px] text-primary ml-auto hover:underline">
            {t('common.fullLog')} →
          </Link>
        </div>
        {errorEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('systemStatus.noRecentFailures')}</p>
        ) : (
          <ul className="space-y-3">
            {errorEvents.map((e) => (
              <li key={e.id} className="text-[13px] border-l-2 border-destructive/50 pl-3">
                <div className="text-muted-foreground text-[12px]" title={absoluteTime(e.createdAt)}>
                  {relativeTime(e.createdAt)}
                </div>
                <div>
                  <span className="text-primary font-medium">[{e.actor}]</span>{' '}
                  {formatAction(e.action, e.payload)}
                </div>
                {e.taskId && (
                  <Link to={`/tasks/${e.taskId}`} className="text-[12px] text-primary hover:underline mt-1 inline-block">
                    {t('systemStatus.viewTaskShort', { slice: e.taskId.slice(0, 8) })}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
