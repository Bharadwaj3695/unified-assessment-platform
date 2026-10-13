import { useState, useEffect, useRef } from 'react';
import Spinner from './Spinner';
import Badge from './Badge';

/**
 * Standard & Branded PageLoader component for route-level, full-screen,
 * application-entry, and post-login loading transitions.
 * Supports light and dark modes with customizable message, branding, and minimum duration contracts.
 */
const PageLoader = ({
  message = 'Loading...',
  subtitle = 'EdTech Academic & Institutional Suite',
  fullScreen = false,
  branded = false,
  minDuration = 0,
  user = null,
  role = null,
  onComplete = null,
  className = '',
}) => {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completedRef = useRef(false);

  const roleLabel =
    role === 'admin'
      ? 'System Administration'
      : role === 'instructor'
      ? 'Instructor Studio'
      : role === 'student'
      ? 'Student Workspace'
      : 'Institutional Portal';

  useEffect(() => {
    if (!minDuration || minDuration <= 0) return;

    completedRef.current = false;
    startTimeRef.current = Date.now();
    const intervalMs = 50;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, Math.round((elapsed / minDuration) * 100));
      setProgress(pct);

      if (elapsed >= minDuration && !completedRef.current) {
        completedRef.current = true;
        clearInterval(timer);
        if (typeof onCompleteRef.current === 'function') {
          onCompleteRef.current();
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [minDuration]);

  // Derive phase message dynamically across the duration if branded
  const getPhaseMessage = () => {
    if (!branded || !minDuration) return message;
    if (progress < 25) return 'Establishing secure cryptographic session...';
    if (progress < 50) return 'Verifying institutional role permissions...';
    if (progress < 75) return 'Synchronizing academic workspace...';
    if (progress < 98) return `Preparing ${roleLabel}...`;
    return 'Workspace ready. Redirecting...';
  };

  if (branded) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#FFF9F2] via-white to-[#EEF6F4] dark:from-[#1A202C] dark:via-[#12161F] dark:to-[#1A202C] transition-colors duration-200 select-none ${
          fullScreen ? 'fixed inset-0 z-50 min-h-screen' : 'min-h-[70vh] w-full rounded-3xl'
        } ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="max-w-md w-full mx-auto flex flex-col items-center text-center space-y-6">
          {/* Branded Logo with orbital pulse ring */}
          <div className="relative flex items-center justify-center">
            {/* Outer halo */}
            <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-brand-terracotta/15 dark:bg-brand-terracotta/25 animate-ping motion-reduce:animate-none" />
            <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-brand-peach/20 dark:bg-brand-peach/30 animate-pulse motion-reduce:animate-none" />

            {/* Platform Emblem */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-warm-md">
              U
            </div>
          </div>

          {/* Institutional Title & Role Tag */}
          <div className="space-y-1.5">
            <Badge variant="terracotta" size="sm" dot className="mb-1">
              {roleLabel}
            </Badge>
            <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
              Unified Assessment Platform
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user?.name ? `Welcome, ${user.name} · ${subtitle}` : subtitle}
            </p>
          </div>

          {/* Phase Status Message & Spinner */}
          <div className="w-full space-y-3 pt-2">
            <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Spinner size="sm" className="text-brand-terracotta" />
              <span>{getPhaseMessage()}</span>
            </div>

            {/* Progress Bar (if minDuration applied) */}
            {minDuration > 0 && (
              <div className="w-full max-w-xs mx-auto space-y-1">
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-terracotta to-brand-peach rounded-full transition-all duration-100 ease-out motion-reduce:transition-none"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  <span>Initializing</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 bg-bg-light dark:bg-bg-dark transition-colors duration-200 ${
        fullScreen ? 'fixed inset-0 z-50 min-h-screen' : 'min-h-[60vh] w-full'
      } ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex items-center justify-center">
        {/* Subtle decorative pulse ring */}
        <div className="absolute w-16 h-16 rounded-full bg-brand-primary/10 dark:bg-brand-primary/20 animate-ping motion-reduce:animate-none" />
        <Spinner size="lg" className="text-brand-primary relative" />
      </div>

      {message && (
        <p className="mt-5 text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default PageLoader;
