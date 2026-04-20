import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Zap, RefreshCw } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { listProjects, listEvents } from '../api/client';
import { useApp } from '../contexts/AppContext';
import type { NerveEvent, Project } from '../types';

export default function EventsPage() {
  const { addToast } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [events, setEvents] = useState<NerveEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const data = await listProjects();
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0].id);
      }
    } catch (err: any) {
      addToast('error', err.message);
    }
  }, [addToast, selectedProject]);

  const loadEvents = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const data = await listEvents(selectedProject, 200);
      setEvents(data);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, addToast]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const getEventTypeColor = (type: string) => {
    if (type.includes('created')) return 'var(--neural-400)';
    if (type.includes('updated')) return 'var(--synapse-400)';
    if (type.includes('deleted')) return 'var(--danger-400)';
    return 'var(--text-tertiary)';
  };

  return (
    <>
      <PageHeader
        title="事件日志"
        subtitle={`${events.length}条事件`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <select
              className="form-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{ minWidth: 200 }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-icon" onClick={loadEvents}>
              <RefreshCw size={16} />
            </button>
          </div>
        }
      />
      <div className="page-body">
        {!selectedProject ? (
          <div className="empty-state">
            <Activity size={48} />
            <h3>未选择项目</h3>
            <p>创建或选择一个项目来查看事件日志。</p>
            <Link to="/projects" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
              前往项目
            </Link>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card" style={{ padding: 'var(--space-4)' }}>
                <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '40%' }} />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <Activity size={48} />
            <h3>暂无事件</h3>
            <p>当任务被创建和更新时，事件会显示在这里。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {events.map((event, idx) => (
              <div
                key={event.id}
                className="card animate-fade-in"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  animationDelay: `${Math.min(idx * 30, 300)}ms`,
                  borderLeft: `3px solid ${getEventTypeColor(event.type)}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                    <Zap size={14} style={{ color: getEventTypeColor(event.type), flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {event.type}
                    </span>
                    <span className="badge badge-type">{event.channel}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      来自 {event.source}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <pre style={{
                    marginTop: 'var(--space-2)',
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                    background: 'var(--bg-tertiary)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxHeight: 60,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(event.payload, null, 2).slice(0, 300)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
