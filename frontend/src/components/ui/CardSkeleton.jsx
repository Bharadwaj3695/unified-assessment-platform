import QuestionCardSkeleton from './QuestionCardSkeleton';

/**
 * CardSkeleton component for catalog items, question bank cards, and grid-based lists.
 * Supports variant="grid" (default) and variant="question".
 */
const CardSkeleton = ({ count = 3, variant = 'grid', className = '' }) => {
  if (variant === 'question') {
    return <QuestionCardSkeleton count={count} className={className} />;
  }

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 ${className}`}
      role="status"
      aria-label="Loading cards"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`card-skel-${i}`}
          className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border shadow-warm-xs animate-pulse space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-3/5 bg-slate-200 dark:bg-slate-700 rounded-md" />
            <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-md" />
            <div className="h-3.5 w-4/5 bg-slate-100 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex items-center justify-between">
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardSkeleton;
