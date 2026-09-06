import React from 'react';
import Button from './Button';
import { AlertOctagon, RotateCcw } from 'lucide-react';

const ErrorState = ({
  title = 'Something went wrong',
  message = 'We encountered an issue retrieving data. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400 mb-4 shadow-warm-xs">
        <AlertOctagon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mb-5 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={RotateCcw} onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
