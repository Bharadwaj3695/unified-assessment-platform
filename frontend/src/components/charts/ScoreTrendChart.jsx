import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../../hooks/useTheme';

const ScoreTrendChart = ({ data = [], height = 260 }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!data || data.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-surface-dark/50 text-slate-400 text-xs text-center p-6"
        style={{ height }}
      >
        <span className="font-semibold mb-1">No Assessment Trends Recorded</span>
        <span>Complete at least 2 assessments to view your performance trend.</span>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-surface-dark/50 text-slate-400 text-xs text-center p-6"
        style={{ height }}
      >
        <span className="font-semibold mb-1">Insufficient Trend History</span>
        <span>Complete at least 2 assessments to view your performance trend.</span>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-3 shadow-lg text-xs space-y-1">
          <p className="font-bold text-slate-900 dark:text-slate-100">{item.assessmentTitle}</p>
          <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <span>{item.date}</span>
            <span>·</span>
            <span className="font-medium text-brand-terracotta">{item.category}</span>
          </div>
          <div className="pt-1 border-t border-surface-light-border dark:border-surface-dark-border flex items-center justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">Score:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {item.percentage}% ({item.score} / {item.totalPoints})
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">Passing Threshold:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {item.passingScore ?? 60}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">Result:</span>
            <span
              className={`font-semibold ${
                item.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              }`}
            >
              {item.passed ? 'Passed' : 'Needs Review'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E05D38" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#E05D38" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={isDark ? '#283547' : '#EBE3D8'}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
          />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="percentage"
            stroke="#E05D38"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#scoreGradient)"
            activeDot={{ r: 5, fill: '#E05D38', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreTrendChart;
