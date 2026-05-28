import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Upload,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/jobs', icon: FileText, label: 'Job Descriptions' },
  { path: '/upload', icon: Upload, label: 'Upload Resumes' },
  { path: '/batches', icon: Layers, label: 'Batches' },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside
      className={`shrink-0 h-screen bg-[rgba(10,10,10,0.90)] backdrop-blur-[8px] border-r border-dark-600 flex flex-col transition-all duration-200 z-50 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-[72px] border-b border-dark-600 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
        <img src="/Logo.jpg" alt="LTM" className="h-14 w-14 shrink-0 object-contain" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive =
            path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path);

          return (
            <NavLink
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-coral/10 text-coral'
                  : 'text-muted hover:text-white hover:bg-dark-700'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon
                size={20}
                className={isActive ? 'text-coral' : 'text-muted group-hover:text-white'}
              />
              {!collapsed && <span>{label}</span>}
              {isActive && (
                <div className="absolute left-0 w-[3px] h-8 bg-coral rounded-r-full" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-dark-600 text-muted hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
