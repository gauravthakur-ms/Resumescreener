import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem('app_role') || 'admin');

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    localStorage.setItem('app_role', newRole);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} role={role} onRoleChange={handleRoleChange} />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
