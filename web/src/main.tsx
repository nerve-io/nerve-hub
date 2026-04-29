import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProjectList } from './pages/ProjectList';
import { Kanban } from './pages/Kanban';
import { TaskDetail } from './pages/TaskDetail';
import { EventLog } from './pages/EventLog';
import { Agents } from './pages/Agents';
import { HandoffQueue } from './pages/HandoffQueue';
import { SystemStatus } from './pages/SystemStatus';
import { Setup } from './pages/Setup';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

function KanbanRoute() {
  const { id } = useParams<{ id: string }>();
  return <Kanban projectId={id!} />;
}

function TaskDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <TaskDetail taskId={id!} />;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <Layout currentPath={location.pathname}>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/projects/:id" element={<KanbanRoute />} />
        <Route path="/tasks" element={<Navigate to="/" replace />} />
        <Route path="/tasks/:id" element={<TaskDetailRoute />} />
        <Route path="/events" element={<EventLog />} />
        <Route path="/status" element={<SystemStatus />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/handoff" element={<HandoffQueue />} />
      </Routes>
    </Layout>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  </StrictMode>
);
