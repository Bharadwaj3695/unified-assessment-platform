// Import React core library and essential hooks for state, lifecycle side effects, and DOM refs
import { useState, useEffect, useRef } from 'react';
// Import useNavigate hook from react-router-dom for navigation when clicking on linked notifications
import { useNavigate } from 'react-router-dom';
// Import Lucide icons used for notification bell, status markers, item categories, and actions
import { Bell, CheckCheck, Trash2, ExternalLink, X, BookOpen, Award, Info, AlertCircle } from 'lucide-react';
// Import notification API client service for fetching, updating, and removing notifications
import notificationService from '../../services/notification.service';
// Import useAuth hook to inspect active user role for route validation
import { useAuth } from '../../hooks/useAuth';
// Import centralized notification route resolver
import { resolveNotificationRoute } from '../../utils/notificationRouter';
// Import reusable Badge component for unread notification count pill
import Badge from '../ui/Badge';
// Import Spinner component for loading indicator
import Spinner from '../ui/Spinner';

// Component rendering an interactive notification bell popover with live polling and action controls
const NotificationPopover = () => {
  // Extract active user and role to enforce RBAC-aware notification deep links
  const { user, role } = useAuth();
  const activeRole = role || user?.role;
  // State controlling whether the notification popover dropdown menu is currently visible
  const [isOpen, setIsOpen] = useState(false);
  // State storing the list of user notifications fetched from the server
  const [notifications, setNotifications] = useState([]);
  // State storing the unread notifications count for badge display
  const [unreadCount, setUnreadCount] = useState(0);
  // State indicating whether notifications are currently being loaded from backend
  const [loading, setLoading] = useState(false);
  // State tracking the ID of the notification currently being marked or deleted (or 'all' for bulk action)
  const [actionLoading, setActionLoading] = useState(null);
  // Ref referencing the root popover container DOM node for outside click detection
  const popoverRef = useRef(null);
  // Initialize navigation function for route redirects
  const navigate = useNavigate();

  // Asynchronous function to fetch recent user notifications and unread tally
  const fetchNotifications = async (showLoading = false) => {
    // If showLoading flag is true, activate loading spinner state
    if (showLoading) setLoading(true);
    // Begin data fetching in try-catch-finally block
    try {
      // Query recent notifications from backend API with limit of 15 items
      const data = await notificationService.getNotifications({ limit: 15 });
      // Update notifications list state with returned array or empty list fallback
      setNotifications(data.notifications || []);
      // Update unread count state with returned tally or zero fallback
      setUnreadCount(data.unreadCount || 0);
    // Catch any network or server errors during notification fetch
    } catch (err) {
      // Log error to browser console
      console.error('Failed to fetch notifications:', err);
    // Reset loading state
    } finally {
      // Deactivate loading spinner if it was shown
      if (showLoading) setLoading(false);
    }
  };

  // Mount effect hook to perform initial fetch and configure 60-second polling interval
  useEffect(() => {
    // Fetch notifications immediately upon mounting without blocking spinner
    fetchNotifications(false);
    // Poll every 60 seconds for background notification updates
    const interval = setInterval(() => {
      // Poll notifications in background
      fetchNotifications(false);
    }, 60000);
    // Cleanup function clearing the polling timer when component unmounts
    return () => clearInterval(interval);
  }, []);

  // Handle outside click to automatically close popover when clicking anywhere else on page
  useEffect(() => {
    // Event listener callback determining if mousedown occurred outside popover container
    const handleClickOutside = (event) => {
      // If popover DOM node exists and target element is not contained inside it
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        // Close the popover dropdown
        setIsOpen(false);
      }
    };

    // Attach mousedown event listener only while popover is open
    if (isOpen) {
      // Add mousedown listener to document
      document.addEventListener('mousedown', handleClickOutside);
    }
    // Cleanup listener on popover close or component unmount
    return () => {
      // Remove mousedown listener from document
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handler toggling popover dropdown open state and triggering fresh data load when opened
  const handleToggle = () => {
    // Invert current open state
    const nextState = !isOpen;
    // Set new open state
    setIsOpen(nextState);
    // If opening popover, fetch fresh notifications with loading spinner
    if (nextState) {
      // Fetch fresh notifications
      fetchNotifications(true);
    }
  };

  // Handler marking an individual notification as read
  const handleMarkAsRead = async (id, e) => {
    // Prevent click event from bubbling up to notification container
    e?.stopPropagation();
    // Begin update in try-catch block
    try {
      // Send mark-as-read patch request to backend
      await notificationService.markAsRead(id);
      // Optimistically update notifications state marking matching item as read
      setNotifications((prev) =>
        // Map over notifications array and set read: true for matching item
        prev.map((n) => (n.id === id || n._id === id ? { ...n, read: true } : n))
      );
      // Decrement unread count, preventing negative numbers
      setUnreadCount((prev) => Math.max(0, prev - 1));
    // Catch errors
    } catch (err) {
      // Log failure to console
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Handler marking all notifications as read in a single batch request
  const handleMarkAllAsRead = async () => {
    // Begin batch update in try-catch-finally block
    try {
      // Set action loading indicator to 'all'
      setActionLoading('all');
      // Send batch mark-all-read request to backend
      await notificationService.markAllAsRead();
      // Update local notifications list marking every item as read
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      // Reset unread counter to 0
      setUnreadCount(0);
    // Catch errors
    } catch (err) {
      // Log failure to console
      console.error('Failed to mark all as read:', err);
    // Clear action loading state
    } finally {
      // Reset action loading indicator
      setActionLoading(null);
    }
  };

  // Handler deleting a notification by ID
  const handleDelete = async (id, e) => {
    // Prevent event bubbling to container
    e?.stopPropagation();
    // Begin deletion in try-catch-finally block
    try {
      // Set action loading for this specific notification ID
      setActionLoading(id);
      // Send delete request to backend
      await notificationService.deleteNotification(id);
      // Find the deleted notification to check if it was unread
      const target = notifications.find((n) => n.id === id || n._id === id);
      // If deleted item was unread, decrement the unread counter
      if (target && !target.read) {
        // Decrement unread count safely
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      // Remove deleted item from local notifications state array
      setNotifications((prev) => prev.filter((n) => n.id !== id && n._id !== id));
    // Catch errors
    } catch (err) {
      // Log failure to console
      console.error('Failed to delete notification:', err);
    // Clear action loading state
    } finally {
      // Reset action loading indicator
      setActionLoading(null);
    }
  };

  // Handler invoked when clicking on a notification card
  const handleNotificationClick = async (notif) => {
    // If notification has not been read yet, mark it as read
    if (!notif.read) {
      // Await mark-as-read completion
      await handleMarkAsRead(notif.id || notif._id);
    }
    // Resolve safe RBAC-validated destination route
    const targetRoute = resolveNotificationRoute(notif, activeRole);
    if (targetRoute) {
      // Dismiss popover dropdown
      setIsOpen(false);
      // Navigate to linked route
      navigate(targetRoute);
    }
  };

  // Handler invoked when clicking specifically on "View details" link
  const handleViewDetails = async (notif, e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    await handleNotificationClick(notif);
  };

  // Helper function returning appropriate category icon component based on notification type
  const getTypeIcon = (type) => {
    // Switch on notification type string
    switch (type) {
      // Assessment-related notification icon
      case 'assessment':
        return <BookOpen className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      // Grade or score release notification icon
      case 'grade':
        return <Award className="w-4 h-4 text-indigo-500 flex-shrink-0" />;
      // Platform system warning or security alert icon
      case 'system':
        return <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      // General informational notification icon fallback
      default:
        return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
  };

  // Helper formatting ISO date strings into relative time badges (e.g. '5m ago', 'Yesterday')
  const formatTimestamp = (dateStr) => {
    // Return empty string if date string is missing
    if (!dateStr) return '';
    // Parse target date
    const date = new Date(dateStr);
    // Capture current time
    const now = new Date();
    // Compute elapsed milliseconds
    const diffMs = now - date;
    // Compute elapsed minutes
    const diffMins = Math.floor(diffMs / 60000);
    // Compute elapsed hours
    const diffHours = Math.floor(diffMins / 60);
    // Compute elapsed days
    const diffDays = Math.floor(diffHours / 24);

    // Return human-friendly relative duration
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    // Format older dates with short month and day
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Render notification popover component JSX
  return (
    // Relative container with ref for click-outside detection
    <div className="relative" ref={popoverRef}>
      {/* Bell Button triggering popover display */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        {/* Bell vector icon */}
        <Bell className="w-5 h-5" />
        {/* Animated unread count badge rendered when unread count is greater than zero */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {/* Display 99+ if unread count exceeds 99 */}
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      {/* Close bell button */}
      </button>

      {/* Popover Dropdown Panel rendered when isOpen is true */}
      {isOpen && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-full mt-1 sm:mt-2 w-auto sm:w-96 max-w-[calc(100vw-1rem)] sm:max-w-none rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Popover Header with title, unread badge, and actions */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            {/* Title and unread count badge container */}
            <div className="flex items-center space-x-2">
              {/* Header title */}
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Notifications</h3>
              {/* Unread badge */}
              {unreadCount > 0 && (
                <Badge variant="primary" size="sm">
                  {unreadCount} unread
                </Badge>
              )}
            {/* Close title container */}
            </div>
            {/* Header action controls */}
            <div className="flex items-center space-x-1">
              {/* Mark all as read button displayed when unread notifications exist */}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={actionLoading === 'all'}
                  className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-brand-primary dark:hover:text-brand-primary rounded transition-colors"
                  title="Mark all as read"
                >
                  {/* CheckCheck double-tick icon */}
                  <CheckCheck className="w-3.5 h-3.5" />
                  {/* Mark all read text */}
                  <span>Mark all read</span>
                {/* Close mark all read button */}
                </button>
              )}
              {/* Close popover X button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
              >
                {/* X icon */}
                <X className="w-4 h-4" />
              {/* Close X button */}
              </button>
            {/* Close action controls container */}
            </div>
          {/* Close popover header */}
          </div>

          {/* Scrollable Notification List body */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {/* Render loading spinner while initial notifications are loading */}
            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center text-slate-400">
                {/* Animated spinner */}
                <Spinner size="md" />
                {/* Loading caption */}
                <span className="text-xs mt-2">Loading alerts...</span>
              </div>
            ) : notifications.length === 0 ? (
              /* Render empty state when there are zero notifications */
              <div className="py-10 text-center px-4">
                {/* Bell icon illustration */}
                <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2 opacity-60" />
                {/* Empty heading */}
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">All caught up!</p>
                {/* Empty description */}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No notifications at this time.</p>
              </div>
            ) : (
              /* Map over notifications array to render individual items */
              notifications.map((n) => {
                // Resolve stable notification ID
                const id = n.id || n._id;
                // Resolve authoritative RBAC-validated destination route
                const targetRoute = resolveNotificationRoute(n, activeRole);
                // Return item card JSX
                return (
                  <div
                    key={id}
                    onClick={() => handleNotificationClick(n)}
                    className={`group relative p-3.5 flex items-start space-x-3 transition-colors cursor-pointer ${
                      n.read
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-white dark:bg-slate-900 opacity-80'
                        : 'bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-50/70 dark:hover:bg-teal-950/40'
                    }`}
                  >
                    {/* Category icon */}
                    <div className="mt-0.5">{getTypeIcon(n.type)}</div>
                    {/* Content text container */}
                    <div className="flex-1 min-w-0 pr-12 sm:pr-6">
                      {/* Title and unread indicator dot */}
                      <div className="flex items-center space-x-1.5">
                        <p className={`text-xs font-semibold truncate ${n.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white font-bold'}`}>
                          {n.title}
                        </p>
                        {/* Unread indicator teal dot */}
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                        )}
                      </div>
                      {/* Notification message body */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      {/* Timestamp and details link footer */}
                      <div className="flex items-center space-x-2 mt-1.5">
                        {/* Relative timestamp badge */}
                        <span className="text-[10px] text-slate-400">
                          {formatTimestamp(n.createdAt)}
                        </span>
                        {/* Deep link indicator if route is resolvable */}
                        {targetRoute && (
                          <button
                            type="button"
                            onClick={(e) => handleViewDetails(n, e)}
                            className="inline-flex items-center text-[10px] font-medium text-brand-primary hover:underline focus:outline-none"
                          >
                            View details <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action buttons revealed on card hover */}
                    <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {/* Mark as read button shown for unread notifications */}
                      {!n.read && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(id, e)}
                          className="p-1 rounded text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-200/50 dark:hover:bg-slate-700"
                          title="Mark as read"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Delete notification button */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(id, e)}
                        disabled={actionLoading === id}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          {/* Close notification list body */}
          </div>
        {/* Close popover dropdown panel */}
        </div>
      )}
    {/* Close popover container */}
    </div>
  );
};

// Export NotificationPopover as default export
export default NotificationPopover;
