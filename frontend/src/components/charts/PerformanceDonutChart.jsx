import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '../../hooks/useTheme';

const PerformanceDonutChart = ({
  data = [
    { name: 'Mastered (>=85%)', value: 8, color: '#3D8A78' },
    { name: 'Proficient (70-84%)', value: 4, color: '#3B82F6' },
    { name: 'Needs Review (<70%)', value: 2, color: '#E05D38' },
  ],
  centerMetric = '86.4%',
  centerLabel = 'Avg Score',
  height = 240,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-surface-light dark:bg-surface-dark px-3 py-2 shadow-lg text-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: item.payload.color }}
            />
            {item.name}
          </p>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {item.value} Assessments ({item.payload.percent ? Math.round(item.payload.percent * 100) : item.value}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="90%"
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke={isDark ? '#18202C' : '#FFFFFF'}
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Centered Readout Metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {centerMetric}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {centerLabel}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-surface-light-border dark:border-surface-dark-border text-xs">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center space-x-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">({item.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceDonutChart;
