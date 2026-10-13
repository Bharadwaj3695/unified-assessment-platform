/**
 * ChartSkeleton component rendering chart-shaped animated placeholders.
 * Eliminates layout shifts and replaces unrelated circular spinners with authentic chart silhouettes.
 */
const ChartSkeleton = ({ height = 240, type = 'bar', className = '' }) => {
  return (
    <div
      className={`w-full rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-4 sm:p-5 shadow-warm-xs animate-pulse flex flex-col justify-between ${className}`}
      style={{ height }}
      role="status"
      aria-label="Loading analytics chart"
    >
      {/* Top Header Placeholder */}
      <div className="flex justify-between items-center mb-4">
        <div className="space-y-1.5">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded-md" />
        </div>
        <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>

      {type === 'donut' ? (
        /* Donut Chart Skeleton */
        <div className="flex-1 flex items-center justify-center relative my-2">
          <div className="w-36 h-36 rounded-full border-8 border-slate-200 dark:border-slate-700/60 flex items-center justify-center">
            <div className="space-y-1 text-center">
              <div className="h-5 w-12 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
              <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
            </div>
          </div>
        </div>
      ) : (
        /* Bar / Area Chart Body Skeleton */
        <div className="flex-1 flex items-end justify-between gap-3 px-2 pb-3 border-b border-l border-slate-200 dark:border-slate-700/80">
          <div className="w-1/7 bg-slate-200/90 dark:bg-slate-700/60 rounded-t h-[42%]" />
          <div className="w-1/7 bg-slate-200/90 dark:bg-slate-700/60 rounded-t h-[68%]" />
          <div className="w-1/7 bg-slate-200/90 dark:bg-slate-700/60 rounded-t h-[52%]" />
          <div className="w-1/7 bg-slate-200/90 dark:bg-slate-700/60 rounded-t h-[84%]" />
          <div className="w-1/7 bg-slate-200/90 dark:bg-slate-700/60 rounded-t h-[61%]" />
          <div className="w-1/7 bg-slate-200/90 dark:bg-slate-700/60 rounded-t h-[93%]" />
          <div className="w-1/7 bg-slate-200/90 dark:bg-slate-700/60 rounded-t h-[75%]" />
        </div>
      )}

      {/* Axis Labels Placeholder */}
      <div className="flex justify-between items-center mt-3 pt-1">
        <div className="h-2.5 w-10 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-2.5 w-10 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-2.5 w-10 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-2.5 w-10 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-2.5 w-10 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    </div>
  );
};

export default ChartSkeleton;
