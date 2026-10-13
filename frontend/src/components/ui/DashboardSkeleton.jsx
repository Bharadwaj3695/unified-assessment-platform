/**
 * DashboardSkeleton component providing animated placeholder layouts for dashboards.
 * Matches stat card metrics and primary panel layouts without jarring layout shift.
 */
const DashboardSkeleton = ({ statCount = 4, className = '' }) => {
  return (
    <div className={`space-y-6 ${className}`} role="status" aria-label="Loading dashboard">
      {/* Stat cards placeholder grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: statCount }).map((_, i) => (
          <div
            key={`dash-stat-skel-${i}`}
            className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border shadow-warm-xs animate-pulse space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-md" />
              <div className="h-9 w-9 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            </div>
            <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
            <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main content grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left primary panel */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border shadow-warm-xs animate-pulse space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-5 w-44 bg-slate-200 dark:bg-slate-700 rounded-md" />
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        </div>

        {/* Right secondary panel */}
        <div className="p-6 rounded-2xl bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border shadow-warm-xs animate-pulse space-y-4">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={`dash-side-skel-${j}`}
                className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
