import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listProjects, createProject, getProjectContext } from '../api';
import { AppDialog } from '@/components/ui/AppDialog';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { relativeTime, statusColor } from '../utils';
import type { Project } from '../types';

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; byStatus: Record<string, number> }>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

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

  return (
    <div className="max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Projects</h1>
        <Button onClick={() => setModalOpen(true)} className="bg-gradient-to-r from-primary to-emerald-400 hover:from-primary/90 hover:to-emerald-400/90 text-white border-0">
          + New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
          <div className="text-5xl mb-4 opacity-20 text-primary">⬡</div>
          <div className="text-base font-medium mb-1">No projects yet</div>
          <div className="text-sm opacity-70">Create your first project to get started</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const s = stats[p.id];
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="block no-underline text-inherit">
                <Card className="backdrop-blur-sm bg-card/60 transition-all hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--glow-primary)/0.15)] hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base tracking-tight">{p.name}</CardTitle>
                    {p.description && (
                      <CardDescription className="truncate">{p.description}</CardDescription>
                    )}
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
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
              rows={3}
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
    </div>
  );
}
