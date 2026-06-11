import { User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="h-[64px] bg-gradient-to-r from-[rgba(10,10,10,0.98)] via-[rgba(18,18,18,0.98)] to-[rgba(10,10,10,0.98)] backdrop-blur-[12px] border-b border-dark-600 flex items-center justify-between px-6 shrink-0 z-50 relative">
      {/* Subtle gradient accent line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-coral/30 to-transparent" />

      {/* Left — Logo */}
      <div className="flex items-center gap-3 -ml-2">
        <img src="/Logo.png" alt="LTM" className="h-11 w-auto object-contain" />
      </div>

      {/* Center — App Title */}
      <div className="flex items-center justify-center gap-3">
        <img src="/AppName.png" alt="" className="h-12 w-12 object-contain" />
        <h1 className="text-[19px] font-extrabold leading-tight tracking-tight">
          <span className="text-coral">Smart</span>
          <span className="text-white/90"> Resume </span>
          <span className="text-coral">Screener</span>
        </h1>
      </div>

      {/* Right — User Menu */}
      <div className="flex items-center relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-dark-700 to-dark-800 border border-dark-600 flex items-center justify-center text-muted hover:text-white hover:border-coral/50 hover:shadow-[0_0_12px_rgba(255,69,68,0.15)] transition-all duration-300"
          title={user?.name || 'User'}
        >
          <User size={18} />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-56 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-dark-600">
                <p className="text-white text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-muted text-xs truncate">{user?.email || ''}</p>
              </div>
              <button
                onClick={() => { setShowMenu(false); logout(); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted hover:text-red-400 hover:bg-dark-700 transition-colors"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
