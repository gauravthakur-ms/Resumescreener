import { useState } from 'react';

function calcDuration(period) {
  if (!period) return null;
  const parts = period.split(/\s*[–—-]\s*/);
  if (parts.length < 2) return null;

  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const parse = (str) => {
    const s = str.trim().toLowerCase();
    // Handle "Nov2021" or "Nov 2021" or "November 2021"
    const match = s.match(/^([a-z]+)\s*(\d{4})$/);
    if (match) {
      const m = months.indexOf(match[1].slice(0, 3));
      const y = parseInt(match[2]);
      if (m !== -1 && !isNaN(y)) return { month: m, year: y };
    }
    // Fallback: try splitting by space
    const tokens = s.split(/\s+/);
    if (tokens.length >= 2) {
      const m = months.indexOf(tokens[0].slice(0, 3));
      const y = parseInt(tokens[tokens.length - 1]);
      if (m !== -1 && !isNaN(y)) return { month: m, year: y };
    }
    return null;
  };

  const start = parse(parts[0]);
  if (!start) return null;

  let end;
  const endStr = parts[1].trim().toLowerCase();
  if (endStr === 'present' || endStr === 'current' || endStr === 'now') {
    const now = new Date();
    end = { month: now.getMonth(), year: now.getFullYear() };
  } else {
    end = parse(parts[1]);
  }
  if (!end) return null;

  let totalMonths = (end.year - start.year) * 12 + (end.month - start.month);
  if (totalMonths < 0) return null;
  // Include the end month itself
  totalMonths += 1;

  const years = Math.floor(totalMonths / 12);
  const mos = totalMonths % 12;

  if (years === 0 && mos === 0) return null;
  if (years === 0) return `${mos} Month${mos !== 1 ? 's' : ''}`;
  if (mos === 0) return `${years} Year${years !== 1 ? 's' : ''}`;
  return `${years} Year${years !== 1 ? 's' : ''} ${mos} Month${mos !== 1 ? 's' : ''}`;
}

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
          {calcDuration(timelineInfo.period) && (
            <p className="text-[11px] text-coral font-semibold mb-0.5">
              Timeline: {calcDuration(timelineInfo.period)}
            </p>
          )}
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
