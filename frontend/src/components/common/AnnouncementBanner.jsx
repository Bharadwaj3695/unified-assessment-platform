import { useState, useEffect, useCallback, useRef } from 'react';
import { Megaphone, X } from 'lucide-react';
import announcementService from '../../services/announcement.service';

/**
 * AnnouncementBanner
 * Application-wide scrolling marquee announcement banner.
 * Displays persistent, scheduled announcements authorized by platform administrators.
 * Respects prefers-reduced-motion, pauses on hover/focus, handles real-time expiry,
 * and allows per-session dismissal without altering authoritative global state.
 */
const AnnouncementBanner = () => {
  const [announcement, setAnnouncement] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const expiryTimerRef = useRef(null);

  // Fetch active announcement from server
  const fetchActive = useCallback(async () => {
    try {
      const res = await announcementService.getActive();
      const payload = res?.data || res;
      if (res?.success !== false && payload?.active && payload.announcement) {
        const item = payload.announcement;
        const dismissalKey = `uap_dismissed_announcement_${item.id || item._id}`;
        const alreadyDismissed = typeof window !== 'undefined' && sessionStorage.getItem(dismissalKey) === 'true';

        // Check if server-side expiryDate is already passed with clock skew correction
        const now = new Date(payload.serverTime || Date.now()).getTime();
        const expiry = new Date(item.expiryDate).getTime();

        if (expiry && now >= expiry) {
          setAnnouncement(null);
          return;
        }

        setAnnouncement(item);
        setIsDismissed(alreadyDismissed);

        // Schedule timer to automatically hide banner at exact expiry timestamp
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
        const clockSkew = now - Date.now();
        const remainingMs = expiry - (Date.now() + clockSkew);
        if (remainingMs > 0 && remainingMs < 0x7FFFFFFF) {
          expiryTimerRef.current = setTimeout(() => {
            fetchActive();
          }, remainingMs);
        }
      } else {
        setAnnouncement(null);
      }
    } catch {
      // Gracefully swallow network/auth errors for announcement banner
      setAnnouncement(null);
    }
  }, []);

  useEffect(() => {
    fetchActive();

    // Re-verify active announcement on window focus and visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchActive();
      }
    };

    // Listen for custom broadcast updates dispatched when an admin modifies announcements
    const handleCustomUpdate = () => {
      fetchActive();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('uap_announcement_updated', handleCustomUpdate);

    // Periodic safety check every 90 seconds
    const interval = setInterval(fetchActive, 90000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('uap_announcement_updated', handleCustomUpdate);
      clearInterval(interval);
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [fetchActive]);

  // Handle user dismissal for the current browser session
  const handleDismiss = () => {
    if (announcement?.id) {
      sessionStorage.setItem(`uap_dismissed_announcement_${announcement.id}`, 'true');
    }
    setIsDismissed(true);
  };

  // Zero layout shift if no active announcement or if user dismissed in this session
  if (!announcement || isDismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Platform Announcement"
      className="relative z-30 flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 text-xs border-b transition-colors duration-200 bg-amber-50/95 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 shadow-sm"
    >
      {/* Badge identifier & icon */}
      <div className="flex items-center space-x-2 flex-shrink-0 mr-3">
        <span className="inline-flex items-center justify-center p-1 rounded-md bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
          <Megaphone className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
        </span>
        <span className="hidden sm:inline-block font-bold tracking-wide uppercase text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 font-sans">
          Announcement
        </span>
      </div>

      {/* Marquee viewport container with pause-on-hover & pause-on-focus */}
      <div className="flex-1 min-w-0 overflow-hidden relative cursor-default pause-on-hover group">
        <div className="animate-marquee font-medium tracking-normal text-slate-800 dark:text-amber-100/95 select-text">
          <span>{announcement.message}</span>
          {/* Subtle separator and repetition for continuous marquee reading */}
          <span className="mx-8 text-amber-400 dark:text-amber-600 font-bold" aria-hidden="true">•</span>
          <span aria-hidden="true" className="ticker-loop-copy">{announcement.message}</span>
        </div>
      </div>

      {/* Session dismissal button */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss announcement for this session"
        className="flex-shrink-0 ml-3 p-1 rounded-md text-amber-700 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default AnnouncementBanner;
