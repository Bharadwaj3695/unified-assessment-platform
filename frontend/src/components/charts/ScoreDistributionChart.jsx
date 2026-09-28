import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTheme } from '../../hooks/useTheme';

const BUCKET_COLORS = ['#EF4444', '#F97316', '#FBBF24', '#3B82F6', '#10B981'];

const ScoreDistributionChart = ({ data = [], height = 240 }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const defaultData = [
    { bucket: '0–20', count: 0 },
    { bucket: '21–40', count: 0 },
    { bucket: '41–60', count: 0 },
    { bucket: '61–80', count: 0 },
    { bucket: '81–100', count: 0 },
  ];

  const chartData = data && data.length > 0 ? data : defaultData;
  const totalSubmissions = chartData.reduce((acc, curr) => acc + (curr.count || 0), 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct =
        totalSubmissions > 0
          ? Math.round((item.count / totalSubmissions) * 100)
          : 0;
      return (
        <div className="rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark px-3.5 py-2 shadow-lg text-xs space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-slate-100">Score Range: {item.bucket}%</p>
          <p className="text-slate-600 dark:text-slate-300">
            Students: <strong className="text-brand-terracotta">{item.count}</strong> ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? '#283547' : '#EBE3D8'}
            />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={45}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={BUCKET_COLORS[index % BUCKET_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Buckets Legend */}
      <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 pt-2 border-t border-surface-light-border dark:border-surface-dark-border text-[11px]">
        {chartData.map((item, idx) => (
          <div key={idx} className="flex items-center space-x-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: BUCKET_COLORS[idx % BUCKET_COLORS.length] }}
            />
            <span className="text-slate-600 dark:text-slate-400">{item.bucket}%:</span>
            <strong className="text-slate-800 dark:text-slate-200">{item.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoreDistributionChart;
