import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  Zap,
  TrendingUp,
  Activity,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { listProjects, queryTasks } from '../api/client';
import { useApp } from '../contexts/AppContext';
import type { Project, Task } from '../types';

export default function DashboardPage() {
  const { connected, addToast } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({ total: 0, running: 0, done: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [projs, tasks] = await Promise.all([listProjects(), queryTasks({})]);
      setProjects(projs);
      setRecentTasks(tasks.slice(0, 10));
      setStats({
        total: tasks.length,
        running: tasks.filter((t) => t.status === 'running').length,
        done: tasks.filter((t) => t.status === 'done').length,
        failed: tasks.filter((t) => t.status === 'failed').length,
      });
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const statCards = [
    { label: '总任务数', value: stats.total, icon: TrendingUp, color: 'var(--text-primary)' },
    { label: '进行中', value: stats.running, icon: Loader2, color: 'var(--color-running)' },
    { label: '已完成', value: stats.done, icon: CheckCircle2, color: 'var(--color-done)' },
    { label: '已失败', value: stats.failed, icon: AlertCircle, color: 'var(--color-failed)' },
  ];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <PageHeader
        title="仪表盘"
        subtitle={connected ? '系统运行正常' : 'Hub 未连接'}
        actions={
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)',
            background: connected ? 'rgba(0, 181, 114, 0.1)' : 'rgba(229, 62, 62, 0.1)',
            fontSize: 'var(--text-xs)', fontWeight: 500,
            color: connected ? 'var(--neural-400)' : 'var(--danger-400)',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: connected ? 'var(--neural-500)' : 'var(--danger-500)',
              animation: connected ? 'neural-pulse 2s ease-in-out infinite' : 'none',
            }} />
            {connected ? '已连接' : '离线'}
          </div>
        }
      />
      <div className="page-body">
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card" style={{ padding: 'var(--space-5)', height: 100 }}>
                <div className="skeleton" style={{ width: '50%', height: 14, marginBottom: 12 }} />
                <div className="skeleton" style={{ width: '30%', height: 28 }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
              {statCards.map((s, i) => (
                <div
                  key={s.label}
                  className="card animate-fade-in"
                  style={{ padding: 'var(--space-5)', animationDelay: `${i * 80}ms` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <s.icon size={18} style={{ color: s.color, opacity: 0.7 }} />
                  </div>
                  <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
              {/* Projects */}
              <div>
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <FolderKanban size={16} style={{ color: 'var(--neural-500)' }} />
                  项目
                </h2>
                {projects.length === 0 ? (
                  <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>还没有项目</p>
                    <Link to="/projects" className="btn btn-secondary" style={{ marginTop: 'var(--space-3)' }}>
                      <Plus size={14} /> 创建项目
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {projects.slice(0, 5).map((p) => (
                      <Link
                        key={p.id}
                        to={`/projects/${p.id}/board`}
                        className="card card-interactive"
                        style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                            background: 'linear-gradient(135deg, var(--neural-700), var(--neural-900))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Zap size={14} style={{ color: 'var(--neural-300)' }} />
                          </div>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {p.name}
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          {formatTime(p.createdAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Tasks */}
              <div>
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Activity size={16} style={{ color: 'var(--synapse-500)' }} />
                  最近任务
                </h2>
                {recentTasks.length === 0 ? (
                  <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>还没有任务</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {recentTasks.map((t) => (
                      <Link
                        key={t.id}
                        to={`/projects/${t.projectId}/board`}
                        className="card card-interactive"
                        style={{ padding: 'var(--space-3) var(--space-4)', textDecoration: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                            <StatusIcon status={t.status} />
                            <span className="truncate" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                              {t.title}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                            <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                              {formatTime(t.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running': return <Loader2 size={14} style={{ color: 'var(--color-running)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />;
    case 'done': return <CheckCircle2 size={14} style={{ color: 'var(--color-done)', flexShrink: 0 }} />;
    case 'failed': return <AlertCircle size={14} style={{ color: 'var(--color-failed)', flexShrink: 0 }} />;
    case 'blocked': return <AlertCircle size={14} style={{ color: 'var(--color-blocked)', flexShrink: 0 }} />;
    case 'waiting': return <Clock size={14} style={{ color: 'var(--color-waiting)', flexShrink: 0 }} />;
    default: return <Clock size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />;
  }
}

function Plus({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
