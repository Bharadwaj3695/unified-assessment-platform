/**
 * TableSkeleton component rendering animated placeholder rows matching UAP table design.
 * Adapts to light/dark themes and customizable column counts.
 */
const TableSkeleton = ({ rows = 5, columns = 4, className = '', minWidth }) => {
  const calculatedMinWidth = minWidth || (columns > 3 ? `${Math.max(columns * 130, 520)}px` : '100%');
  return (
    <div
      className={`w-full overflow-x-auto rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-xs ${className}`}
      role="status"
      aria-label="Loading table data"
    >
      <div style={{ minWidth: calculatedMinWidth }}>
        {/* Header skeleton */}
        <div className="p-4 border-b border-surface-light-border dark:border-surface-dark-border bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex gap-4 items-center">
            {Array.from({ length: columns }).map((_, i) => (
              <div
                key={`th-skel-${i}`}
                className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse"
                style={{ width: `${100 / columns}%` }}
              />
            ))}
          </div>
        </div>

        {/* Row skeletons */}
        <div className="divide-y divide-surface-light-border dark:divide-surface-dark-border">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={`tr-skel-${r}`} className="p-4 flex gap-4 items-center">
              {Array.from({ length: columns }).map((_, c) => {
                const widthRatio = c === 0 ? '30%' : `${65 / (columns - 1)}%`;
                return (
                  <div
                    key={`td-skel-${r}-${c}`}
                    className="h-4 bg-slate-100 dark:bg-slate-700/60 rounded-md animate-pulse"
                    style={{ width: widthRatio }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TableSkeleton;
