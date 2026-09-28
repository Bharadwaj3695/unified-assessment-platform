import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';

const MobileDrawer = ({ isOpen, onClose }) => {
  const drawerRef = useRef(null);

  // Close on Escape key & Lock body scroll
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden flex"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className="relative flex flex-col w-72 max-w-[80vw] bg-white dark:bg-surface-dark shadow-warm-lg z-10 animate-in slide-in-from-left duration-200 h-full"
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-light-border dark:border-surface-dark-border bg-[#FCF8F3] dark:bg-surface-dark-muted">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-bold text-sm shadow-warm-xs">
              U
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Menu
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Sidebar className="w-full flex-1 border-r-0" onItemClick={onClose} />
      </div>
    </div>
  );
};

export default MobileDrawer;
