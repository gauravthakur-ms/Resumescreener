import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Upload,
  Layers,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  User,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
  { path: '/jobs', icon: FileText, label: 'Job Descriptions' },
  { path: '/upload', icon: Upload, label: 'Upload Resumes' },
  { path: '/screened', icon: UserCheck, label: 'Screened Resumes' },
  { path: '/batches', icon: Layers, label: 'Batches', adminOnly: true },
];

export default function Sidebar({ collapsed, setCollapsed, role, onRoleChange }) {
  const location = useLocation();

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || role === 'admin'
  );

  return (
    <aside
      className={`shrink-0 h-full bg-gradient-to-b from-[rgba(10,10,10,0.95)] to-[rgba(8,8,8,0.98)] backdrop-blur-[12px] border-r border-dark-600 flex flex-col z-40 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        collapsed ? 'w-[68px]' : 'w-[220px]'
      }`}
    >
      {/* Navigation */}
      <nav className="flex-1 py-5 px-2.5 space-y-1 overflow-hidden">
        {visibleItems.map(({ path, icon: Icon, label }) => {
          const isActive =
            path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path);

          return (
            <NavLink
              key={path}
              to={path}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden whitespace-nowrap ${
                isActive
                  ? 'bg-coral/10 text-coral shadow-[0_0_16px_rgba(255,69,68,0.08)]'
                  : 'text-muted hover:text-white hover:bg-white/[0.04]'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon
                size={20}
                className={`shrink-0 transition-all duration-200 ${isActive ? 'text-coral drop-shadow-[0_0_4px_rgba(255,69,68,0.4)]' : 'text-muted group-hover:text-white'}`}
              />
              <span
                className={`transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  collapsed ? 'opacity-0 w-0 translate-x-[-8px]' : 'opacity-100 w-auto translate-x-0'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-coral rounded-r-full shadow-[0_0_6px_rgba(255,69,68,0.5)] transition-all duration-300" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Role Toggle */}
      <div className="px-3 pb-2">
        <button
          onClick={() => onRoleChange(role === 'admin' ? 'user' : 'admin')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border ${
            role === 'admin'
              ? 'text-coral bg-coral/5 border-coral/20 hover:bg-coral/10'
              : 'text-blue-400 bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
          } ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? `Role: ${role === 'admin' ? 'Admin' : 'User'}` : undefined}
        >
          {role === 'admin' ? (
            <Shield size={14} className="shrink-0" />
          ) : (
            <User size={14} className="shrink-0" />
          )}
          {!collapsed && (
            <span className="transition-opacity duration-300">
              {role === 'admin' ? 'Admin' : 'User'}
            </span>
          )}
        </button>
      </div>

      {/* Collapse toggle — clean pill button */}
      <div className="px-3 pb-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-muted hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-dark-600/50 hover:border-coral/30 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} className="shrink-0" />
          ) : (
            <>
              <PanelLeftClose size={16} className="shrink-0" />
              <span className="transition-opacity duration-300">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
