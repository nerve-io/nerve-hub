import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listProjects, getHandoffQueue } from '../api';
import { Sidebar } from './Sidebar';
import { SearchPalette } from './SearchPalette';
import { ThemeLangToolbar } from './ThemeLangToolbar';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Project } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
}

export function Layout({ children, currentPath }: LayoutProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [handoffCount, setHandoffCount] = useState(0);

  const loadProjects = () => {
    listProjects().then(setProjects).catch(() => {});
  };

  const loadHandoffCount = () => {
    getHandoffQueue().then((tasks) => setHandoffCount(tasks.length)).catch(() => {});
  };

  useEffect(() => {
    loadProjects();
    loadHandoffCount();
  }, []);

  // 监听所有项目相关事件，包括创建和删除
  useRealtimeSync(null, () => {
    loadProjects();
    loadHandoffCount();
  });

  useKeyboardShortcut('k', () => setSearchOpen(true), { meta: true });
  useKeyboardShortcut('?', () => setHelpOpen(true));

  return (
    <div className="flex h-screen">
      <Sidebar projects={projects} currentPath={currentPath} handoffCount={handoffCount} />
      <main className="flex-1 min-h-0 overflow-y-auto min-w-0 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1680px] min-w-0">
          <div className="flex justify-end mb-4">
            <ThemeLangToolbar />
          </div>
          {children}
        </div>
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
            <DialogTitle>{t('shortcuts.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 px-6 pb-6">
            {[
              { keys: 'N', desc: t('shortcuts.newTask') },
              { keys: '⌘K', desc: t('shortcuts.search') },
              { keys: '?', desc: t('shortcuts.help') },
              { keys: 'Esc', desc: t('shortcuts.esc') },
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
