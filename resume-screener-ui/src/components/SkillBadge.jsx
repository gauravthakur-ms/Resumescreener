import { useState } from 'react';

export default function SkillBadge({ skill, matched, variant = 'primary', timeline }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const timelineInfo = timeline?.[skill.toLowerCase()];

  const baseClasses = 'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium relative cursor-default';
  const colorClasses = variant === 'primary'
    ? matched
      ? 'bg-coral/10 text-coral border border-coral/20'
      : 'bg-red-500/5 text-red-400/60 border border-red-500/10 line-through decoration-red-400/40'
    : matched
      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      : 'bg-blue-500/5 text-blue-400/50 border border-blue-500/10 line-through decoration-blue-400/40';

  return (
    <span
      className={`${baseClasses} ${colorClasses}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className={`text-[10px] ${matched ? 'text-green-400' : 'text-red-400/60'}`}>
        {matched ? '✓' : '✕'}
      </span>
      {skill}

      {showTooltip && timelineInfo && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 whitespace-nowrap pointer-events-none">
          <p className="text-[11px] text-white font-medium mb-0.5">
            Last used: {timelineInfo.period}
          </p>
          <p className="text-[10px] text-muted">
            Project: {timelineInfo.project}
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-dark-800 border-r border-b border-dark-600 rotate-45" />
        </div>
      )}
    </span>
  );
}
