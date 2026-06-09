import { User } from 'lucide-react';

export default function Header() {
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

      {/* Right — User Avatar */}
      <div className="flex items-center">
        <button className="w-9 h-9 rounded-full bg-gradient-to-br from-dark-700 to-dark-800 border border-dark-600 flex items-center justify-center text-muted hover:text-white hover:border-coral/50 hover:shadow-[0_0_12px_rgba(255,69,68,0.15)] transition-all duration-300">
          <User size={18} />
        </button>
      </div>
    </header>
  );
}
