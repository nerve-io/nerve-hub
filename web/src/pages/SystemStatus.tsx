import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listAgents, listEvents, getToolStats, exportData, importData, createBackup, type ToolCallStat } from '../api';
import { toast } from '@/lib/toast';
import { relativeTime, absoluteTime, formatAction, isHeartbeatFresh, agentTypeLabel } from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { Agent, Event } from '../types';
import { RadioTower, Workflow, AlertTriangle, BarChart3, CircleOff, Database, Download, Upload, HardDrive } from 'lucide-react';

const ALL_MCP_TOOLS = [
  'create_task', 'complete_task', 'get_agent_briefing', 'claim_task', 'update_task',
  'get_task_context', 'list_tasks', 'get_task', 'get_blocked_by', 'get_events',
  'search_tasks', 'create_project', 'list_projects', 'get_project_rules',
  'get_project_context', 'register_agent', 'list_agents', 'update_agent_permissions',
  'issue_agent_credential', 'revoke_agent_credential', 'list_agent_credentials',
  'get_agent_rules', 'whoami', 'create_comment', 'list_comments',
  'get_handoff_queue', 'delete_task', 'delete_comment',
];

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
  const [toolStats, setToolStats] = useState<ToolCallStat[]>([]);

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
      const [a, ev, ts] = await Promise.all([
        listAgents(),
        listEvents({ limit: '400' }),
        getToolStats(),
      ]);
      setAgents(a);
      setEvents(ev);
      setToolStats(ts);
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
          <RadioTower className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <h2 className="text-base font-semibold">{t('systemStatus.sectionAgents')}</h2>
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
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${p.dotClass}`} title={p.label} aria-hidden="true" />
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
          <Workflow className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <h2 className="text-base font-semibold">{t('systemStatus.sectionRunner')}</h2>
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
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold">{t('systemStatus.recentFailures')}</h2>
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

      <section className="surface-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <h2 className="text-base font-semibold">{t('systemStatus.toolStatsTitle')}</h2>
        </div>
        {toolStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('systemStatus.noToolStats')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('systemStatus.toolStatsCaption')}</caption>
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th scope="col" className="pb-2 pr-3 font-medium">{t('systemStatus.toolName')}</th>
                  <th scope="col" className="pb-2 pr-3 font-medium text-right">{t('systemStatus.toolCalls')}</th>
                  <th scope="col" className="pb-2 pr-3 font-medium text-right">{t('systemStatus.toolErrors')}</th>
                  <th scope="col" className="pb-2 pr-3 font-medium">{t('systemStatus.toolLastCalled')}</th>
                  <th scope="col" className="pb-2 font-medium">{t('systemStatus.toolCallers')}</th>
                </tr>
              </thead>
              <tbody>
                {toolStats.map((s) => (
                  <tr key={s.toolName} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3 font-mono text-[12px]">{s.toolName}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.totalCalls}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {s.errorCalls > 0 ? (
                        <span className="text-destructive">{s.errorCalls}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground text-[12px]">
                      {s.lastCalledAt ? relativeTime(s.lastCalledAt) : '—'}
                    </td>
                    <td className="py-2 text-muted-foreground text-[12px]">
                      {s.callerAgents.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
                {ALL_MCP_TOOLS.filter(
                  (toolName) => !toolStats.some((s) => s.toolName === toolName)
                ).map((toolName) => (
                  <tr key={toolName} className="border-b border-border/30 last:border-0 bg-amber-500/[0.04]">
                    <td className="py-2 pr-3 font-mono text-[12px]">{toolName}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        <CircleOff className="w-3 h-3" aria-hidden="true" />0
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">—</td>
                    <td className="py-2 pr-3 text-muted-foreground text-[12px]">{t('systemStatus.notCalled')}</td>
                    <td className="py-2 text-muted-foreground text-[12px]">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-primary shrink-0" />
          <span className="text-base font-semibold">数据迁移</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                const data = await exportData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `nerve-hub-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast('导出成功');
              } catch (err: any) { toast(err.message); }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-background/60 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            导出数据
          </button>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-background/60 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            导入数据
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  if (!window.confirm('⚠️ 导入将覆盖所有现有数据。确定继续？')) return;
                  await importData(data, 'yes-i-know-this-replaces-all-data');
                  toast('导入成功');
                  load();
                } catch (err: any) { toast(err.message); }
              }}
            />
          </label>
          <button
            onClick={async () => {
              try {
                const { path } = await createBackup();
                toast(`备份完成: ${path}`);
              } catch (err: any) { toast(err.message); }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-background/60 transition-colors"
          >
            <HardDrive className="w-3.5 h-3.5" />
            创建备份
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground mt-3">
          导出和备份对所有用户开放。导入需要 admin 权限，导入前将提示确认。
        </p>
      </section>
    </div>
  );
}
