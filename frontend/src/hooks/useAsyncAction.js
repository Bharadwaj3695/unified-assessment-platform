import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * Custom hook to execute asynchronous operations with concurrency guards,
 * loading state management, error handling, and notification support.
 *
 * Prevents duplicate submissions caused by rapid repeated clicks.
 *
 * @param {Function} asyncFn - Async function to execute
 * @param {Object} options - Configuration options
 * @param {string} options.successMessage - Optional toast message on success
 * @param {string} options.errorMessage - Optional fallback toast message on error
 * @param {Function} options.onSuccess - Callback on success
 * @param {Function} options.onError - Callback on error
 */
export function useAsyncAction(asyncFn, options = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const isExecutingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args) => {
      // Guard against rapid duplicate clicks
      if (isExecutingRef.current) return null;

      isExecutingRef.current = true;
      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const result = await asyncFn(...args);
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        if (typeof options.onSuccess === 'function') {
          options.onSuccess(result);
        }
        return result;
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          options.errorMessage ||
          'Operation failed. Please try again.';

        if (isMountedRef.current) {
          setError(message);
        }

        if (options.errorMessage !== false) {
          toast.error(message);
        }

        if (typeof options.onError === 'function') {
          options.onError(err);
        }
        throw err;
      } finally {
        isExecutingRef.current = false;
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [asyncFn, options]
  );

  return {
    isLoading,
    error,
    execute,
    setIsLoading,
  };
}

export default useAsyncAction;
