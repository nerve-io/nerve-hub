import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import {
  LayoutDashboard,
  FolderKanban,
  Activity,
  Network,
  Zap,
} from 'lucide-react';

export default function AppLayout() {
  const { connected } = useApp();

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Zap />
          </div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">Nerve Hub</span>
            <span className="sidebar-brand-sub">AI Agent 状态总线</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">概览</div>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <LayoutDashboard />
              仪表盘
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <FolderKanban />
              项目管理
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">监控</div>
            <NavLink
              to="/events"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Activity />
              事件日志
            </NavLink>
            <NavLink
              to="/topology"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Network />
              任务拓扑
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <div className={`sidebar-status-dot${connected ? '' : ' offline'}`} />
            <span>{connected ? 'Hub 已连接' : '未连接'}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
