import React from 'react';

const colorMap = {
  primary: 'bg-brand-primary',
  terracotta: 'bg-brand-terracotta',
  peach: 'bg-brand-peach',
  secondary: 'bg-brand-secondary',
  sage: 'bg-brand-sage',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  error: 'bg-red-600',
};

const ProgressBar = ({
  value = 0,
  max = 100,
  color = 'primary',
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const percentage = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
          <span>Progress</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div
        className={`w-full bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden ${
          heightClasses[size] || heightClasses.md
        }`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            colorMap[color] || colorMap.primary
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
