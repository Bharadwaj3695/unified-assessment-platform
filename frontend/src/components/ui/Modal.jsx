import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-md',
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        className={`relative z-10 w-full ${maxWidth} rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-surface-light dark:bg-surface-dark p-6 shadow-xl transition-all animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-surface-light-border dark:border-surface-dark-border">
          {title && (
            <h3 id="modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 text-sm text-slate-700 dark:text-slate-300">{children}</div>

        {footer && (
          <div className="pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex justify-end space-x-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
