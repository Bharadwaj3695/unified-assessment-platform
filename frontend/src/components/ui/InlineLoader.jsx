import Spinner from './Spinner';

/**
 * Compact, accessible inline loading indicator for tables, cards, widgets, and toolbars.
 * Prevents full-screen layout thrashing during background data synchronization and refresh.
 */
const InlineLoader = ({
  text = 'Refreshing...',
  size = 'sm',
  color = 'border-brand-primary',
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 ${className}`}
    >
      <Spinner size={size} color={color} />
      {text && <span>{text}</span>}
      <span className="sr-only">{text || 'Loading...'}</span>
    </div>
  );
};

export default InlineLoader;
