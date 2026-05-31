export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-[rgba(22,22,22,0.85)] backdrop-blur-[8px] border border-dark-600 rounded-xl p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, accent = false }) {
  return (
    <Card className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          accent ? 'bg-coral/10' : 'bg-dark-700'
        }`}
      >
        <Icon size={22} className={accent ? 'text-coral' : 'text-muted'} />
      </div>
      <div>
        <p className="text-muted text-sm">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </Card>
  );
}

export function Badge({ variant = 'default', children }) {
  const styles = {
    select: 'bg-green-500/10 text-green-400 border-green-500/20',
    review: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    reject: 'bg-red-500/10 text-red-400 border-red-500/20',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    queued: 'bg-muted/10 text-muted border-muted/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    default: 'bg-dark-700 text-muted border-dark-600',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[variant] || styles.default
      }`}
    >
      {children}
    </span>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary:
      'bg-coral hover:bg-coral-hover text-white shadow-lg shadow-coral/20',
    secondary: 'bg-dark-700 hover:bg-dark-600 text-white border border-dark-600',
    ghost: 'text-muted hover:text-white hover:bg-dark-700',
  };

  return (
    <button
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        styles[variant]
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, max = 100, className = '' }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={`w-full h-2 bg-dark-700 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-coral rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ScoreGauge({ score, size = 64 }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s) => {
    if (s >= 70) return '#4ADE80';
    if (s >= 50) return '#FBBF24';
    return '#F87171';
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size} viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="#2A2A2A" strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-score-fill"
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color: getColor(score) }}>
        {score}
      </span>
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children, wide }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-h-[85vh] overflow-y-auto shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center mb-4">
        <Icon size={28} className="text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-muted text-sm max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-dark-700 rounded ${className}`} />
  );
}
