import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useTheme } from '../../hooks/useTheme';

const ScoreTrendChart = ({ data = [], height = 260 }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Process data for the ScatterChart
  const processedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => typeof item?.percentage === 'number' && !isNaN(item.percentage))
      .map((item, index) => {
        let displayDate = item.date;
        if (item.timestamp) {
          try {
            const d = new Date(item.timestamp);
            displayDate = d.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
          } catch (_) {}
        }
        return {
          ...item,
          displayDate: displayDate || item.date || `#${index + 1}`,
          // Unique label or identifier for tooltips and categorical axes
          pointLabel: `${item.assessmentTitle || 'Assessment'} (${displayDate || item.date || index + 1})`,
        };
      });
  }, [data]);

  if (!data || data.length === 0 || processedData.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-surface-dark/50 text-slate-400 text-xs text-center p-6"
        style={{ height }}
      >
        <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-1">
          No Evaluated Assessments Yet
        </span>
        <span className="max-w-xs text-slate-500 dark:text-slate-400">
          Complete assessments and receive evaluation feedback to view your performance scatter trend.
        </span>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const isPassed = Boolean(item.passed);
      return (
        <div className="rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-3.5 shadow-xl text-xs space-y-2 min-w-[210px] z-50">
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
              {item.assessmentTitle || 'Assessment'}
            </p>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] mt-1">
              <span>{item.date || item.displayDate}</span>
              <span>·</span>
              <span className="font-medium text-brand-terracotta dark:text-amber-400">
                {item.category || 'General'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-surface-light-border dark:border-surface-dark-border space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Score:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {item.score !== undefined && item.score !== null ? item.score : '—'} /{' '}
                {item.totalPoints ?? 100}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Percentage:</span>
              <span className="font-bold text-brand-terracotta dark:text-amber-400">
                {item.percentage}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Passing Threshold:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {item.passingScore ?? 60}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-slate-500 dark:text-slate-400">Outcome:</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isPassed
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {isPassed ? 'Passed' : 'Failed'}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col" style={{ height }}>
      {/* Legend toolbar */}
      <div className="flex items-center justify-end gap-4 pb-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block shadow-sm" />
          <span>Passed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] inline-block shadow-sm" />
          <span>Failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-slate-400 inline-block" />
          <span>Pass Line (60%)</span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? '#283547' : '#EBE3D8'}
            />
            <XAxis
              dataKey="displayDate"
              type="category"
              allowDuplicatedCategory={true}
              tickLine={false}
              axisLine={false}
              tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
            />
            <YAxis
              dataKey="percentage"
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 60, 75, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
              tickFormatter={(val) => `${val}%`}
            />
            <ReferenceLine
              y={60}
              stroke={isDark ? '#64748B' : '#94A3B8'}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: '3 3', stroke: isDark ? '#475569' : '#CBD5E1' }}
            />
            <Scatter
              name="Evaluated Assessments"
              data={processedData}
              animationDuration={500}
            >
              {processedData.map((entry, index) => {
                const isPassed = Boolean(entry.passed);
                return (
                  <Cell
                    key={`cell-${entry.id || index}`}
                    fill={isPassed ? '#10B981' : '#EF4444'}
                    stroke={isDark ? '#1E293B' : '#FFFFFF'}
                    strokeWidth={2}
                    r={6}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ScoreTrendChart;
