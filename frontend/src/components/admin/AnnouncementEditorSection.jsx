import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  Megaphone,
  Send,
  Save,
  Calendar,
  Clock,
  XCircle,
  AlertCircle,
  CheckCircle,
  Eye,
  Users,
} from 'lucide-react';
import Button from '../ui/Button';
import announcementService from '../../services/announcement.service';

/**
 * AnnouncementEditorSection
 * Comprehensive administrative management panel for persistent, scheduled,
 * and immediate application-wide broadcast announcements.
 */
const AnnouncementEditorSection = ({ onMessageSync = null, initialMessage = '' }) => {
  // Form fields
  const [message, setMessage] = useState(initialMessage || '');
  const [startMode, setStartMode] = useState('immediate'); // 'immediate' | 'scheduled'
  const [startDate, setStartDate] = useState('');
  const [durationDays, setDurationDays] = useState(0);
  const [durationHours, setDurationHours] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [targetAudience, setTargetAudience] = useState('all');

  // Server state & metadata
  const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
  const [serverTime, setServerTime] = useState(new Date().toISOString());
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);

  // Ref tracking whether initial form population has completed
  const isInitializedRef = useRef(false);

  // Action loading states (double-click prevention)
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState({});

  const isAnyActionLoading = isSavingDraft || isPublishing || isScheduling || isCancelling;

  // Load current announcement from backend (runs once on mount, or upon explicit action refresh)
  const loadCurrentAnnouncement = useCallback(async (isRefresh = false) => {
    try {
      setIsLoadingCurrent(true);
      const res = await announcementService.getCurrent();
      if (res?.success && res.data) {
        setServerTime(res.data.serverTime || new Date().toISOString());
        if (res.data.current) {
          const doc = res.data.current;
          setCurrentAnnouncement(doc);
          // Pre-populate fields on initial load only, or on explicit refresh
          if (!isInitializedRef.current || isRefresh) {
            setMessage(doc.message || '');
            if (doc.durationDays || doc.durationHours || doc.durationMinutes) {
              setDurationDays(doc.durationDays || 0);
              setDurationHours(doc.durationHours || 0);
              setDurationMinutes(doc.durationMinutes || 0);
            } else {
              setDurationDays(0);
              setDurationHours(2);
              setDurationMinutes(30);
            }
            if (doc.targetAudience) setTargetAudience(doc.targetAudience);
            if (doc.status === 'scheduled' && doc.startDate) {
              setStartMode('scheduled');
              // Format to YYYY-MM-DDTHH:mm
              const d = new Date(doc.startDate);
              const pad = (n) => String(n).padStart(2, '0');
              setStartDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
            }
            isInitializedRef.current = true;
          }
        } else {
          setCurrentAnnouncement(null);
          isInitializedRef.current = true;
        }
      }
    } catch {
      // Gracefully handle query failures
    } finally {
      setIsLoadingCurrent(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentAnnouncement();
  }, [loadCurrentAnnouncement]);

  // Set default scheduled date to tomorrow at 09:00 if empty
  useEffect(() => {
    if (!startDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const pad = (n) => String(n).padStart(2, '0');
      setStartDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`);
    }
  }, [startDate]);

  // Handle message change - single source of truth is local state; do not alter parent settings during drafting
  const handleMessageChange = (e) => {
    const val = e.target.value;
    setMessage(val);
    if (errors.message && val.trim().length > 0) {
      setErrors((prev) => ({ ...prev, message: null }));
    }
  };

  // Compute total duration in minutes
  const totalDurationMinutes = useMemo(() => {
    const d = parseInt(durationDays, 10) || 0;
    const h = parseInt(durationHours, 10) || 0;
    const m = parseInt(durationMinutes, 10) || 0;
    return (d * 24 * 60) + (h * 60) + m;
  }, [durationDays, durationHours, durationMinutes]);

  // Compute calculated expiry timestamp
  const computedExpiry = useMemo(() => {
    let effectiveStartMs = Date.now();
    if (startMode === 'scheduled' && startDate) {
      const parsed = new Date(startDate).getTime();
      if (!isNaN(parsed)) effectiveStartMs = parsed;
    }
    const expiryMs = effectiveStartMs + (totalDurationMinutes * 60 * 1000);
    return new Date(expiryMs);
  }, [startMode, startDate, totalDurationMinutes]);

  // Helper formatting for dates
  const formatDateTime = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return 'Invalid date';
    return dateObj.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  // Validation function
  const validateForm = (isDraft = false) => {
    const newErrors = {};
    if (!message.trim()) {
      newErrors.message = 'Announcement message is required.';
    } else if (message.trim().length > 500) {
      newErrors.message = 'Message cannot exceed 500 characters.';
    }

    if (!isDraft) {
      if (totalDurationMinutes <= 0) {
        newErrors.duration = 'Total duration must be greater than 0 minutes.';
      } else if (totalDurationMinutes > 365 * 24 * 60) {
        newErrors.duration = 'Duration cannot exceed 365 days.';
      }

      if (startMode === 'scheduled') {
        if (!startDate) {
          newErrors.startDate = 'Please specify a start date and time.';
        } else {
          const scheduledMs = new Date(startDate).getTime();
          if (isNaN(scheduledMs)) {
            newErrors.startDate = 'Invalid date format.';
          } else if (scheduledMs <= Date.now() - 30000) {
            newErrors.startDate = 'Scheduled start time must be in the future.';
          }
        }
      }
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      const firstError = Object.values(newErrors)[0];
      if (firstError) toast.error(firstError);
    }
    return isValid;
  };

  // Dispatch global banner refresh across app and browser tabs
  const notifyBannerUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('uap_announcement_updated'));
      try {
        if (window.BroadcastChannel) {
          const channel = new BroadcastChannel('uap_announcement_channel');
          channel.postMessage({ type: 'UAP_ANNOUNCEMENT_UPDATED', timestamp: Date.now() });
          channel.close();
        }
      } catch {}
    }
  };

  // Helper for consistent error presentation and field validation mapping
  const handleApiError = (err, fallbackMessage) => {
    if (err.errors && Array.isArray(err.errors)) {
      const fieldErrors = {};
      err.errors.forEach((e) => {
        if (e.path) fieldErrors[e.path] = e.msg;
      });
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
    }
    const isNotFound = err.status === 404 || err.response?.status === 404;
    const msg = isNotFound
      ? 'Announcement service endpoint was not found (404). Please ensure server routes are registered.'
      : err.response?.data?.message || err.message || fallbackMessage;
    toast.error(msg);
  };

  // 1. Action: Save Draft
  const handleSaveDraft = async () => {
    if (isAnyActionLoading) return;
    if (!validateForm(true)) return;
    const trimmedMessage = message.trim();
    try {
      setIsSavingDraft(true);
      await announcementService.saveDraft({
        id: currentAnnouncement?._id || currentAnnouncement?.id,
        message: trimmedMessage,
        targetAudience,
        durationDays: Number(durationDays) || 0,
        durationHours: Number(durationHours) || 0,
        durationMinutes: Number(durationMinutes) || 0,
      });
      toast.success('Announcement draft saved successfully.');
      notifyBannerUpdated();
      await loadCurrentAnnouncement(true);
    } catch (err) {
      handleApiError(err, 'Failed to save draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // 2. Action: Publish Immediately
  const handlePublishImmediate = async () => {
    if (isAnyActionLoading) return;
    if (!validateForm(false)) return;
    const trimmedMessage = message.trim();
    try {
      setIsPublishing(true);
      await announcementService.publishImmediate({
        id: currentAnnouncement?._id || currentAnnouncement?.id,
        message: trimmedMessage,
        durationDays: Number(durationDays) || 0,
        durationHours: Number(durationHours) || 0,
        durationMinutes: Number(durationMinutes) || 0,
        targetAudience,
      });
      toast.success('Announcement published immediately! It is now active across all viewports.');
      if (onMessageSync) onMessageSync(trimmedMessage);
      notifyBannerUpdated();
      await loadCurrentAnnouncement(true);
    } catch (err) {
      handleApiError(err, 'Failed to publish announcement.');
    } finally {
      setIsPublishing(false);
    }
  };

  // 3. Action: Schedule Announcement
  const handleSchedule = async () => {
    if (isAnyActionLoading) return;
    if (!validateForm(false)) return;
    const trimmedMessage = message.trim();
    try {
      setIsScheduling(true);
      await announcementService.schedule({
        id: currentAnnouncement?._id || currentAnnouncement?.id,
        message: trimmedMessage,
        startDate: new Date(startDate).toISOString(),
        durationDays: Number(durationDays) || 0,
        durationHours: Number(durationHours) || 0,
        durationMinutes: Number(durationMinutes) || 0,
        targetAudience,
      });
      toast.success(`Announcement scheduled for ${formatDateTime(new Date(startDate))}.`);
      notifyBannerUpdated();
      await loadCurrentAnnouncement(true);
    } catch (err) {
      handleApiError(err, 'Failed to schedule announcement.');
    } finally {
      setIsScheduling(false);
    }
  };

  // 4. Action: Cancel Announcement
  const handleCancel = async () => {
    if (isAnyActionLoading) return;
    try {
      setIsCancelling(true);
      await announcementService.cancel(currentAnnouncement?._id || currentAnnouncement?.id);
      toast.info('Announcement cancelled and removed from viewports.');
      if (onMessageSync) onMessageSync('');
      notifyBannerUpdated();
      await loadCurrentAnnouncement(true);
    } catch (err) {
      handleApiError(err, 'Failed to cancel announcement.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Determine current effective status badge
  const effectiveStatus = currentAnnouncement?.effectiveStatus || 'none';

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/60 dark:bg-surface-dark-muted/40 space-y-5 transition-colors">
      {/* Header and status badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-light-border dark:border-surface-dark-border">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              System-wide Announcement Management
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Authoritatively broadcast scheduled or immediate messages across Student, Instructor, and Admin workspaces.
            </p>
          </div>
        </div>

        {/* Dynamic Status Badge */}
        <div className="flex items-center space-x-2">
          {effectiveStatus === 'published' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active / Published
            </span>
          )}
          {effectiveStatus === 'scheduled' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
              <Calendar className="w-3.5 h-3.5" />
              Scheduled
            </span>
          )}
          {effectiveStatus === 'draft' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
              Draft (Hidden)
            </span>
          )}
          {effectiveStatus === 'expired' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <Clock className="w-3.5 h-3.5" />
              Expired
            </span>
          )}
          {effectiveStatus === 'cancelled' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
              <XCircle className="w-3.5 h-3.5" />
              Cancelled / Withdrawn
            </span>
          )}
          {effectiveStatus === 'none' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              No Active Announcement
            </span>
          )}
        </div>
      </div>

      {/* Live Preview Box */}
      <div data-testid="live-banner-preview" className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Eye className="w-3.5 h-3.5 text-brand-primary" />
            Live Scrolling Banner Preview
          </label>
          {message.trim() ? (
            currentAnnouncement?.effectiveStatus === 'published' && message.trim() === currentAnnouncement?.message ? (
              <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                Published (Live in Navbar)
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                Unsaved Draft Preview
              </span>
            )
          ) : (
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
              Empty Draft
            </span>
          )}
        </div>

        {message.trim() ? (
          <div className="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/30 p-2 sm:p-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wide uppercase text-[10px] px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 flex-shrink-0">
                Announcement
              </span>
              <div className="flex-1 min-w-0 overflow-hidden relative pause-on-hover cursor-default">
                <div className="animate-marquee font-medium text-xs text-slate-800 dark:text-amber-100">
                  <span>{message.trim()}</span>
                  <span className="mx-6 text-amber-400 font-bold" aria-hidden="true">•</span>
                  <span aria-hidden="true">{message.trim()}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 text-center space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              No announcement message entered — banner will remain hidden across viewports.
            </p>
            {currentAnnouncement?.effectiveStatus === 'published' && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                Currently published announcement: &quot;{currentAnnouncement.message}&quot; remains active until updated or cancelled.
              </p>
            )}
          </div>
        )}
        {message.trim() && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Ticker loops continuously in viewports. Persisted message content is stored once without duplication.
          </p>
        )}
      </div>

      {/* Announcement Message Textarea */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label htmlFor="announcementText" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Announcement Message <span className="text-red-500">*</span>
          </label>
          <span className={`text-[11px] font-medium ${message.length > 500 ? 'text-red-500 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
            {message.length} / 500
          </span>
        </div>
        <textarea
          id="announcementText"
          rows={3}
          value={message}
          onChange={handleMessageChange}
          placeholder="e.g. today holiday, or Scheduled maintenance this Sunday from 02:00 to 04:00 UTC. System may experience brief interruptions."
          className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition-colors ${
            errors.message
              ? 'border-red-500 focus:ring-red-400 bg-red-50/20 dark:bg-red-950/20'
              : 'border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark-muted focus:ring-brand-primary'
          } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2`}
        />
        {errors.message && (
          <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 mt-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.message}
          </p>
        )}
      </div>

      {/* Target Audience & Start Mode Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Audience Scope */}
        <div>
          <label htmlFor="announcementAudience" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            Target Audience Scope
          </label>
          <select
            id="announcementAudience"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">All Platform Users (Recommended)</option>
            <option value="students">Students Only</option>
            <option value="instructors">Instructors & Faculty Only</option>
            <option value="admins">Administrators Only</option>
          </select>
        </div>

        {/* Start Mode Radio Options */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Publication Mode
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setStartMode('immediate');
                if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: null }));
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-center flex items-center justify-center gap-1.5 ${
                startMode === 'immediate'
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:border-brand-primary font-bold shadow-sm'
                  : 'border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Publish Now
            </button>
            <button
              type="button"
              onClick={() => setStartMode('scheduled')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-center flex items-center justify-center gap-1.5 ${
                startMode === 'scheduled'
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:border-brand-primary font-bold shadow-sm'
                  : 'border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule Later
            </button>
          </div>
        </div>
      </div>

      {/* Scheduled Date/Time picker (Visible only when startMode === 'scheduled') */}
      {startMode === 'scheduled' && (
        <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
          <label htmlFor="scheduledStart" className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
            Scheduled Start Date & Time (Server-Evaluated) <span className="text-red-500">*</span>
          </label>
          <input
            id="scheduledStart"
            type="datetime-local"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: null }));
            }}
            className={`w-full sm:w-80 px-3 py-2 rounded-xl text-xs border ${
              errors.startDate
                ? 'border-red-500 bg-red-50/30 dark:bg-red-950/30'
                : 'border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark-muted'
            } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary`}
          />
          {errors.startDate ? (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
              {errors.startDate}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Announcement will remain hidden until the server clock reaches this start time.
            </p>
          )}
        </div>
      )}

      {/* Duration Controls & Computed Expiry */}
      <div className="p-3.5 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white/70 dark:bg-surface-dark/40 space-y-3">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Announcement Active Duration <span className="text-red-500">*</span>
        </label>

        {/* 3 duration inputs: Days, Hours, Minutes */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Days</span>
            <input
              type="number"
              min="0"
              max="365"
              value={durationDays}
              onChange={(e) => setDurationDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3 py-1.5 rounded-xl text-xs border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          <div>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Hours (0-23)</span>
            <input
              type="number"
              min="0"
              max="23"
              value={durationHours}
              onChange={(e) => setDurationHours(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
              className="w-full px-3 py-1.5 rounded-xl text-xs border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          <div>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Minutes (0-59)</span>
            <input
              type="number"
              min="0"
              max="59"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
              className="w-full px-3 py-1.5 rounded-xl text-xs border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>

        {errors.duration && (
          <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
            {errors.duration}
          </p>
        )}

        {/* Calculated Expiry Confirmation Box */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-100/70 dark:bg-surface-dark-muted/80 text-[11px] text-slate-700 dark:text-slate-300">
          <Clock className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Calculated Expiration Time:
            </span>{' '}
            <span className="font-bold text-brand-primary dark:text-amber-300">
              {formatDateTime(computedExpiry)}
            </span>{' '}
            <span className="text-slate-500 dark:text-slate-400">
              ({durationDays}d {durationHours}h {durationMinutes}m after{' '}
              {startMode === 'immediate' ? 'effective immediate launch' : 'scheduled start'}
              )
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="pt-2 border-t border-surface-light-border dark:border-surface-dark-border flex flex-wrap items-center justify-between gap-3">
        {/* Left: Cancel/Unpublish active announcement */}
        <div>
          {currentAnnouncement && (currentAnnouncement.effectiveStatus === 'published' || currentAnnouncement.effectiveStatus === 'scheduled') && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={XCircle}
              onClick={handleCancel}
              isLoading={isCancelling}
              disabled={isAnyActionLoading}
              loadingText="Cancelling..."
            >
              Cancel Announcement
            </Button>
          )}
        </div>

        {/* Right: Save Draft & Publish/Schedule buttons */}
        <div className="flex items-center space-x-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Save}
            onClick={handleSaveDraft}
            isLoading={isSavingDraft}
            disabled={isAnyActionLoading}
            loadingText="Saving Draft..."
          >
            Save Draft
          </Button>

          {startMode === 'immediate' ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Send}
              onClick={handlePublishImmediate}
              isLoading={isPublishing}
              disabled={isAnyActionLoading}
              loadingText="Publishing..."
            >
              Publish Announcement
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Calendar}
              onClick={handleSchedule}
              isLoading={isScheduling}
              disabled={isAnyActionLoading}
              loadingText="Scheduling..."
            >
              Schedule Announcement
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementEditorSection;
