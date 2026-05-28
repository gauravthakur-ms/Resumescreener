import { useState } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
