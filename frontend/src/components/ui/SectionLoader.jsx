import Spinner from './Spinner';

/**
 * Standard SectionLoader component for independent panels, cards, and tab contents.
 */
const SectionLoader = ({ message = 'Loading...', minHeight = 'min-h-[220px]', className = '' }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 ${minHeight} w-full rounded-2xl bg-white/60 dark:bg-surface-dark/60 backdrop-blur-xs transition-colors ${className}`}
      role="status"
      aria-live="polite"
    >
      <Spinner size="md" className="text-brand-primary" />
      {message && (
        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
};

export default SectionLoader;
