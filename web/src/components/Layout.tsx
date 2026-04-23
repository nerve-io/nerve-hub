import { useEffect, useState } from 'react';
import { listProjects } from '../api';
import { Sidebar } from './Sidebar';
import { SearchPalette } from './SearchPalette';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Project } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
}

export function Layout({ children, currentPath }: LayoutProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    listProjects().then(setProjects).catch(() => {});
  }, []);

  useKeyboardShortcut('k', () => setSearchOpen(true), { meta: true });
  useKeyboardShortcut('?', () => setHelpOpen(true));

  return (
    <div className="flex h-screen">
      <Sidebar projects={projects} currentPath={currentPath} />
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pt-14 md:px-8 md:py-6 md:pt-6 min-w-0">
        {children}
      </main>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        projects={projects}
      />

      {/* Keyboard shortcuts help */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-[400px] backdrop-blur-xl bg-card/80 border-border/50">
          <DialogHeader>
            <DialogTitle>键盘快捷键</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 px-6 pb-6">
            {[
              { keys: 'N', desc: '新建任务（看板页）' },
              { keys: '⌘K', desc: '全局搜索' },
              { keys: '?', desc: '显示此帮助' },
              { keys: 'Esc', desc: '关闭弹窗' },
            ].map((item) => (
              <div key={item.keys} className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">{item.desc}</span>
                <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded border border-border">
                  {item.keys}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
