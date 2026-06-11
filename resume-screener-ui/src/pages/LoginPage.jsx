import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login, loading } = useAuth();

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <img src="/AppName.png" alt="" className="h-16 w-16 object-contain" />
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-coral">Smart</span>
            <span className="text-white"> Resume </span>
            <span className="text-coral">Screener</span>
          </h1>
          <p className="text-muted text-sm">AI-Powered Resume Screening Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 space-y-6 shadow-xl">
          <div className="space-y-2">
            <h2 className="text-white text-lg font-semibold">Welcome</h2>
            <p className="text-muted text-sm">Sign in with your organization account to continue.</p>
          </div>

          <button
            onClick={login}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-coral hover:bg-coral/90 text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-coral/20"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with LTM'}
          </button>
        </div>

        <p className="text-muted/60 text-xs">
          
        </p>
      </div>
    </div>
  );
}
