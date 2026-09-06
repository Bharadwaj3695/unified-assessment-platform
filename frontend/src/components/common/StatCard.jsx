import React from 'react';

const colorStyles = {
  primary: {
    iconBg: 'bg-[#FDF1EC] dark:bg-[#341C16]',
    iconText: 'text-[#E05D38] dark:text-[#F4A261]',
    border: 'hover:border-[#E05D38]/30',
  },
  terracotta: {
    iconBg: 'bg-[#FDF1EC] dark:bg-[#341C16]',
    iconText: 'text-[#E05D38] dark:text-[#F4A261]',
    border: 'hover:border-[#E05D38]/30',
  },
  peach: {
    iconBg: 'bg-[#FEF5ED] dark:bg-[#3C2413]',
    iconText: 'text-[#E7924F] dark:text-[#F4A261]',
    border: 'hover:border-[#F4A261]/40',
  },
  secondary: {
    iconBg: 'bg-[#F0F6FC] dark:bg-[#152336]',
    iconText: 'text-[#2563EB] dark:text-[#60A5FA]',
    border: 'hover:border-blue-300 dark:hover:border-blue-800',
  },
  sage: {
    iconBg: 'bg-[#EEF6F4] dark:bg-[#132B25]',
    iconText: 'text-[#3D8A78] dark:text-[#56BBA4]',
    border: 'hover:border-[#3D8A78]/30',
  },
  amber: {
    iconBg: 'bg-[#FFF8EC] dark:bg-[#36220B]',
    iconText: 'text-[#D97706] dark:text-[#FBBF24]',
    border: 'hover:border-amber-300 dark:hover:border-amber-800',
  },
  neutral: {
    iconBg: 'bg-[#F8F5F0] dark:bg-slate-800',
    iconText: 'text-slate-600 dark:text-slate-300',
    border: 'hover:border-slate-300 dark:hover:border-slate-700',
  },
};

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
  trend,
  trendType = 'up', // 'up' | 'down' | 'neutral'
  className = '',
}) => {
  const currentStyle = colorStyles[color] || colorStyles.primary;

  return (
    <div
      className={`rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all duration-150 ${currentStyle.border} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {value}
          </p>
        </div>

        {Icon && (
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${currentStyle.iconBg} ${currentStyle.iconText}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3.5 flex items-center space-x-2 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center font-semibold px-1.5 py-0.5 rounded-md ${
                trendType === 'up'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : trendType === 'down'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {trend}
            </span>
          )}
          {subtitle && (
            <span className="text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
