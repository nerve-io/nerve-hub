import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  User,
  Tag,
  GitBranch,
  History,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Modal from '../components/ui/Modal';
import { getTask, updateTask, deleteTask, listStateLogs } from '../api/client';
import { useApp } from '../contexts/AppContext';
import type { Task, StateLog } from '../types';

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { addToast } = useApp();
  const [task, setTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<StateLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', description: '', status: '' as string, priority: '' as string,
    assignee: '', progress: 0, error: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    try {
      const [t, l] = await Promise.all([getTask(taskId), listStateLogs(taskId)]);
      setTask(t);
      setLogs(l);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId, addToast]);

  useEffect(() => { load(); }, [load]);

  const openEdit = () => {
    if (!task) return;
    setEditForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      progress: task.progress,
      error: task.error,
    });
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      const updated = await updateTask(task.id, {
        title: editForm.title,
        description: editForm.description,
        status: editForm.status as any,
        priority: editForm.priority as any,
        assignee: editForm.assignee,
        progress: editForm.progress,
        error: editForm.error || null,
      });
      setTask(updated);
      addToast('success', '任务已更新');
      setShowEdit(false);
      load();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await deleteTask(task.id);
      addToast('success', '任务已删除');
      window.history.back();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  if (loading) {
    return (
      <>
        <PageHeader title="任务详情" subtitle="加载中..." />
        <div className="page-body">
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 14, width: '80%' }} />
          </div>
        </div>
      </>
    );
  }

  if (!task) {
    return (
      <>
        <PageHeader title="任务未找到" />
        <div className="page-body">
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>任务未找到</h3>
            <p>你找的任务不存在或已被删除。</p>
            <Link to="/projects" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
              返回项目
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={`ID: ${task.id}`}
        breadcrumb={
          <>
            <Link to="/projects">Projects</Link>
            <span className="breadcrumb-sep">/</span>
            <Link to={`/projects/${task.projectId}/board`}>Board</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{task.title}</span>
          </>
        }
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary" onClick={openEdit}>编辑</button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowDelete(true)}>
              <Trash2 size={14} />
              删除
            </button>
          </div>
        }
      />
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          {/* Left: Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Description */}
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                描述
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 'var(--leading-relaxed)' }}>
                {task.description || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>暂无描述</span>}
              </p>
            </div>

            {/* Progress */}
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>进度</h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--neural-400)' }}>
                  {task.progress}%
                </span>
              </div>
              <div className="progress-bar" style={{ height: 6 }}>
                <div className="progress-fill" style={{ width: `${task.progress}%` }} />
              </div>
            </div>

            {/* Error */}
            {task.error && (
              <div className="card" style={{ padding: 'var(--space-5)', borderLeft: '3px solid var(--danger-500)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--danger-400)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <AlertCircle size={14} /> 错误
                </h3>
                <pre style={{
                  fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                  color: 'var(--danger-300)', background: 'var(--bg-tertiary)',
                  padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {task.error}
                </pre>
              </div>
            )}

            {/* State Change History */}
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <History size={14} /> 状态变更历史
              </h3>
              {logs.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-4)' }}>
                  暂无状态变更记录
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', fontSize: 'var(--text-xs)',
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neural-500)', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.field}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>by</span>
                          <span style={{ color: 'var(--synapse-400)', fontFamily: 'var(--font-mono)' }}>{log.actor}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                          <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                            {typeof log.oldValue === 'string' ? log.oldValue : JSON.stringify(log.oldValue)}
                          </span>
                          <ArrowRight size={10} />
                          <span style={{ color: 'var(--neural-400)' }}>
                            {typeof log.newValue === 'string' ? log.newValue : JSON.stringify(log.newValue)}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {formatTime(log.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Status & Priority */}
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>状态</h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <span className={`badge badge-${task.status}`} style={{ textTransform: 'capitalize' }}>{task.status}</span>
                <span className={`badge badge-${task.priority}`} style={{ textTransform: 'capitalize' }}>{task.priority}</span>
                <span className="badge badge-type">{task.type}</span>
              </div>
            </div>

            {/* Assignee */}
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <User size={14} /> 负责人
              </h3>
              <span style={{ fontSize: 'var(--text-sm)', color: task.assignee ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {task.assignee || '未分配'}
              </span>
            </div>

            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="card" style={{ padding: 'var(--space-5)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Tag size={14} /> 标签
                </h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {task.tags.map((tag) => (
                    <span key={tag} className="badge badge-type">#{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Dependencies */}
            {task.dependencies.length > 0 && (
              <div className="card" style={{ padding: 'var(--space-5)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <GitBranch size={14} /> 依赖关系
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {task.dependencies.map((depId) => (
                    <Link
                      key={depId}
                      to={`/tasks/${depId}`}
                      style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--neural-400)' }}
                    >
                      {depId.slice(0, 8)}...
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Clock size={14} /> 时间记录
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>创建时间</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatTime(task.createdAt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>更新时间</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatTime(task.updatedAt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>开始时间</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatTime(task.startedAt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>完成时间</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatTime(task.completedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="编辑任务"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleUpdate} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">任务标题</label>
            <input className="form-input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">描述</label>
            <textarea className="form-textarea" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">当前状态</label>
              <select className="form-select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {['pending', 'running', 'blocked', 'waiting', 'done', 'failed', 'archived'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                {['low', 'medium', 'high', 'critical'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Assignee</label>
            <input className="form-input" value={editForm.assignee} onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Progress ({editForm.progress}%)</label>
            <input type="range" min={0} max={100} value={editForm.progress} onChange={(e) => setEditForm({ ...editForm, progress: parseInt(e.target.value) })} style={{ width: '100%', accentColor: 'var(--neural-500)' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Error</label>
            <textarea className="form-textarea" value={editForm.error} onChange={(e) => setEditForm({ ...editForm, error: e.target.value })} rows={2} />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="删除任务"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowDelete(false)}>取消</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={submitting}>
              {submitting ? '删除中...' : '删除'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          确定要删除 <strong>"{task.title}"</strong>？此操作不可撤销。
        </p>
      </Modal>
    </>
  );
}

function ArrowRight({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
