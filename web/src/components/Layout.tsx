import { useEffect, useState } from 'react';
import { listProjects } from '../api';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
}

export function Layout({ children, currentPath }: LayoutProps) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    listProjects().then(setProjects).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen">
      <Sidebar projects={projects} currentPath={currentPath} />
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pt-14 md:px-8 md:py-6 md:pt-6 min-w-0">
        {children}
      </main>
    </div>
  );
}
