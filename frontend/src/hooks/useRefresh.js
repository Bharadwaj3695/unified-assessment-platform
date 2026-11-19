import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * Custom hook to execute refresh actions safely.
 *
 * Requirements satisfied:
 * - Prevents overlapping refresh requests from repeated clicks
 * - Maintains active page data and selection without blanking the screen
 * - Restores normal button state in finally block
 * - Displays success or error notifications
 *
 * @param {Function} refreshFn - Data reloading callback
 * @param {Object} options
 * @param {string} options.successMessage - Success message (e.g. "Data refreshed successfully")
 * @param {boolean} options.showToastOnSuccess - Whether to show toast on success (default: true)
 */
export function useRefresh(refreshFn, options = {}) {
  const {
    successMessage = 'Data refreshed successfully',
    showToastOnSuccess = true,
  } = options;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (...args) => {
      if (isRefreshingRef.current) return;

      isRefreshingRef.current = true;
      if (isMountedRef.current) {
        setIsRefreshing(true);
      }

      try {
        const result = await refreshFn(...args);
        if (showToastOnSuccess && successMessage) {
          toast.success(successMessage);
        }
        return result;
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to refresh data';
        toast.error(msg);
        throw err;
      } finally {
        isRefreshingRef.current = false;
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [refreshFn, successMessage, showToastOnSuccess]
  );

  return {
    isRefreshing,
    refresh,
  };
}

export default useRefresh;
