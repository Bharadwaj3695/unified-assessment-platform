import { useState, useEffect, useCallback, useRef } from 'react';
import { Megaphone, X } from 'lucide-react';
import announcementService from '../../services/announcement.service';

/**
 * NavbarAnnouncementTicker
 * Application-wide scrolling marquee announcement ticker positioned inside the global top navbar,
 * between the brand logo section and the global search box.
 * 
 * Features:
 * - Real-time MongoDB persistence and server-authoritative time evaluation.
 * - Auto-expires at exact expiry timestamp without full page reload.
 * - Pauses scrolling on mouse hover and keyboard focus.
 * - Respects prefers-reduced-motion media query.
 * - Per-session dismissal saved in sessionStorage.
 * - Reacts immediately to 'uap_announcement_updated' events emitted by admin mutations.
 * - Renders null when no announcement is active to preserve clean layout spacing.
 */
const NavbarAnnouncementTicker = () => {
  const [announcement, setAnnouncement] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const expiryTimerRef = useRef(null);
  const scheduleTimerRef = useRef(null);

  // Fetch active announcement from server
  const fetchActive = useCallback(async () => {
    try {
      const res = await announcementService.getActive();
      const payload = res?.data || res;
      if (res?.success !== false && payload?.active && payload.announcement) {
        const item = payload.announcement;
        const dismissalKey = `uap_dismissed_announcement_${item.id || item._id}_${encodeURIComponent(item.message || '')}`;
        const alreadyDismissed = typeof window !== 'undefined' && sessionStorage.getItem(dismissalKey) === 'true';

        // Check server-side expiry timestamp with clock skew correction
        const now = new Date(payload.serverTime || Date.now()).getTime();
        const expiry = new Date(item.expiryDate).getTime();

        if (expiry && now >= expiry) {
          setAnnouncement(null);
          return;
        }

        setAnnouncement(item);
        setIsDismissed(alreadyDismissed);

        // Schedule timer to automatically hide ticker at exact expiry timestamp
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
        // If an upcoming scheduled announcement exists, wake up automatically when it becomes active
        if (payload?.nextScheduledStart) {
          const serverNow = new Date(payload.serverTime || Date.now()).getTime();
          const start = new Date(payload.nextScheduledStart).getTime();
          const clockSkew = serverNow - Date.now();
          const timeUntilStart = start - (Date.now() + clockSkew);
          if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
          if (timeUntilStart > 0 && timeUntilStart < 0x7FFFFFFF) {
            scheduleTimerRef.current = setTimeout(() => {
              fetchActive();
            }, timeUntilStart);
          }
        }
      }
    } catch {
      // Gracefully swallow network errors to prevent disrupting navigation bar
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

    // Cross-tab broadcast listener for instant cross-tab synchronization
    let channel = null;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        channel = new BroadcastChannel('uap_announcement_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'UAP_ANNOUNCEMENT_UPDATED') {
            fetchActive();
          }
        };
      }
    } catch {}

    // Periodic safety sync every 60 seconds
    const interval = setInterval(fetchActive, 60000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('uap_announcement_updated', handleCustomUpdate);
      if (channel) {
        try { channel.close(); } catch {}
      }
      clearInterval(interval);
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
    };
  }, [fetchActive]);

  // Handle user dismissal for the current browser session
  const handleDismiss = () => {
    const announcementId = announcement?.id || announcement?._id;
    if (announcementId && typeof window !== 'undefined') {
      sessionStorage.setItem(`uap_dismissed_announcement_${announcementId}_${encodeURIComponent(announcement.message || '')}`, 'true');
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
      className="flex-1 min-w-0 mx-1 xs:mx-2 sm:mx-4 overflow-hidden flex items-center justify-center"
    >
      <div className="w-full max-w-xs xs:max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl flex items-center bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-full px-2 sm:px-3 py-1 shadow-xs transition-colors duration-200 min-w-0 overflow-hidden">
        {/* Badge identifier & icon */}
        <div className="flex items-center space-x-1.5 flex-shrink-0 mr-2">
          <span className="inline-flex items-center justify-center p-1 rounded-full bg-amber-200/70 dark:bg-amber-900/70 text-amber-800 dark:text-amber-300">
            <Megaphone className="w-3 h-3 animate-pulse" aria-hidden="true" />
          </span>
          <span className="hidden md:inline-block font-bold tracking-wide uppercase text-[9px] px-1.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 font-sans">
            Notice
          </span>
        </div>

        {/* Marquee viewport container with pause-on-hover & pause-on-focus */}
        <div className="flex-1 min-w-0 overflow-hidden relative cursor-default pause-on-hover group">
          <div className="animate-marquee font-medium text-xs tracking-normal text-slate-800 dark:text-amber-100 select-text whitespace-nowrap">
            <span>{announcement.message}</span>
            {/* Subtle separator and repetition for continuous marquee reading */}
            <span className="mx-8 text-amber-500/80 dark:text-amber-400/80 font-bold" aria-hidden="true">•</span>
            <span aria-hidden="true" className="ticker-loop-copy">{announcement.message}</span>
          </div>
        </div>

        {/* Session dismissal button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss announcement for this session"
          className="flex-shrink-0 ml-2 p-0.5 rounded-full text-amber-700/70 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default NavbarAnnouncementTicker;
