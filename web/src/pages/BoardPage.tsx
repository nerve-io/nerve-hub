import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  GripVertical,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
  PauseCircle,
  Archive,
  Circle,
  XCircle,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Modal from '../components/ui/Modal';
import { getProjectBoard, createTask, updateTask } from '../api/client';
import { useApp } from '../contexts/AppContext';
import type { Task, TaskStatus, TaskPriority, Board, Project } from '../types';

const STATUS_COLUMNS: { key: TaskStatus; label: string; icon: typeof Circle }[] = [
  { key: 'pending', label: '待处理', icon: Circle },
  { key: 'running', label: '进行中', icon: Loader2 },
  { key: 'blocked', label: '已阻塞', icon: XCircle },
  { key: 'waiting', label: '等待中', icon: PauseCircle },
  { key: 'done', label: '已完成', icon: CheckCircle2 },
  { key: 'failed', label: '已失败', icon: AlertCircle },
  { key: 'archived', label: '已归档', icon: Archive },
];

function TaskCard({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityClass = `badge-${task.priority}`;

  return (
    <div ref={setNodeRef} style={style} className="card" onClick={() => onEdit(task)}>
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
          <div
            {...attributes}
            {...listeners}
            style={{ cursor: 'grab', color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }}
          >
            <GripVertical size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {task.title}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', paddingLeft: 22, flexWrap: 'wrap' }}>
          <span className={`badge ${priorityClass}`}>{task.priority}</span>
          <span className="badge badge-type">{task.type}</span>
          {task.assignee && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              <User size={11} /> {task.assignee}
            </span>
          )}
          {task.progress > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
              {task.progress}%
            </div>
          )}
        </div>
        {task.progress > 0 && task.progress < 100 && (
          <div className="progress-bar" style={{ marginLeft: 22 }}>
            <div className="progress-fill" style={{ width: `${task.progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { addToast } = useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [board, setBoard] = useState<Record<TaskStatus, Task[]>>({
    pending: [], running: [], blocked: [], waiting: [], done: [], failed: [], archived: [],
  });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', type: 'custom' as const, priority: 'medium' as const,
    assignee: '', tags: '',
  });
  const [editForm, setEditForm] = useState({
    title: '', description: '', status: 'pending' as TaskStatus, priority: 'medium' as string,
    assignee: '', progress: 0, error: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const data: Board = await getProjectBoard(projectId);
      setProject(data.project);
      setBoard(data.board);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, addToast]);

  useEffect(() => { load(); }, [load]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !projectId) return;

    const taskId = active.id as string;
    // Find which column the task was dropped into
    for (const col of STATUS_COLUMNS) {
      const taskInCol = board[col.key].find((t) => t.id === taskId);
      if (taskInCol) {
        // Check if dropped on a column header area or another task in a different column
        const targetCol = STATUS_COLUMNS.find((c) => {
          if (c.key === col.key) return false;
          return board[c.key].some((t) => t.id === over.id) || over.id === `col-${c.key}`;
        });
        if (targetCol && targetCol.key !== taskInCol.status) {
          try {
            await updateTask(taskId, { status: targetCol.key });
            load();
          } catch (err: any) {
            addToast('error', err.message);
          }
        }
        break;
      }
    }
  };

  const handleCreate = async () => {
    if (!projectId || !form.title.trim()) return;
    setSubmitting(true);
    try {
      await createTask({
        projectId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        priority: form.priority,
        assignee: form.assignee.trim() || undefined,
        tags: form.tags.trim() ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
      addToast('success', 'Task created');
      setShowCreate(false);
      setForm({ title: '', description: '', type: 'custom', priority: 'medium', assignee: '', tags: '' });
      load();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setEditForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      progress: task.progress,
      error: task.error,
    });
  };

  const handleUpdate = async () => {
    if (!editTask) return;
    setSubmitting(true);
    try {
      await updateTask(editTask.id, {
        title: editForm.title,
        description: editForm.description,
        status: editForm.status,
        priority: editForm.priority as TaskPriority,
        assignee: editForm.assignee,
        progress: editForm.progress,
        error: editForm.error || null,
      });
      addToast('success', 'Task updated');
      setEditTask(null);
      load();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="看板" subtitle="加载中..." />
        <div className="page-body" style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto' }}>
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} style={{ minWidth: 280, flex: 1 }}>
              <div className="skeleton" style={{ height: 24, width: 80, marginBottom: 12 }} />
              {[1, 2].map((i) => (
                <div key={i} className="card" style={{ padding: 'var(--space-4)', marginBottom: 8 }}>
                  <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '40%' }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={project?.name || 'Board'}
        subtitle={`${Object.values(board).flat().length} 个任务`}
        breadcrumb={
          <>
            <Link to="/projects">项目列表</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{project?.name}</span>
          </>
        }
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            新建任务
          </button>
        }
      />
      <div className="page-body" style={{ overflowX: 'auto' }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', minWidth: 'fit-content', height: '100%' }}>
            {STATUS_COLUMNS.map((col) => {
              const tasks = board[col.key] || [];
              const Icon = col.icon;
              return (
                <div
                  key={col.key}
                  style={{ minWidth: 280, flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  {/* Column header */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                      marginBottom: 'var(--space-3)', padding: 'var(--space-2) 0',
                    }}
                  >
                    <Icon size={14} style={{ color: `var(--color-${col.key})` }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {col.label}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                        color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)',
                        padding: '1px 6px', borderRadius: 'var(--radius-full)',
                      }}
                    >
                      {tasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
                      {tasks.map((task) => (
                        <TaskCard key={task.id} task={task} onEdit={openEdit} />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </DndContext>
      </div>

      {/* Create Task Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="新建任务"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.title.trim() || submitting}>
              {submitting ? '创建中...' : '创建'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* ── 基本信息 ── */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--neural-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
              基本信息
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label">任务标题 <span style={{ color: 'var(--danger-400)' }}>*</span></label>
                <input
                  className="form-input"
                  placeholder="例如：实现用户登录接口"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">详细描述</label>
                <textarea
                  className="form-textarea"
                  placeholder="描述具体要做什么、验收标准等..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* ── 分类与优先级 ── */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--neural-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
              分类与优先级
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label">
                  任务类型
                  <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>这是什么类型的活？</span>
                </label>
                <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
                  <option value="code">💻 写代码</option>
                  <option value="review">🔍 代码审查</option>
                  <option value="test">🧪 写测试</option>
                  <option value="deploy">🚀 部署上线</option>
                  <option value="research">📚 调研分析</option>
                  <option value="custom">📋 其他</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  优先级
                  <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>多紧急？</span>
                </label>
                <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })}>
                  <option value="low">🟢 低 — 有空再做</option>
                  <option value="medium">🟡 中 — 正常排期</option>
                  <option value="high">🟠 高 — 优先处理</option>
                  <option value="critical">🔴 紧急 — 立即处理</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── 分配与标签 ── */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--neural-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
              分配与标签
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label">
                  负责人
                  <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>谁来做？填 AI 名称或你的名字</span>
                </label>
                <input
                  className="form-input"
                  placeholder="例如：claude、cursor、张三"
                  value={form.assignee}
                  onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  标签
                  <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>用逗号分隔，方便筛选</span>
                </label>
                <input
                  className="form-input"
                  placeholder="例如：前端, API, 紧急"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        open={!!editTask}
        onClose={() => setEditTask(null)}
        title="编辑任务"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditTask(null)}>取消</button>
            <button className="btn btn-primary" onClick={handleUpdate} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        {editTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--neural-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                基本信息
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">任务标题</label>
                  <input
                    className="form-input"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">详细描述</label>
                  <textarea
                    className="form-textarea"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--neural-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                状态与优先级
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">当前状态</label>
                  <select className="form-select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TaskStatus })}>
                    {STATUS_COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">优先级</label>
                  <select className="form-select" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}>
                    <option value="low">🟢 低</option>
                    <option value="medium">🟡 中</option>
                    <option value="high">🟠 高</option>
                    <option value="critical">🔴 紧急</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--neural-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                分配与进度
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">负责人</label>
                  <input
                    className="form-input"
                    value={editForm.assignee}
                    onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })}
                    placeholder="claude、cursor 或你的名字"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">完成进度 ({editForm.progress}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={editForm.progress}
                    onChange={(e) => setEditForm({ ...editForm, progress: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--neural-500)' }}
                  />
                </div>
              </div>
            </div>
            {editForm.status === 'failed' && (
              <div className="form-group">
                <label className="form-label">错误信息</label>
                <textarea
                  className="form-textarea"
                  value={editForm.error}
                  onChange={(e) => setEditForm({ ...editForm, error: e.target.value })}
                  rows={2}
                  placeholder="描述出了什么问题..."
                />
              </div>
            )}
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              任务 ID: {editTask.id}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
