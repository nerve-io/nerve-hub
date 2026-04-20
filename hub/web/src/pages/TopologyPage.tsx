import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Network, RefreshCw } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { listProjects, queryTasks } from '../api/client';
import { useApp } from '../contexts/AppContext';
import type { Project, Task } from '../types';

export default function TopologyPage() {
  const { addToast } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
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

  const loadTasks = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const data = await queryTasks({ projectId: selectedProject });
      setTasks(data);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, addToast]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Build a simple dependency graph visualization
  const rootTasks = tasks.filter((t) => !t.parentId && t.dependencies.length === 0);
  const childTasks = tasks.filter((t) => t.parentId || t.dependencies.length > 0);

  const getChildren = (taskId: string): Task[] => {
    return tasks.filter((t) => t.parentId === taskId || t.dependencies.includes(taskId));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'var(--color-running)';
      case 'done': return 'var(--color-done)';
      case 'failed': return 'var(--color-failed)';
      case 'blocked': return 'var(--color-blocked)';
      case 'waiting': return 'var(--color-waiting)';
      default: return 'var(--text-tertiary)';
    }
  };

  return (
    <>
      <PageHeader
        title="任务拓扑"
        subtitle="依赖关系图与状态历史"
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
            <button className="btn btn-secondary btn-icon" onClick={loadTasks}>
              <RefreshCw size={16} />
            </button>
          </div>
        }
      />
      <div className="page-body">
        {!selectedProject ? (
          <div className="empty-state">
            <Network size={48} />
            <h3>未选择项目</h3>
            <p>选择一个项目来查看任务拓扑。</p>
            <Link to="/projects" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
              前往项目
            </Link>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 'var(--space-5)', height: 80 }}>
                <div className="skeleton" style={{ width: '40%', height: 16, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '60%', height: 12 }} />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <Network size={48} />
            <h3>暂无任务</h3>
            <p>创建任务来查看依赖拓扑。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Summary */}
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>总计：</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{tasks.length}</span>
                </div>
                {['pending', 'running', 'done', 'failed', 'blocked', 'waiting'].map((s) => {
                  const count = tasks.filter((t) => t.status === s).length;
                  if (count === 0) return null;
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(s) }} />
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{s}:</span>
                      <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tree view */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {rootTasks.map((root) => (
                <TreeNode key={root.id} task={root} getChildren={getChildren} getStatusColor={getStatusColor} depth={0} />
              ))}
              {/* Orphan tasks (have dependencies but not listed as root) */}
              {childTasks
                .filter((t) => !rootTasks.some((r) => getChildren(r.id).includes(t)))
                .map((t) => (
                  <TreeNode key={t.id} task={t} getChildren={getChildren} getStatusColor={getStatusColor} depth={0} />
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TreeNode({
  task,
  getChildren,
  getStatusColor,
  depth,
}: {
  task: Task;
  getChildren: (id: string) => Task[];
  getStatusColor: (s: string) => string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = getChildren(task.id);

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div
        className="card card-interactive"
        style={{
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          borderLeft: `3px solid ${getStatusColor(task.status)}`,
        }}
        onClick={() => children.length > 0 && setExpanded(!expanded)}
      >
        {children.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>
            ▶
          </span>
        )}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(task.status), flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{task.title}</span>
        </div>
        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
        <span className="badge badge-type">{task.type}</span>
        {task.assignee && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{task.assignee}</span>
        )}
        {task.progress > 0 && (
          <div style={{ width: 48 }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${task.progress}%` }} />
            </div>
          </div>
        )}
      </div>
      {expanded && children.map((child) => (
        <TreeNode
          key={child.id}
          task={child}
          getChildren={getChildren}
          getStatusColor={getStatusColor}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
