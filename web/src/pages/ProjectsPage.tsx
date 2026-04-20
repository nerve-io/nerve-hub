import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Clock, ChevronRight } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Modal from '../components/ui/Modal';
import { listProjects, createProject } from '../api/client';
import { useApp } from '../contexts/AppContext';
import type { Project } from '../types';

export default function ProjectsPage() {
  const { addToast } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err: any) {
      addToast('error', `Failed to load projects: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      await createProject({ name: formName.trim(), description: formDesc.trim() });
      addToast('success', `Project "${formName}" created`);
      setShowCreate(false);
      setFormName('');
      setFormDesc('');
      load();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (iso: string) => {
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
        title="项目管理"
        subtitle={`${projects.length}个项目`}
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            新建项目
          </button>
        }
      />
      <div className="page-body">
        {loading ? (
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 'var(--space-6)', height: 160 }}>
                <div className="skeleton" style={{ width: '60%', height: 20, marginBottom: 12 }} />
                <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '40%', height: 14 }} />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <FolderOpen size={48} />
            <h3>还没有项目</h3>
            <p>创建你的第一个项目，开始管理任务和协调 AI Agent。</p>
            <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              创建项目
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {projects.map((p, idx) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}/board`}
                className="card card-interactive"
                style={{ padding: 'var(--space-5)', textDecoration: 'none', animationDelay: `${idx * 60}ms` }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)',
                      background: `linear-gradient(135deg, var(--neural-700), var(--neural-900))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FolderOpen size={18} style={{ color: 'var(--neural-300)' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {p.name}
                      </h3>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', marginTop: 4 }} />
                </div>
                {p.description && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)', lineHeight: 'var(--leading-relaxed)' }}>
                    {p.description}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  <Clock size={12} />
                  <span>{formatDate(p.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="新建项目"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!formName.trim() || creating}>
              {creating ? '创建中...' : '创建'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', lineHeight: 'var(--leading-relaxed)' }}>
            项目是一个独立的工作空间。你可以把一个大的目标拆成一个项目，在里面创建多个任务分配给不同的 AI Agent 或你自己。
          </p>
          <div className="form-group">
            <label className="form-label">项目名称 <span style={{ color: 'var(--danger-400)' }}>*</span></label>
            <input
              className="form-input"
              placeholder="例如：重构用户系统、v2.0 上线准备"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="form-group">
            <label className="form-label">项目描述</label>
            <textarea
              className="form-textarea"
              placeholder="简单描述这个项目的目标和范围..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
