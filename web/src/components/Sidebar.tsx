import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { healthCheck } from '../api';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface SidebarProps {
  projects: { id: string; name: string }[];
  currentPath: string;
  handoffCount?: number;
}

function SidebarContent({ projects, currentPath, handoffCount = 0, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      setHealthy(await healthCheck());
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const navLinkClass = (isActive: boolean) =>
    `block px-2 py-1.5 rounded-md text-sm transition-all duration-200 truncate cursor-pointer no-underline ${
      isActive
        ? 'text-primary bg-primary/15 backdrop-blur-sm'
        : 'text-foreground/70 hover:text-foreground hover:bg-white/[0.04]'
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 text-base font-semibold tracking-tight">
        <svg className="w-5 h-5 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <span className="text-foreground">nerve-hub</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2">
        <Link to="/" className={navLinkClass(currentPath === '/')} onClick={onNavigate}>
          Projects
        </Link>
        <Link to="/agents" className={navLinkClass(currentPath === '/agents')} onClick={onNavigate}>
          Agents
        </Link>
        <Link to="/handoff" className={navLinkClass(currentPath === '/handoff')} onClick={onNavigate}>
          <span className="flex items-center gap-2">
            Handoff Queue
            {handoffCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                {handoffCount}
              </span>
            )}
          </span>
        </Link>
        <Link to="/events" className={navLinkClass(currentPath === '/events')} onClick={onNavigate}>
          Event Log
        </Link>
      </nav>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto px-2 pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-2 cursor-default select-none">
          Projects
        </div>
        {projects.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className={`block px-2 py-1.5 rounded-md text-xs transition-all duration-200 truncate cursor-pointer no-underline ${
              currentPath === `/projects/${p.id}`
                ? 'text-primary bg-primary/15 backdrop-blur-sm'
                : 'text-foreground/70 hover:text-foreground hover:bg-white/[0.04]'
            }`}
            onClick={onNavigate}
          >
            {p.name}
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border text-xs">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            healthy === null
              ? 'bg-muted-foreground'
              : healthy
                ? 'bg-success shadow-[0_0_6px_hsl(var(--success))]'
                : 'bg-destructive shadow-[0_0_6px_hsl(var(--destructive))]'
          }`}
        />
        <span className="text-muted-foreground">
          {healthy === null ? 'Checking…' : healthy ? 'Connected' : 'Offline'}
        </span>
      </div>
    </div>
  );
}

export function Sidebar({ projects, currentPath, handoffCount }: SidebarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden md:flex w-[var(--sidebar-width)] h-full shrink-0 bg-card/70 backdrop-blur-xl border-r border-border flex-col overflow-hidden">
        <SidebarContent projects={projects} currentPath={currentPath} handoffCount={handoffCount} />
      </aside>

      {/* Mobile: hamburger + Sheet drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSheetOpen(true)}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </Button>
        <span className="font-semibold tracking-tight">nerve-hub</span>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[var(--sidebar-width)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent
            projects={projects}
            currentPath={currentPath}
            handoffCount={handoffCount}
            onNavigate={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
