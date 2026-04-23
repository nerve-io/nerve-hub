import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listProjects, createProject, getProjectContext, deleteProject } from '../api';
import { AppDialog } from '@/components/ui/AppDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { relativeTime, statusColor } from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { Project } from '../types';

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; byStatus: Record<string, number> }>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [projs] = await Promise.all([listProjects()]);
      setProjects(projs);
      const statsMap: Record<string, { total: number; byStatus: Record<string, number> }> = {};
      await Promise.all(
        projs.map(async (p) => {
          try {
            const ctx = await getProjectContext(p.id);
            statsMap[p.id] = ctx.stats;
          } catch {
            statsMap[p.id] = { total: 0, byStatus: {} };
          }
        })
      );
      setStats(statsMap);
    } catch (err: any) {
      toast(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(null, load);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createProject({ name: name.trim(), description: desc.trim() });
      setModalOpen(false);
      setName('');
      setDesc('');
      load();
    } catch (err: any) {
      toast(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await deleteProject(confirmDeleteId);
      toast('Project deleted');
      setConfirmDeleteId(null);
      load();
    } catch (err: any) {
      toast(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Projects</h1>
        <Button onClick={() => setModalOpen(true)} className="bg-gradient-to-r from-primary to-blue-400 hover:from-primary/90 hover:to-blue-400/90 text-white border-0">
          + New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
          <svg className="w-12 h-12 mb-4 opacity-20 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <div className="text-base font-medium mb-1">No projects yet</div>
          <div className="text-sm opacity-70">Create your first project to get started</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const s = stats[p.id];
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="block no-underline text-inherit cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none rounded-lg">
                <Card className="backdrop-blur-sm bg-card/60 transition-all duration-200 hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--glow-primary)/0.15)] hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base tracking-tight truncate">{p.name}</CardTitle>
                        {p.description && (
                          <CardDescription className="truncate">{p.description}</CardDescription>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(p.id); }}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </Button>
                    </div>
                  </CardHeader>
                  {s && s.total > 0 && (
                    <CardContent className="pb-2">
                      <div className="flex gap-3">
                        {['pending', 'running', 'done'].map((status) => {
                          const count = s.byStatus[status] || 0;
                          if (count === 0) return null;
                          return (
                            <span key={status} className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: statusColor(status) }}
                              />
                              {status} {count}
                            </span>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                  <CardFooter className="pt-0">
                    <span className="text-[11px] text-muted-foreground">{relativeTime(p.createdAt)}</span>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <AppDialog open={modalOpen} onClose={() => setModalOpen(false)} title="New Project">
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="project-name">Name</Label>
              <span className={`text-[11px] ${name.length > 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {name.length}/100
              </span>
            </div>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              maxLength={100}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="project-desc">Description</Label>
              <span className={`text-[11px] ${desc.length > 2000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {desc.length}/2000
              </span>
            </div>
            <Textarea
              id="project-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </div>
      </AppDialog>

      <Dialog open={confirmDeleteId !== null} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] backdrop-blur-xl bg-card/80 border-border/50">
          <DialogHeader>
            <DialogTitle>删除项目</DialogTitle>
            <DialogDescription>
              确定要删除项目「{projects.find(p => p.id === confirmDeleteId)?.name}」吗？此操作不可恢复，项目下所有任务也将被删除。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '删除中...' : '删除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
