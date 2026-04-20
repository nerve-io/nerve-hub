import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import BoardPage from './pages/BoardPage';
import TaskDetailPage from './pages/TaskDetailPage';
import EventsPage from './pages/EventsPage';
import TopologyPage from './pages/TopologyPage';
import './styles/globals.css';
import './styles/components.css';
import './styles/layout.css';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId/board" element={<BoardPage />} />
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/topology" element={<TopologyPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
