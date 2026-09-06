import React from 'react';

const Card = ({
  children,
  title,
  subtitle,
  action,
  footer,
  className = '',
  hoverEffect = false,
  ...props
}) => {
  return (
    <div
      className={`rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-xs transition-all duration-150 ${
        hoverEffect ? 'hover:shadow-warm-md hover:border-brand-peach/40 dark:hover:border-slate-700' : ''
      } ${className}`}
      {...props}
    >
      {(title || action || subtitle) && (
        <div className="flex items-start justify-between border-b border-surface-light-border dark:border-surface-dark-border px-5 py-4">
          <div>
            {title && (
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="ml-4 flex-shrink-0">{action}</div>}
        </div>
      )}

      <div className="p-5 sm:p-6">{children}</div>

      {footer && (
        <div className="border-t border-surface-light-border dark:border-surface-dark-border bg-[#FCF8F3] dark:bg-surface-dark-muted/60 px-5 py-3.5 rounded-b-2xl">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
