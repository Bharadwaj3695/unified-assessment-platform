import { useState, useEffect, useRef } from 'react';
// Import routing components: Navigate for redirection, Outlet for child route rendering, and useLocation for capturing previous URL
import { Navigate, Outlet, useLocation } from 'react-router-dom';
// Import custom useAuth hook to inspect session authentication state
import { useAuth } from '../hooks/useAuth';
// Import accessible PageLoader component to render branded preloader
import PageLoader from '../components/ui/PageLoader';
// Import minimum duration constant (2500ms = ~2.5 seconds)
import { BRANDED_TRANSITION_MIN_DURATION_MS } from '../utils/constants';

/**
 * Route guard enforcing that child routes are only accessible to authenticated users.
 * Implements Transition 1: Designated initial application-entry experience
 * with a minimum ~2.5-second branded presentation before presenting protected workspace data.
 */
const ProtectedRoute = () => {
  // Destructure authentication status, profile initialization loading flag, user, and role from auth context
  const { isAuthenticated, isLoading, user, role } = useAuth();
  // Retrieve current URL location object to preserve redirection target upon login
  const location = useLocation();

  // Track initial auth resolution state on mount
  const initialLoadStartedRef = useRef(isLoading);
  const [minPresentationDone, setMinPresentationDone] = useState(
    !initialLoadStartedRef.current || BRANDED_TRANSITION_MIN_DURATION_MS <= 0
  );

  useEffect(() => {
    // If the route was opened while auth was already resolved (not an initial load), no artificial delay
    if (!initialLoadStartedRef.current || BRANDED_TRANSITION_MIN_DURATION_MS <= 0) {
      setMinPresentationDone(true);
      return;
    }

    const timer = setTimeout(() => {
      setMinPresentationDone(true);
    }, BRANDED_TRANSITION_MIN_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  // Failed authentication: if session validation genuinely completed and resolved as unauthenticated,
  // stop the loader immediately and redirect to login without holding the minimum presentation timer
  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // While authentication initialization is genuinely unresolved OR the required ~2.5-second presentation is underway:
  // Render branded full-page preloader. Never expose protected content prematurely.
  if (isLoading || (!minPresentationDone && initialLoadStartedRef.current)) {
    return (
      <PageLoader
        fullScreen
        branded
        minDuration={initialLoadStartedRef.current ? BRANDED_TRANSITION_MIN_DURATION_MS : 0}
        user={user}
        role={role}
        message="Verifying secure authentication session..."
      />
    );
  }

  // Render nested child route components when authenticated and presentation has completed
  return <Outlet />;
};

// Export ProtectedRoute component for route definition in AppRoutes
export default ProtectedRoute;
