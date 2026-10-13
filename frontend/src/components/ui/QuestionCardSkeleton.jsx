/**
 * QuestionCardSkeleton component providing faithful placeholder cards for the Question Bank.
 * Accurately mirrors metadata badges, question prompt, MCQ option previews, tags,
 * and the desktop horizontal action button alignment without layout shift.
 */
const QuestionCardSkeleton = ({ count = 3, className = '' }) => {
  return (
    <div
      className={`space-y-3 ${className}`}
      role="status"
      aria-label="Loading question bank items"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`q-skel-${i}`}
          className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border shadow-warm-xs animate-pulse"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            {/* Question Content Skeleton */}
            <div className="space-y-2.5 flex-1 min-w-0 pr-0 md:pr-4">
              {/* Metadata Badges Placeholder */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-5 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>

              {/* Question Text Placeholder */}
              <div className="space-y-2 pt-1">
                <div className="h-4.5 w-5/6 bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div className="h-4 w-3/5 bg-slate-100 dark:bg-slate-800 rounded-md" />
              </div>

              {/* MCQ Options Placeholder Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {Array.from({ length: 4 }).map((_, optIdx) => (
                  <div
                    key={`opt-skel-${optIdx}`}
                    className="h-7 bg-slate-100 dark:bg-slate-800/60 rounded-md"
                  />
                ))}
              </div>

              {/* Tags Placeholder */}
              <div className="flex items-center gap-1.5 pt-1">
                <div className="h-4 w-14 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-4 w-18 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>

            {/* Horizontal Action Area Skeleton matching desktop alignment */}
            <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 w-full md:w-auto">
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl" />
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-xl" />
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuestionCardSkeleton;
