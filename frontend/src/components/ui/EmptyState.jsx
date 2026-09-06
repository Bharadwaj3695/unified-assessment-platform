import React from 'react';
import Button from './Button';
import { EmptyStateIllustration } from '../illustrations';

const EmptyState = ({
  illustration: Illustration = EmptyStateIllustration,
  icon: Icon,
  title = 'No items found',
  description = 'There are no records to display at this moment.',
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-2xl border border-dashed border-[#EBE3D8] dark:border-slate-700 bg-white/70 dark:bg-surface-dark/40 ${className}`}
    >
      <div className="mb-4">
        {Icon ? (
          <div className="w-14 h-14 rounded-2xl bg-[#FDF1EC] dark:bg-[#341C16] flex items-center justify-center text-[#E05D38]">
            <Icon className="w-7 h-7" />
          </div>
        ) : (
          <Illustration className="w-24 h-24 mx-auto" />
        )}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
