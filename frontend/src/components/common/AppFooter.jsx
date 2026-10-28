const AppFooter = ({ className = '' }) => {
  return (
    <footer
      data-testid="app-footer"
      className={`mt-auto border-t border-surface-light-border dark:border-surface-dark-border bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xs transition-colors duration-150 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-xs text-slate-500 dark:text-slate-400">
        <p className="text-center sm:text-left">
          © {new Date().getFullYear()} Unified Assessment Platform (UAP). All rights reserved.
        </p>
        <p className="flex flex-wrap items-center justify-center sm:justify-end gap-x-2 gap-y-0.5 text-center sm:text-right">
          <span>Academic & Technical Evaluation Suite</span>
          <span>·</span>
          <span className="font-medium text-brand-terracotta dark:text-brand-peach">Production Grade</span>
        </p>
      </div>
    </footer>
  );
};

export default AppFooter;
