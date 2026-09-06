import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, ExternalLink, X, BookOpen, Award, Info, AlertCircle } from 'lucide-react';
import notificationService from '../../services/notification.service';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';

const NotificationPopover = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const popoverRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await notificationService.getNotifications({ limit: 15 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(false);
    // Poll every 60 seconds
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle outside click to close popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications(true);
    }
  };

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id || n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setActionLoading('all');
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    try {
      setActionLoading(id);
      await notificationService.deleteNotification(id);
      const target = notifications.find((n) => n.id === id || n._id === id);
      if (target && !target.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id && n._id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id || notif._id);
    }
    if (notif.link) {
      setIsOpen(false);
      navigate(notif.link);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'assessment':
        return <BookOpen className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      case 'grade':
        return <Award className="w-4 h-4 text-indigo-500 flex-shrink-0" />;
      case 'system':
        return <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="primary" size="sm">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={actionLoading === 'all'}
                  className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-brand-primary dark:hover:text-brand-primary rounded transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center text-slate-400">
                <Spinner size="md" />
                <span className="text-xs mt-2">Loading alerts...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2 opacity-60" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">All caught up!</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No notifications at this time.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const id = n.id || n._id;
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
                    <div className="mt-0.5">{getTypeIcon(n.type)}</div>
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center space-x-1.5">
                        <p className={`text-xs font-semibold truncate ${n.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white font-bold'}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <div className="flex items-center space-x-2 mt-1.5">
                        <span className="text-[10px] text-slate-400">
                          {formatTimestamp(n.createdAt)}
                        </span>
                        {n.link && (
                          <span className="inline-flex items-center text-[10px] font-medium text-brand-primary hover:underline">
                            View details <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (hover) */}
                    <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPopover;
