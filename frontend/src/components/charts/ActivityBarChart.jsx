import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../../hooks/useTheme';

const ActivityBarChart = ({
  data = [
    { name: 'Mon', submissions: 12, passes: 10 },
    { name: 'Tue', submissions: 18, passes: 16 },
    { name: 'Wed', submissions: 24, passes: 20 },
    { name: 'Thu', submissions: 15, passes: 14 },
    { name: 'Fri', submissions: 28, passes: 25 },
    { name: 'Sat', submissions: 9, passes: 8 },
    { name: 'Sun', submissions: 6, passes: 6 },
  ],
  height = 240,
  barKey = 'submissions',
  barLabel = 'Submissions',
  barColor = '#3B82F6',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-surface-light dark:bg-surface-dark px-3.5 py-2 shadow-lg text-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}: <span className="font-bold">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={isDark ? '#283547' : '#EBE3D8'}
          />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey={barKey}
            name={barLabel}
            fill={barColor}
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ActivityBarChart;
