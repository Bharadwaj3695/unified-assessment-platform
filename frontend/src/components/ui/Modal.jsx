import { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZE_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-6xl',
};

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  size,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolvedMaxWidth = (size && SIZE_MAP[size]) || maxWidth || 'max-w-md';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        className={`relative z-10 w-full ${resolvedMaxWidth} max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-surface-light dark:bg-surface-dark p-4 sm:p-6 shadow-xl transition-all animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-surface-light-border dark:border-surface-dark-border">
          {title && (
            <h3 id="modal-title" className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate pr-2">
              {title}
            </h3>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto py-3 sm:py-4 text-sm text-slate-700 dark:text-slate-300">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
