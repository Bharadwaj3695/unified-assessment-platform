// Import React core library and hooks for lifecycle effects and DOM element references
import { useEffect, useRef } from 'react';
// Import X close icon from lucide-react
import { X } from 'lucide-react';
// Import desktop/mobile Sidebar navigation menu component
import Sidebar from './Sidebar';

// Slide-out navigation drawer component tailored for mobile and small viewport devices
const MobileDrawer = ({ isOpen, onClose }) => {
  // DOM element reference to drawer panel container
  const drawerRef = useRef(null);

  // Close on Escape key & Lock body scroll
  // Effect attaching keyboard listener for Escape key and locking background document scroll while drawer is open
  useEffect(() => {
    // Keydown event handler function
    const handleKeyDown = (e) => {
      // Check if pressed key is Escape
      if (e.key === 'Escape') {
        // Trigger drawer close handler
        onClose();
      }
    };

    // If drawer is currently open
    if (isOpen) {
      // Listen for window keydown events to detect Escape key
      window.addEventListener('keydown', handleKeyDown);
      // Lock page body vertical scrolling to prevent background scroll
      document.body.style.overflow = 'hidden';
    // If drawer is closed
    } else {
      // Restore normal page scroll behavior
      document.body.style.overflow = '';
    }

    // Teardown cleanup function
    return () => {
      // Detach keydown event listener
      window.removeEventListener('keydown', handleKeyDown);
      // Restore body scroll behavior
      document.body.style.overflow = '';
    };
  // Re-run effect when open state or close callback changes
  }, [isOpen, onClose]);

  // If drawer is closed, render nothing
  if (!isOpen) return null;

  // Render modal drawer markup
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
        {/* Drawer header displaying brand insignia and close icon button */}
        <div className="flex items-center justify-between p-4 border-b border-surface-light-border dark:border-surface-dark-border bg-[#FCF8F3] dark:bg-surface-dark-muted">
          {/* Logo badge and title group */}
          <div className="flex items-center space-x-2.5">
            {/* Brand initial badge */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-bold text-sm shadow-warm-xs">
              U
            </div>
            {/* Header label */}
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Menu
            </span>
          </div>
          {/* Close button with accessible label */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            aria-label="Close menu"
          >
            {/* Lucide X icon */}
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded Sidebar navigation hierarchy with automatic close on link click */}
        <Sidebar className="w-full flex-1 border-r-0" onItemClick={onClose} />
      </div>
    </div>
  );
};

// Export MobileDrawer component
export default MobileDrawer;
